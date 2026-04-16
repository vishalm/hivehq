#!/usr/bin/env node
/**
 * HIVE Node Hub — CLI entry point.
 */
import { buildApp } from './app.js'
import { loadNodeEnv } from './env.js'

const env = loadNodeEnv()
const { app, logger } = buildApp({ env })

app.listen(env.NODE_PORT, () => {
  logger.info({ port: env.NODE_PORT, region: env.NODE_REGION }, 'HIVE Node server running')
})
