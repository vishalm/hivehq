/**
 * @hive/scout — Scout agent library.
 *
 * The Scout observes LLM traffic, packages events, and flushes to a Node Hub
 * (or keeps everything local in Solo mode). Events are durable via a WAL on
 * disk and Scout exposes /health, /ready, /metrics, /status for operators.
 */

export { Scout } from './scout.js'
export type { ScoutConfig } from './scout.js'
export { loadScoutEnv, ScoutEnvSchema } from './env.js'
export type { ScoutEnv } from './env.js'
export { createLogger } from './logger.js'
export type { Logger } from './logger.js'
export { PersistentSink } from './persistent-sink.js'
export { AdminServer, computeReadiness } from './admin-server.js'
export type { StatusReport, ReadinessReport } from './admin-server.js'
export { renderProm, scoutMetrics, counterInc, gaugeSet, setInfo } from './metrics.js'
