/**
 * @hive/connector — Open connector protocol.
 *
 * Connectors observe AI provider calls and emit HiveConnectorEvents.
 * The Scout upgrades those into TTPEvents by adding org context,
 * governance, and identity.
 *
 * Everything in this module is the public contract for third-party
 * connector authors. Tier 1 (HIVE-maintained) connectors live under
 * `connectors/*`. Community connectors import from here.
 */

export { TTPCollector } from './collector.js'
export type { CollectorConfig, CollectorSink } from './collector.js'
export {
  InMemorySink,
  HttpSink,
  ConsoleSink,
  type SinkResult,
} from './sinks.js'
export { measureBody, BodySizeObserver } from './size.js'
export type { ProviderHook, WrapOptions } from './hook.js'
export { FetchHook, type FetchHookSpec } from './fetch-hook.js'
