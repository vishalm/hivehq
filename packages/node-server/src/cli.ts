#!/usr/bin/env node
import { buildApp } from './app.js'
import { loadNodeEnv } from './env.js'

const env = loadNodeEnv()
const { app, logger } = buildApp({ env })

const server = app.listen(env.NODE_PORT, () => {
  logger.info(
    { port: env.NODE_PORT, region: env.NODE_REGION, node_id: env.NODE_ID ?? 'unspecified' },
    '[hive] node-server listening',
  )
})

function shutdown(signal: string): void {
  logger.info({ signal }, '[hive] shutting down')
  server.close(() => process.exit(0))
  // Force exit after 10s.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
