/**
 * @hive/otel-bridge — OpenTelemetry → TTP.
 *
 * Adoption path for teams already instrumenting gen-AI calls with the
 * OpenTelemetry Semantic Conventions for generative AI. This bridge
 * converts a completed OTel span (in its end-callback form) into a
 * HiveConnectorEvent and hands it to a TTPCollector.
 *
 * We use a structural shape (no hard dep on @opentelemetry/* at runtime)
 * so projects can adopt the bridge without OTel SDK pinning headaches.
 *
 * Spec references:
 *   - gen_ai.system
 *   - gen_ai.request.model / gen_ai.response.model
 *   - gen_ai.usage.input_tokens / gen_ai.usage.output_tokens
 *   - http.response.status_code
 *   - server.address
 */

import type { TTPCollector } from '@hive/connector'
import {
  type AIProvider,
  type HiveConnectorEvent,
  CORE_PROVIDERS,
  newSessionHash,
} from '@hive/shared'

export interface OtelSpanLike {
  name: string
  startTimeUnixNano?: bigint | number
  endTimeUnixNano?: bigint | number
  attributes: Record<string, string | number | boolean | undefined>
  status?: { code?: number }
}

export interface BridgeOptions {
  collector: TTPCollector
  /** Fallback provider if the span doesn't expose `gen_ai.system`. */
  defaultProvider?: AIProvider
  /** Optional use-case tag stamped on every emitted event. */
  useCaseTag?: string
}

// ── System → TTP provider mapping ───────────────────────────────────────────

const SYSTEM_TO_PROVIDER: Record<string, AIProvider> = {
  openai: 'openai',
  'azure.ai.openai': 'azure_openai',
  azure_openai: 'azure_openai',
  anthropic: 'anthropic',
  google: 'google',
  gemini: 'google',
  vertex: 'google',
  aws_bedrock: 'bedrock',
  bedrock: 'bedrock',
  mistral: 'mistral',
  cohere: 'cohere',
  groq: 'groq',
  together: 'together',
  ollama: 'ollama',
}

function resolveProvider(
  system: string | undefined,
  fallback?: AIProvider,
): AIProvider {
  if (!system) return fallback ?? (CORE_PROVIDERS[0] as AIProvider)
  const direct = SYSTEM_TO_PROVIDER[system.toLowerCase()]
  if (direct) return direct
  // Unknown upstream system → tag as custom:…
  return `custom:${system.toLowerCase().replace(/[^a-z0-9_-]/g, '')}` as AIProvider
}

// ── Conversion ───────────────────────────────────────────────────────────────

export class OtelBridge {
  constructor(private readonly opts: BridgeOptions) {}

  /**
   * Accept a completed OTel span and emit the corresponding TTP event.
   * Intended for registration via OTel's SpanProcessor.onEnd hook.
   */
  onSpanEnd(span: OtelSpanLike): void {
    const attrs = span.attributes
    const system = attrs['gen_ai.system'] as string | undefined
    if (!system && !this.opts.defaultProvider) return // not a gen-AI span
    const provider = resolveProvider(system, this.opts.defaultProvider)

    const startNs = Number(span.startTimeUnixNano ?? 0n)
    const endNs = Number(span.endTimeUnixNano ?? 0n)
    const timestampMs = Math.floor(startNs / 1_000_000) || Date.now()
    const latencyMs =
      startNs && endNs ? Math.max(0, Math.floor((endNs - startNs) / 1_000_000)) : undefined

    const modelHint =
      (attrs['gen_ai.response.model'] as string | undefined) ??
      (attrs['gen_ai.request.model'] as string | undefined) ??
      'unknown'
    const endpoint =
      (attrs['server.address'] as string | undefined) ??
      (attrs['url.path'] as string | undefined) ??
      span.name

    const event: HiveConnectorEvent = {
      timestamp: timestampMs,
      provider,
      endpoint,
      model_hint: modelHint,
      direction: (span.status?.code ?? 0) >= 2 ? 'error' : 'response',
      payload_bytes: Number(attrs['gen_ai.usage.input_bytes'] ?? 0),
      status_code: Number(attrs['http.response.status_code'] ?? 200),
      session_hash: (attrs['session.id'] as string | undefined) ?? newSessionHash(),
    }
    if (latencyMs !== undefined) event.latency_ms = latencyMs

    const inTokens = Number(attrs['gen_ai.usage.input_tokens'] ?? 0)
    const outTokens = Number(attrs['gen_ai.usage.output_tokens'] ?? 0)

    this.opts.collector.record(event, {
      estimated_tokens: inTokens + outTokens,
      ...(this.opts.useCaseTag !== undefined ? { use_case_tag: this.opts.useCaseTag } : {}),
      ...(inTokens || outTokens
        ? {
            token_breakdown: {
              prompt_tokens: inTokens || undefined,
              completion_tokens: outTokens || undefined,
            },
          }
        : {}),
    })
  }
}
