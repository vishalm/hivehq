#!/usr/bin/env node
/**
 * HIVE Scout CLI — intercepts LLM traffic and ships TTP events.
 *
 * Usage:
 *   scout start              — start Scout (intercept fetch globally)
 *   scout status             — show identity + config
 *   scout events [--limit N] — dump recent local events (solo mode)
 *
 * Environment:
 *   TTP_ENDPOINT             — Node Hub URL (omit for solo mode)
 *   TTP_TOKEN                — ingest bearer token
 *   HIVE_DEPLOYMENT          — solo | node | federated | open
 *   HIVE_DEPT_TAG            — department tag on every event
 *   HIVE_PROJECT_TAG         — project tag on every event
 */
import { Scout } from './scout.js'
import { loadScoutEnv } from './env.js'

const args = process.argv.slice(2)
const command = args[0] ?? 'start'

const env = loadScoutEnv()
const scout = new Scout({ env })

switch (command) {
  case 'start': {
    // Install the global fetch interceptor.
    scout.installGlobalFetch()
    console.log(`HIVE Scout started`)
    console.log(`  id:         ${scout.id}`)
    console.log(`  mode:       ${env.HIVE_DEPLOYMENT}`)
    console.log(`  endpoint:   ${env.TTP_ENDPOINT ?? '(solo — local only)'}`)
    console.log(`  dept:       ${env.HIVE_DEPT_TAG ?? '(none)'}`)
    console.log(`  project:    ${env.HIVE_PROJECT_TAG ?? '(none)'}`)
    console.log(`  flush:      every ${env.HIVE_FLUSH_INTERVAL_MS}ms`)
    console.log(`  residency:  ${env.HIVE_DATA_RESIDENCY}`)
    console.log(``)
    console.log(`Intercepting: OpenAI, Anthropic (fetch-level)`)
    console.log(`Press Ctrl+C to stop.`)
    console.log(``)

    // Keep the process alive.
    process.on('SIGINT', async () => {
      console.log('\nShutting down Scout...')
      await scout.shutdown()
      console.log(`Flushed. ${scout.localEvents().length} events captured this session.`)
      process.exit(0)
    })

    // Heartbeat.
    setInterval(() => {
      const count = scout.localEvents().length
      if (count > 0) {
        process.stdout.write(`  [scout] ${count} events captured\r`)
      }
    }, 5_000)
    break
  }

  case 'status': {
    console.log(`HIVE Scout`)
    console.log(`  id:          ${scout.id}`)
    console.log(`  fingerprint: ${scout.identityFingerprint}`)
    console.log(`  mode:        ${env.HIVE_DEPLOYMENT}`)
    console.log(`  endpoint:    ${env.TTP_ENDPOINT ?? '(solo)'}`)
    console.log(`  residency:   ${env.HIVE_DATA_RESIDENCY}`)
    console.log(`  retention:   ${env.HIVE_RETENTION_DAYS}d`)
    console.log(`  regulation:  ${env.regulationTags.join(', ')}`)
    break
  }

  case 'events': {
    const limit = parseInt(args[1] ?? '20', 10)
    const events = scout.localEvents().slice(-limit)
    if (events.length === 0) {
      console.log('No local events. Make some API calls first.')
    } else {
      console.log(`Last ${events.length} events:`)
      for (const e of events) {
        const t = new Date(e.timestamp).toISOString()
        console.log(`  ${t} | ${e.provider.padEnd(12)} | ${e.model_hint.padEnd(24)} | ${e.direction.padEnd(8)} | ${e.estimated_tokens} tok | ${e.latency_ms ?? '-'}ms`)
      }
    }
    break
  }

  default:
    console.error(`Unknown command: ${command}`)
    console.error(`Usage: scout <start|status|events>`)
    process.exit(1)
}
