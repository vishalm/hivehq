import {
  type TTPCollector,
  type ProviderHook,
  type WrapOptions,
  measureBody,
} from '@hive/connector'
import {
  type HiveConnectorEvent,
  estimateTokens,
  newSessionHash,
} from '@hive/shared'

export interface OpenAIConnectorOptions {
  /** The collector that receives events. Required. */
  collector: TTPCollector
  /** Default model hint if the response doesn't expose one. */
  defaultModelHint?: string
}

/**
 * OpenAIConnector wraps the OpenAI Chat Completions / Responses endpoints
 * by sitting in front of `fetch`. It is framework-agnostic — if you use
 * the official `openai` package, the SDK calls fetch internally and our
 * wrapper observes from the outside.
 *
 * This connector is deliberately dependency-light so it works with:
 *   - openai (official SDK)
 *   - any other HTTP client pointed at api.openai.com
 *   - custom implementations (Azure OpenAI, etc.)
 */
export class OpenAIConnector implements ProviderHook {
  readonly provider = 'openai' as const

  constructor(private readonly opts: OpenAIConnectorOptions) {}

  /**
   * Wrap a global `fetch` implementation so every call to api.openai.com
   * emits an event. Returns the wrapped fetch — swap it in via
   * `globalThis.fetch = connector.wrap(fetch)` or pass to SDK options.
   */
  wrap<T>(target: T, options: WrapOptions = {}): T {
    if (typeof target !== 'function') {
      throw new TypeError('OpenAIConnector.wrap expects a fetch function')
    }
    const original = target as unknown as typeof fetch
    const self = this
    const wrapped: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : 'url' in input ? input.url : ''
      const isOpenAI = url.includes('api.openai.com') || url.includes('.openai.azure.com')
      if (!isOpenAI) return original(input, init)

      const started = Date.now()
      const requestBody = init?.body as string | Uint8Array | null | undefined
      const requestBytes = measureBody(requestBody ?? null)
      const sessionHash = newSessionHash()
      const endpoint = extractEndpoint(url)

      // Request event (direction: 'request')
      self.opts.collector.record({
        timestamp: started,
        provider: 'openai',
        endpoint,
        model_hint: options.modelHint ?? self.opts.defaultModelHint ?? 'unknown',
        direction: 'request',
        payload_bytes: requestBytes,
        status_code: 0,
        session_hash: sessionHash,
      })

      try {
        const response = await original(input, init)
        const latency = Date.now() - started
        const modelHint =
          response.headers.get('openai-model') ??
          response.headers.get('x-model') ??
          options.modelHint ??
          self.opts.defaultModelHint ??
          'unknown'
        const contentLength = Number(response.headers.get('content-length') ?? 0)
        const responseBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0

        // Response event (direction: 'response')
        self.opts.collector.record(
          {
            timestamp: Date.now(),
            provider: 'openai',
            endpoint,
            model_hint: modelHint,
            direction: 'response',
            payload_bytes: responseBytes,
            latency_ms: latency,
            status_code: response.status,
            session_hash: sessionHash,
          },
          {
            estimated_tokens: estimateTokens('openai', requestBytes + responseBytes),
            ...(options.useCaseTag && { use_case_tag: options.useCaseTag }),
          },
        )
        return response
      } catch (err) {
        self.opts.collector.record(
          {
            timestamp: Date.now(),
            provider: 'openai',
            endpoint,
            model_hint: options.modelHint ?? 'unknown',
            direction: 'error',
            payload_bytes: requestBytes,
            latency_ms: Date.now() - started,
            status_code: 0,
            session_hash: sessionHash,
          },
          { estimated_tokens: estimateTokens('openai', requestBytes) },
        )
        throw err
      }
    }
    return wrapped as unknown as T
  }

  /** Manual event emission — for cases where the fetch-wrap approach doesn't apply. */
  emit(event: HiveConnectorEvent): void {
    this.opts.collector.record(event)
  }
}

function extractEndpoint(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname
  } catch {
    return url.slice(0, 128)
  }
}
