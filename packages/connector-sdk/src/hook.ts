/**
 * Provider hook contract — shape that every connector implements.
 * Keeping this minimal so community connectors have an obvious target.
 */

import type { HiveConnectorEvent } from '@hive/shared'

export interface ProviderHook {
  /** Unique name, e.g. 'openai', 'anthropic'. */
  readonly provider: string
  /** Wrap a provider SDK client / function. */
  wrap<T>(target: T, opts?: WrapOptions): T
  /**
   * Low-level emit — called by the wrapper when a request/response pair
   * is observed. Delegates to the collector's `record()`.
   */
  emit(event: HiveConnectorEvent): void
}

export interface WrapOptions {
  /** Override the model hint when the SDK doesn't expose it naturally. */
  modelHint?: string
  /** Optional use-case tag carried on every event from this wrapper. */
  useCaseTag?: string
}
