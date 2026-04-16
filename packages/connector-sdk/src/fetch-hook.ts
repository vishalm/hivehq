/**
 * Reusable fetch-wrapping hook factory.
 *
 * Most AI providers are HTTPS APIs. This factory implements the
 * observe-request → observe-response → emit loop once, and each
 * provider connector supplies:
 *   - a host matcher
 *   - provider id (HATP enum)
 *   - model-hint header lookup
 *   - optional response-body token estimator
 *
 * The hook NEVER reads request or response bodies for content —
 * only sizes and the model-hint header.
 */

import type { HATPCollector } from './collector.js'
import { measureBody } from './size.js'
import {
  type AIProvider,
  type HiveConnectorEvent,
  estimateTokens,
  newSessionHash,
} from '@hive/shared'
import type { ProviderHook, WrapOptions } from './hook.js'

export interface FetchHookSpec {
  /** HATP provider id. Must match the core registry or be `custom:…`. */
  provider: AIProvider
  /** Display name for logs. */
  label: string
  /** Return true if this host should be observed. */
  matches: (url: string) => boolean
  /** Extract a short endpoint label (path) from the URL. */
  endpoint?: (url: string) => string
  /**
   * Return the model hint from the response. Defaults to reading common
   * headers: `x-model`, `<provider>-model`, falling back to `unknown`.
   */
  modelFromResponse?: (res: Response) => string | null
}

const DEFAULT_ENDPOINT = (url: string): string => {
  try {
    return new URL(url).pathname
  } catch {
    return url.slice(0, 128)
  }
}

export class FetchHook implements ProviderHook {
  readonly provider: AIProvider

  constructor(
    private readonly spec: FetchHookSpec,
    private readonly collector: HATPCollector,
    private readonly defaults: { defaultModelHint?: string } = {},
  ) {
    this.provider = spec.provider
  }

  wrap<T>(target: T, options: WrapOptions = {}): T {
    if (typeof target !== 'function') {
      throw new TypeError(`${this.spec.label}: wrap expects a fetch function`)
    }
    const original = target as unknown as typeof fetch
    const spec = this.spec
    const defaultModelHint = this.defaults.defaultModelHint
    const collector = this.collector

    const wrapped: typeof fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : 'url' in input
              ? input.url
              : ''
      if (!spec.matches(url)) return original(input, init)

      const started = Date.now()
      const requestBody = init?.body as string | Uint8Array | null | undefined
      const requestBytes = measureBody(requestBody ?? null)
      const sessionHash = newSessionHash()
      const endpoint = (spec.endpoint ?? DEFAULT_ENDPOINT)(url)

      collector.record({
        timestamp: started,
        provider: spec.provider,
        endpoint,
        model_hint: options.modelHint ?? defaultModelHint ?? 'unknown',
        direction: 'request',
        payload_bytes: requestBytes,
        status_code: 0,
        session_hash: sessionHash,
        ...(options.useCaseTag && { use_case_tag: options.useCaseTag }),
      })

      try {
        const response = await original(input, init)
        const latency = Date.now() - started
        const headerModel =
          spec.modelFromResponse?.(response) ??
          response.headers.get('x-model') ??
          response.headers.get(`${spec.provider}-model`) ??
          null
        const modelHint =
          headerModel ?? options.modelHint ?? defaultModelHint ?? 'unknown'
        const contentLength = Number(response.headers.get('content-length') ?? 0)
        const responseBytes =
          Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0

        collector.record(
          {
            timestamp: Date.now(),
            provider: spec.provider,
            endpoint,
            model_hint: modelHint,
            direction: 'response',
            payload_bytes: responseBytes,
            latency_ms: latency,
            status_code: response.status,
            session_hash: sessionHash,
            ...(options.useCaseTag && { use_case_tag: options.useCaseTag }),
          },
          {
            estimated_tokens: estimateTokens(spec.provider, requestBytes + responseBytes),
          },
        )
        return response
      } catch (err) {
        collector.record(
          {
            timestamp: Date.now(),
            provider: spec.provider,
            endpoint,
            model_hint: options.modelHint ?? defaultModelHint ?? 'unknown',
            direction: 'error',
            payload_bytes: requestBytes,
            latency_ms: Date.now() - started,
            status_code: 0,
            session_hash: sessionHash,
            ...(options.useCaseTag && { use_case_tag: options.useCaseTag }),
          },
          { estimated_tokens: estimateTokens(spec.provider, requestBytes) },
        )
        throw err
      }
    }
    return wrapped as unknown as T
  }

  emit(event: HiveConnectorEvent): void {
    this.collector.record(event)
  }
}
