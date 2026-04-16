#!/usr/bin/env node
/**
 * HIVE Real Demo — makes an actual LLM call through the Scout.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/demo-real.mjs
 *
 * What happens:
 *   1. Scout boots in solo mode (no network egress for telemetry)
 *   2. Scout wraps globalThis.fetch → intercepts OpenAI + Anthropic
 *   3. You make a real API call — the response comes back normally
 *   4. Scout captures the TTPEvent (sizes, latency, model, tokens)
 *   5. Events are printed — zero content captured, ever
 *
 * To send events to a Node Hub instead of solo mode:
 *   TTP_ENDPOINT=http://localhost:3000 HIVE_DEPLOYMENT=node node scripts/demo-real.mjs
 */
import { Scout, loadScoutEnv } from '@hive/scout'

const env = loadScoutEnv()
const scout = new Scout({ env })
scout.installGlobalFetch()

console.log(`\n  HIVE Scout (${env.HIVE_DEPLOYMENT} mode)`)
console.log(`  id: ${scout.id}`)
console.log(`  endpoint: ${env.TTP_ENDPOINT ?? '(solo — local only)'}`)
console.log('')

// ── Make a real call ────────────────────────────────────────────────────────

const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.log('  Set OPENAI_API_KEY or ANTHROPIC_API_KEY to make a real call.')
  console.log('  Example: OPENAI_API_KEY=sk-... node scripts/demo-real.mjs')
  console.log('')
  console.log('  Running without a key — demonstrating Scout lifecycle only.')
  console.log('')
  await scout.shutdown()
  console.log(`  Events captured: ${scout.localEvents().length}`)
  process.exit(0)
}

const isOpenAI = !!process.env.OPENAI_API_KEY

if (isOpenAI) {
  console.log('  Making a real OpenAI call...')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
      max_tokens: 10,
    }),
  })
  const data = await res.json()
  console.log(`  Response: ${JSON.stringify(data.choices?.[0]?.message?.content ?? data.error)}`)
} else {
  console.log('  Making a real Anthropic call...')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
    }),
  })
  const data = await res.json()
  console.log(`  Response: ${JSON.stringify(data.content?.[0]?.text ?? data.error)}`)
}

// ── Flush and show what Scout captured ──────────────────────────────────────

await scout.shutdown()

const events = scout.localEvents()
console.log(`\n  Events captured: ${events.length}`)
console.log('')

for (const e of events) {
  console.log('  ┌─ TTPEvent ─────────────────────────────────')
  console.log(`  │ provider:     ${e.provider}`)
  console.log(`  │ model:        ${e.model_hint}`)
  console.log(`  │ endpoint:     ${e.endpoint}`)
  console.log(`  │ direction:    ${e.direction}`)
  console.log(`  │ status:       ${e.status_code}`)
  console.log(`  │ bytes:        ${e.payload_bytes}`)
  console.log(`  │ est. tokens:  ${e.estimated_tokens}`)
  console.log(`  │ latency:      ${e.latency_ms ?? '-'}ms`)
  console.log(`  │ session:      ${e.session_hash.slice(0, 16)}...`)
  console.log(`  │ governance:   residency=${e.governance.data_residency}, retention=${e.governance.retention_days}d`)
  console.log(`  │ pii_asserted: ${e.governance.pii_asserted}  ← structurally false`)
  console.log(`  │ content:      ${e.governance.content_asserted}  ← structurally false`)
  console.log('  └──────────────────────────────────────────────')
  console.log('')
}

console.log('  Zero content captured. Zero prompts. Zero completions.')
console.log('  Only: sizes, timings, model hints, governance metadata.')
console.log('')
