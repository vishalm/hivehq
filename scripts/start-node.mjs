#!/usr/bin/env node
/**
 * Quick-start the HIVE Node server for local development.
 * Usage: node scripts/start-node.mjs
 */
import { buildApp, loadNodeEnv } from '@hive/node-server'

const env = loadNodeEnv({
  NODE_PORT: '3000',
  NODE_REGION: 'AE',
})

const { app, logger } = buildApp({ env })

app.listen(env.NODE_PORT, () => {
  logger.info({ port: env.NODE_PORT, region: env.NODE_REGION }, 'HIVE Node server running')
})
