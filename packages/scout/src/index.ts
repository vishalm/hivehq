/**
 * @hive/scout — Scout agent library.
 *
 * The Scout observes LLM traffic, packages events, and flushes to a Node Hub
 * (or keeps everything local in Solo mode). See the PLAN.md for the full
 * design; this module is the library form, the CLI is under `./cli`.
 */

export { Scout } from './scout.js'
export type { ScoutConfig } from './scout.js'
export { loadScoutEnv, ScoutEnvSchema } from './env.js'
export type { ScoutEnv } from './env.js'
