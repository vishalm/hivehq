#!/usr/bin/env node
/**
 * HIVE Node Hub — CLI entry point.
 *
 * Auto-detects NODE_DATABASE_URL to choose between:
 *   - PostgresEventStore (persistent, TimescaleDB, audit chain)
 *   - InMemoryEventStore (ephemeral, for dev/testing)
 */
import { buildApp } from './app.js'
import { loadNodeEnv } from './env.js'
import type { EventStore } from './store.js'

const env = loadNodeEnv()

async function main() {
  let store: EventStore | undefined

  // ── Auto-detect Postgres ─────────────────────────────────────────────────
  if (env.NODE_DATABASE_URL) {
    try {
      const { PostgresEventStore } = await import('./store-postgres.js')
      const pgStore = new PostgresEventStore({
        connectionString: env.NODE_DATABASE_URL,
        region: env.NODE_REGION,
      })
      await pgStore.migrate()
      store = pgStore
      console.log(`[hive] PostgresEventStore connected (${env.NODE_REGION})`)
    } catch (err) {
      console.warn('[hive] Postgres unavailable, falling back to InMemoryEventStore:', (err as Error).message)
    }
  } else {
    console.log('[hive] No NODE_DATABASE_URL — using InMemoryEventStore (data lost on restart)')
  }

  const { app, logger } = buildApp({ env, store })

  app.listen(env.NODE_PORT, '0.0.0.0', () => {
    logger.info({ port: env.NODE_PORT, region: env.NODE_REGION }, 'HIVE Node server running')
  })
}

main().catch((err) => {
  console.error('[hive] Fatal startup error:', err)
  process.exit(1)
})
