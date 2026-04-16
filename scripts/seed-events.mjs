#!/usr/bin/env node
/**
 * Seed the local Node server with realistic AI consumption telemetry.
 * Simulates a week of usage across multiple providers, models, departments.
 *
 * Usage: node scripts/seed-events.mjs [count=200]
 */
import {
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  defaultUAEGovernance,
  newEventId,
  newSessionHash,
} from '@hive/shared'

const NODE_URL = process.env.NODE_URL ?? 'http://localhost:3000'
const TOKEN = process.env.NODE_INGEST_TOKEN ?? 'hive-dev-token-2026'
const COUNT = parseInt(process.argv[2] ?? '200', 10)

// ── Realistic distribution ──────────────────────────────────────────────────

const PROVIDERS = [
  { provider: 'openai',    weight: 40, models: ['gpt-4o-2024-08-06', 'gpt-4o-mini', 'gpt-3.5-turbo'], endpoint: '/v1/chat/completions' },
  { provider: 'anthropic', weight: 25, models: ['claude-sonnet-4-20250514', 'claude-3-haiku-20240307'], endpoint: '/v1/messages' },
  { provider: 'google',    weight: 12, models: ['gemini-1.5-pro', 'gemini-1.5-flash'], endpoint: '/v1beta/models/generate' },
  { provider: 'mistral',   weight: 8,  models: ['mistral-large-latest', 'mistral-small-latest'], endpoint: '/v1/chat/completions' },
  { provider: 'bedrock',   weight: 5,  models: ['anthropic.claude-3-sonnet', 'amazon.titan-text-express'], endpoint: '/model/invoke' },
  { provider: 'azure_openai', weight: 5, models: ['gpt-4-turbo', 'gpt-35-turbo'], endpoint: '/openai/deployments/chat/completions' },
  // Shadow AI — unsanctioned custom provider
  { provider: 'ollama',   weight: 10, models: ['llama3.1:8b', 'mistral:7b', 'codellama:13b', 'gemma2:9b'], endpoint: '/api/chat' },
  { provider: 'custom:internal-llama', weight: 3, models: ['llama-3.1-70b', 'llama-3.1-8b'], endpoint: '/v1/completions' },
  { provider: 'custom:deepseek', weight: 2, models: ['deepseek-coder-v2', 'deepseek-chat'], endpoint: '/v1/chat/completions' },
]

// NOTE: undefined (not null!) for optional fields — Zod .optional() rejects null.
const DEPTS = ['engineering', 'product', 'data-science', 'marketing', 'legal', undefined]
const PROJECTS = ['copilot-assist', 'doc-gen', 'code-review', 'customer-support', 'internal-search', undefined]
const ENVS = ['production', 'staging', 'development']
const USE_CASES = ['chat', 'code-completion', 'summarisation', 'embedding', 'classification', undefined]

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── Generate events ─────────────────────────────────────────────────────────

const now = Date.now()
const ONE_HOUR = 3600_000
const WINDOW = 24 * ONE_HOUR // spread across last 24h

const events = []
for (let i = 0; i < COUNT; i++) {
  const p = weightedPick(PROVIDERS)
  const model = pick(p.models)
  const timestamp = now - randomInt(0, WINDOW)
  const latency = randomInt(50, 3000)
  const promptTokens = randomInt(100, 8000)
  const completionTokens = randomInt(50, 4000)
  const payloadBytes = (promptTokens + completionTokens) * 4 // rough estimate

  const isError = Math.random() < 0.03 // 3% error rate
  const statusCode = isError ? pick([429, 500, 502, 503]) : 200

  events.push({
    TTP_version: TTP_VERSION,
    event_id: newEventId(),
    schema_hash: TTP_SCHEMA_HASH,
    timestamp,
    observed_at: timestamp + randomInt(1, 50),
    emitter_id: `scout-seed-${randomInt(1, 5)}`,
    emitter_type: 'scout',
    session_hash: newSessionHash(),
    provider: p.provider,
    endpoint: p.endpoint,
    model_hint: model,
    direction: isError ? 'error' : 'response',
    payload_bytes: payloadBytes,
    latency_ms: latency,
    ttfb_ms: randomInt(20, latency),
    status_code: statusCode,
    estimated_tokens: promptTokens + completionTokens,
    token_breakdown: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    },
    dept_tag: pick(DEPTS),
    project_tag: pick(PROJECTS),
    env_tag: pick(ENVS),
    use_case_tag: pick(USE_CASES),
    deployment: 'node',
    node_region: 'AE',
    governance: defaultUAEGovernance(),
  })
}

// Sort by timestamp so the time-series looks natural
events.sort((a, b) => a.timestamp - b.timestamp)

// ── Wait for Node server to be ready ────────────────────────────────────────

console.log(`Connecting to ${NODE_URL} ...`)
for (let attempt = 1; attempt <= 30; attempt++) {
  try {
    const res = await fetch(`${NODE_URL}/health`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const health = await res.json()
      console.log(`Node server online (${health.region}, ${health.events_ingested} events)\n`)
      break
    }
  } catch {
    // not ready yet
  }
  if (attempt === 30) {
    console.error('Node server not reachable after 30 attempts. Is it running?')
    console.error(`  Try: curl ${NODE_URL}/health`)
    process.exit(1)
  }
  process.stdout.write(`  waiting... (attempt ${attempt}/30)\r`)
  await new Promise(r => setTimeout(r, 2000))
}

// ── Send in batches of 50 ───────────────────────────────────────────────────

const BATCH_SIZE = 50
let accepted = 0
let rejected = 0

for (let i = 0; i < events.length; i += BATCH_SIZE) {
  const batch = events.slice(i, i + BATCH_SIZE)
  const body = {
    batch_id: newEventId(),
    sent_at: Date.now(),
    events: batch,
  }

  try {
    const res = await fetch(`${NODE_URL}/api/v1/ttp/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: HTTP ${res.status} — ${text}`)
      continue
    }

    const result = await res.json()
    accepted += result.accepted ?? 0
    rejected += result.rejected ?? 0

    process.stdout.write(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.accepted} accepted, ${result.rejected} rejected\n`)
  } catch (err) {
    console.error(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: FAILED — ${err.message}`)
  }
}

console.log(`\nDone. ${accepted} accepted, ${rejected} rejected out of ${COUNT} events.`)
console.log(`Dashboard: http://localhost:3001`)
