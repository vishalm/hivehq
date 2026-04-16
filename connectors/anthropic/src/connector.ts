import {
  type HATPCollector,
  type ProviderHook,
  type WrapOptions,
  measureBody,
} from '@hive/connector'
import {
  type HiveConnectorEvent,
  estimateTokens,
  newSessionHash,
} from '@hive/shared'

export interface AnthropicConnectorOptions {
  collector: HATPCollector
  defaultModelHint?: string
}

export class AnthropicConnector implements ProviderHook {
  readonly provider = 'anthropic' as const

  constructor(private readonly opts: AnthropicConnectorOptions) {}

  wrap<T>(target: T, options: WrapOptions = {}): T {
    if (typeof target !== 'function') {
      throw new TypeError('AnthropicConnector.wrap expects a fetch function')
    }
    const original = target as unknown as typeof fetch
    const self = this
    const wrapped: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : 'url' in input ? input.url : ''
      if (!url.includes('api.anthropic.com')) return original(input, init)

      const started = Date.now()
      const requestBytes = measureBody((init?.body as string | Uint8Array | null) ?? null)
      const sessionHash = newSessionHash()
      const endpoint = extractEndpoint(url)

      self.opts.collector.record({
        timestamp: started,
        provider: 'anthropic',
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
          response.headers.get('anthropic-model') ??
          response.headers.get('x-model') ??
          options.modelHint ??
          self.opts.defaultModelHint ??
          'unknown'
        const contentLength = Number(response.headers.get('content-length') ?? 0)
        const responseBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0

        self.opts.collector.record(
          {
            timestamp: Date.now(),
            provider: 'anthropic',
            endpoint,
            model_hint: modelHint,
            direction: 'response',
            payload_bytes: responseBytes,
            latency_ms: latency,
            status_code: response.status,
            session_hash: sessionHash,
          },
          {
            estimated_tokens: estimateTokens('anthropic', requestBytes + responseBytes),
            ...(options.useCaseTag && { use_case_tag: options.useCaseTag }),
          },
        )
        return response
      } catch (err) {
        self.opts.collector.record(
          {
            timestamp: Date.now(),
            provider: 'anthropic',
            endpoint,
            model_hint: options.modelHint ?? 'unknown',
            direction: 'error',
            payload_bytes: requestBytes,
            latency_ms: Date.now() - started,
            status_code: 0,
            session_hash: sessionHash,
          },
          { estimated_tokens: estimateTokens('anthropic', requestBytes) },
        )
        throw err
      }
    }
    return wrapped as unknown as T
  }

  emit(event: HiveConnectorEvent): void {
    this.opts.collector.record(event)
  }
}

function extractEndpoint(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.slice(0, 128)
  }
}
