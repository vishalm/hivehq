/**
 * OllamaConnector — Intercepts Ollama API calls and emits TTP telemetry.
 *
 * Ollama runs locally (default: http://localhost:11434) and exposes:
 *   - POST /api/generate   — Text generation
 *   - POST /api/chat       — Chat completions
 *   - POST /api/embeddings — Embeddings
 *   - POST /api/pull       — Model pull (ignored)
 *   - POST /api/show       — Model info (ignored)
 *
 * This connector wraps fetch to intercept calls to any configured
 * Ollama host. It reads ONLY metadata — never prompts or completions.
 *
 * The model name is extracted from the request body's `model` field
 * by reading only that key. Ollama always includes the model in the
 * response JSON as well, but we avoid reading response bodies.
 */

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

/** Ollama API endpoints we care about (telemetry-worthy). */
const TRACKED_PATHS = new Set([
  '/api/generate',
  '/api/chat',
  '/api/embeddings',
  '/api/embed',
])

export interface OllamaConnectorOptions {
  /** The collector that receives events. Required. */
  collector: TTPCollector
  /**
   * Ollama hosts to match. Defaults to common local addresses.
   * Supports custom hosts for remote Ollama deployments.
   */
  hosts?: string[]
  /** Default model hint when we can't extract from the request. */
  defaultModelHint?: string
}

const DEFAULT_HOSTS = [
  'localhost:11434',
  '127.0.0.1:11434',
  '0.0.0.0:11434',
]

export class OllamaConnector implements ProviderHook {
  readonly provider = 'ollama' as const
  private readonly hosts: string[]

  constructor(private readonly opts: OllamaConnectorOptions) {
    this.hosts = opts.hosts ?? DEFAULT_HOSTS
  }

  /**
   * Returns true if the URL points at a known Ollama instance
   * AND the path is a telemetry-worthy endpoint.
   */
  private matches(url: string): boolean {
    try {
      const u = new URL(url)
      const hostMatch = this.hosts.some(
        (h) => u.host === h || u.hostname === h,
      )
      return hostMatch && TRACKED_PATHS.has(u.pathname)
    } catch {
      return false
    }
  }

  /**
   * Extract the model name from the JSON request body without
   * reading any prompt or message content.
   *
   * Ollama request bodies look like: { "model": "llama3.1", "prompt": "...", ... }
   * We only grab `model` — everything else is invisible.
   */
  private static extractModel(body: unknown): string | null {
    if (typeof body === 'string') {
      // Fast regex extraction — avoids JSON.parse of large bodies
      const match = body.match(/"model"\s*:\s*"([^"]+)"/)
      return match?.[1] ?? null
    }
    return null
  }

  wrap<T>(target: T, options: WrapOptions = {}): T {
    if (typeof target !== 'function') {
      throw new TypeError('OllamaConnector.wrap expects a fetch function')
    }
    const original = target as unknown as typeof fetch
    const self = this

    const wrapped: typeof fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : 'url' in input
              ? input.url
              : ''

      if (!self.matches(url)) return original(input, init)

      const started = Date.now()
      const requestBody = init?.body as string | Uint8Array | null | undefined
      const requestBytes = measureBody(requestBody ?? null)
      const sessionHash = newSessionHash()
      const endpoint = extractEndpoint(url)

      // Try to extract model from request body
      const bodyModel = OllamaConnector.extractModel(requestBody)
      const modelHint =
        bodyModel ?? options.modelHint ?? self.opts.defaultModelHint ?? 'unknown'

      // Detect use-case from endpoint
      const useCase = endpointToUseCase(endpoint)

      self.opts.collector.record({
        timestamp: started,
        provider: 'ollama',
        endpoint,
        model_hint: modelHint,
        direction: 'request',
        payload_bytes: requestBytes,
        status_code: 0,
        session_hash: sessionHash,
      })

      try {
        const response = await original(input, init)
        const latency = Date.now() - started
        const contentLength = Number(
          response.headers.get('content-length') ?? 0,
        )
        const responseBytes =
          Number.isFinite(contentLength) && contentLength > 0
            ? contentLength
            : 0

        self.opts.collector.record(
          {
            timestamp: Date.now(),
            provider: 'ollama',
            endpoint,
            model_hint: modelHint,
            direction: 'response',
            payload_bytes: responseBytes,
            latency_ms: latency,
            status_code: response.status,
            session_hash: sessionHash,
          },
          {
            estimated_tokens: estimateTokens('ollama', requestBytes + responseBytes),
            ...(useCase && { use_case_tag: useCase }),
            ...(options.useCaseTag && { use_case_tag: options.useCaseTag }),
          },
        )
        return response
      } catch (err) {
        self.opts.collector.record(
          {
            timestamp: Date.now(),
            provider: 'ollama',
            endpoint,
            model_hint: modelHint,
            direction: 'error',
            payload_bytes: requestBytes,
            latency_ms: Date.now() - started,
            status_code: 0,
            session_hash: sessionHash,
          },
          { estimated_tokens: estimateTokens('ollama', requestBytes) },
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

function endpointToUseCase(endpoint: string): string | null {
  if (endpoint.includes('chat')) return 'chat'
  if (endpoint.includes('generate')) return 'code-completion'
  if (endpoint.includes('embed')) return 'embedding'
  return null
}
