#!/usr/bin/env node
/**
 * Scout CLI — minimal launcher for the Phase 1 macOS menubar build path.
 *
 * Usage:
 *   scout start           # install global fetch wrapper and idle
 *   scout status          # print identity fingerprint and deployment mode
 *   scout events [--tail] # print local events (solo mode)
 */

import { loadScoutEnv } from './env.js'
import { Scout } from './scout.js'

const args = process.argv.slice(2)
const command = args[0] ?? 'status'

async function main(): Promise<void> {
  const env = loadScoutEnv()
  const scout = new Scout({ env })

  switch (command) {
    case 'start': {
      scout.installGlobalFetch()
      // eslint-disable-next-line no-console
      console.info(
        `[hive] scout started · id=${scout.identityFingerprint} · mode=${env.HIVE_DEPLOYMENT}`,
      )
      // Keep the process alive for long-running observation.
      setInterval(() => void 0, 1 << 30)
      process.on('SIGINT', async () => {
        await scout.shutdown()
        process.exit(0)
      })
      break
    }
    case 'status': {
      // eslint-disable-next-line no-console
      console.info(
        JSON.stringify(
          {
            scout_id_fingerprint: scout.identityFingerprint,
            deployment: env.HIVE_DEPLOYMENT,
            data_residency: env.HIVE_DATA_RESIDENCY,
            retention_days: env.HIVE_RETENTION_DAYS,
            regulation_tags: env.regulationTags,
            endpoint: env.HATP_ENDPOINT ?? '(solo — local only)',
          },
          null,
          2,
        ),
      )
      await scout.shutdown()
      break
    }
    case 'events': {
      const events = scout.localEvents()
      // eslint-disable-next-line no-console
      console.info(JSON.stringify({ count: events.length, events }, null, 2))
      await scout.shutdown()
      break
    }
    default: {
      // eslint-disable-next-line no-console
      console.error(`Unknown command: ${command}\nUsage: scout [start|status|events]`)
      process.exit(1)
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[hive] scout failed:', err)
  process.exit(1)
})
