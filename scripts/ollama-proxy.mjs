#!/usr/bin/env node
/**
 * HIVE Ollama Proxy — transparent reverse proxy that captures real telemetry.
 *
 * Sits between your Ollama clients and the Ollama server. Every request/response
 * pair produces TTP events that are forwarded to the HIVE Node server.
 *
 * Zero content inspection — only metadata (model name, endpoint, timing, bytes).
 *
 * Usage:
 *   node scripts/ollama-proxy.mjs
 *
 * Environment:
 *   OLLAMA_PROXY_PORT   — port the proxy listens on  (default: 11435)
 *   OLLAMA_TARGET       — upstream Ollama URL         (default: http://localhost:11434)
 *   NODE_URL            — HIVE Node ingest URL        (default: http://localhost:3000)
 *   NODE_INGEST_TOKEN   — Bearer token for ingest     (default: hive-dev-token-2026)
 *   HIVE_DEPT_TAG       — department tag              (optional)
 *   HIVE_PROJECT_TAG    — project tag                 (optional)
 */
import { createServer } from 'node:http'
import { request as httpRequest } from 'node:http'
import { URL } from 'node:url'
import {
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  defaultUAEGovernance,
  newEventId,
  newSessionHash,
} from '@hive/shared'

// ── Configuration ───────────────────────────────────────────────────────────

const PROXY_PORT = parseInt(process.env.OLLAMA_PROXY_PORT ?? '11435', 10)
const OLLAMA_TARGET = process.env.OLLAMA_TARGET ?? 'http://localhost:11434'
const NODE_URL = process.env.NODE_URL ?? 'http://localhost:3000'
const TOKEN = process.env.NODE_INGEST_TOKEN ?? 'hive-dev-token-2026'
const DEPT_TAG = process.env.HIVE_DEPT_TAG
const PROJECT_TAG = process.env.HIVE_PROJECT_TAG

const targetUrl = new URL(OLLAMA_TARGET)

// Tracked endpoints — these produce telemetry
const TRACKED = new Set(['/api/generate', '/api/chat', '/api/embeddings', '/api/embed'])

const governance = defaultUAEGovernance()

// ── Event helpers ───────────────────────────────────────────────────────────

function endpointToUseCase(path) {
  if (path.includes('chat')) return 'chat'
  if (path.includes('generate')) return 'code-completion'
  if (path.includes('embed')) return 'embedding'
  return undefined
}

function extractModelFromBody(bodyStr) {
  try {
    const match = bodyStr.match(/"model"\s*:\s*"([^"]+)"/)
    return match?.[1] ?? undefined
  } catch {
    return undefined
  }
}

function buildEvent({ sessionHash, endpoint, model, direction, payloadBytes, latencyMs, statusCode, estimatedTokens, useCase }) {
  const now = Date.now()
  const event = {
    TTP_version: TTP_VERSION,
    event_id: newEventId(),
    schema_hash: TTP_SCHEMA_HASH,
    timestamp: now,
    observed_at: now + 1,
    emitter_id: 'ollama-proxy-1',
    emitter_type: 'proxy',
    session_hash: sessionHash,
    provider: 'ollama',
    endpoint,
    model_hint: model ?? 'unknown',
    direction,
    payload_bytes: payloadBytes,
    status_code: statusCode,
    estimated_tokens: estimatedTokens ?? 0,
    deployment: 'node',
    node_region: 'AE',
    governance,
  }

  // Only add optional fields if they have values (Zod rejects null on .optional())
  if (latencyMs !== undefined) event.latency_ms = latencyMs
  if (DEPT_TAG) event.dept_tag = DEPT_TAG
  if (PROJECT_TAG) event.project_tag = PROJECT_TAG
  if (useCase) event.use_case_tag = useCase

  return event
}

// ── Event queue + batched flush ─────────────────────────────────────────────

const eventQueue = []
let flushTimer = null

function queueEvent(event) {
  eventQueue.push(event)
  if (eventQueue.length >= 20) {
    flushNow()
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushNow, 5000)
  }
}

async function flushNow() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (eventQueue.length === 0) return

  const batch = eventQueue.splice(0, eventQueue.length)
  const body = JSON.stringify({
    batch_id: newEventId(),
    sent_at: Date.now(),
    events: batch,
  })

  try {
    const res = await fetch(`${NODE_URL}/api/v1/ttp/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body,
    })
    if (res.ok) {
      const result = await res.json()
      console.log(`  [flush] ${result.accepted} accepted, ${result.rejected} rejected`)
      if (result.errors?.length > 0) {
        for (const err of result.errors.slice(0, 3)) {
          console.log(`    reject: ${err.code} ${err.field ?? ''}`)
        }
      }
    } else {
      const text = await res.text()
      console.error(`  [flush] HTTP ${res.status}: ${text}`)
    }
  } catch (err) {
    console.error(`  [flush] FAILED: ${err.message}`)
  }
}

// ── Token estimation (rough) ────────────────────────────────────────────────

function estimateTokens(bytes) {
  // ~4 bytes per token for English text, rough heuristic
  return Math.max(1, Math.round(bytes / 4))
}

// ── Proxy server ────────────────────────────────────────────────────────────

let requestCount = 0

const server = createServer((clientReq, clientRes) => {
  const path = clientReq.url ?? '/'
  const tracked = TRACKED.has(path.split('?')[0])

  const requestStart = Date.now()
  const sessionHash = newSessionHash()
  const reqChunks = []

  clientReq.on('data', (chunk) => reqChunks.push(chunk))

  clientReq.on('end', () => {
    const reqBody = Buffer.concat(reqChunks)
    const reqBytes = reqBody.length
    const reqStr = reqBody.toString('utf8')

    const model = extractModelFromBody(reqStr)
    const useCase = endpointToUseCase(path)

    // Emit request event
    if (tracked) {
      queueEvent(buildEvent({
        sessionHash,
        endpoint: path,
        model,
        direction: 'request',
        payloadBytes: reqBytes,
        statusCode: 0,
        estimatedTokens: estimateTokens(reqBytes),
        useCase,
      }))
    }

    // Forward to Ollama
    const proxyOpts = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || 11434,
      path,
      method: clientReq.method,
      headers: { ...clientReq.headers, host: targetUrl.host },
    }

    const proxyReq = httpRequest(proxyOpts, (proxyRes) => {
      // Forward response headers immediately so streaming works
      clientRes.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers)

      const resChunks = []

      proxyRes.on('data', (chunk) => {
        resChunks.push(chunk)
        // Stream the response back to the client immediately
        clientRes.write(chunk)
      })

      proxyRes.on('end', () => {
        const latency = Date.now() - requestStart
        const resBytes = resChunks.reduce((s, c) => s + c.length, 0)

        // Emit response event
        if (tracked) {
          requestCount++
          const est = estimateTokens(reqBytes + resBytes)
          queueEvent(buildEvent({
            sessionHash,
            endpoint: path,
            model,
            direction: 'response',
            payloadBytes: resBytes,
            latencyMs: latency,
            statusCode: proxyRes.statusCode ?? 200,
            estimatedTokens: est,
            useCase,
          }))

          const modelStr = model ?? '?'
          console.log(`  #${requestCount} ${path} | ${modelStr} | ${latency}ms | ${est} tok`)
        }

        clientRes.end()
      })
    })

    proxyReq.on('error', (err) => {
      console.error(`  [proxy] upstream error: ${err.message}`)

      if (tracked) {
        queueEvent(buildEvent({
          sessionHash,
          endpoint: path,
          model,
          direction: 'error',
          payloadBytes: reqBytes,
          latencyMs: Date.now() - requestStart,
          statusCode: 502,
          estimatedTokens: 0,
          useCase,
        }))
      }

      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' })
        clientRes.end(JSON.stringify({ error: 'upstream_unreachable', detail: err.message }))
      } else {
        clientRes.end()
      }
    })

    proxyReq.write(reqBody)
    proxyReq.end()
  })
})

// ── Startup ─────────────────────────────────────────────────────────────────

// Verify Node server is reachable
console.log(`HIVE Ollama Proxy`)
console.log(`  proxy:    http://localhost:${PROXY_PORT}`)
console.log(`  target:   ${OLLAMA_TARGET}`)
console.log(`  node:     ${NODE_URL}`)
console.log(`  token:    ${TOKEN.slice(0, 4)}...${TOKEN.slice(-4)}`)
console.log(``)

try {
  const healthRes = await fetch(`${NODE_URL}/health`, { signal: AbortSignal.timeout(3000) })
  if (healthRes.ok) {
    const h = await healthRes.json()
    console.log(`  Node server online (${h.region}, ${h.events_ingested} events)`)
  } else {
    console.warn(`  Node server returned ${healthRes.status} — events may not be ingested`)
  }
} catch {
  console.warn(`  Node server not reachable at ${NODE_URL} — events will queue and retry`)
}

try {
  const ollamaRes = await fetch(`${OLLAMA_TARGET}/api/tags`, { signal: AbortSignal.timeout(3000) })
  if (ollamaRes.ok) {
    const data = await ollamaRes.json()
    const models = data.models?.map(m => m.name) ?? []
    console.log(`  Ollama online — ${models.length} model(s): ${models.slice(0, 5).join(', ')}`)
  }
} catch {
  console.warn(`  Ollama not reachable at ${OLLAMA_TARGET} — proxy will forward anyway`)
}

console.log(``)
console.log(`Point your Ollama clients to http://localhost:${PROXY_PORT}`)
console.log(`  Example: OLLAMA_HOST=http://localhost:${PROXY_PORT} ollama run llama3.1`)
console.log(`  Example: curl http://localhost:${PROXY_PORT}/api/chat -d '{"model":"llama3.1","messages":[{"role":"user","content":"hi"}]}'`)
console.log(``)
console.log(`Press Ctrl+C to stop.`)
console.log(``)

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`Proxy listening on port ${PROXY_PORT}`)
  console.log(``)
})

process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  await flushNow()
  server.close()
  console.log(`Done. ${requestCount} requests captured.`)
  process.exit(0)
})
