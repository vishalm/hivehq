/**
 * HATP Token Estimation — deterministic, content-free.
 *
 * When providers return token counts in headers, those are authoritative.
 * Otherwise, estimation is purely byte-based with provider-specific
 * calibration. HIVE never reads prompt or completion content.
 *
 * See: docs/protocol.md §Token Estimation Algorithm
 */

import type { AIProvider, KnownProvider } from './providers.js'

/**
 * Bytes-per-token calibration table, v0.1.
 * These numbers are empirically derived from tokeniser behaviour on
 * representative UTF-8 traffic.
 */
export const BYTES_PER_TOKEN: Record<KnownProvider, number> = {
  openai: 3.8,
  anthropic: 3.9,
  google: 4.1,
  azure_openai: 3.8,
  bedrock: 3.9,
  mistral: 3.7,
  cohere: 3.9,
  groq: 3.8,
  together: 3.8,
  ollama: 4.0,
  huggingface: 4.0,
  replicate: 4.0,
  perplexity: 3.8,
  fireworks: 3.8,
}

export const DEFAULT_BYTES_PER_TOKEN = 4.0

/**
 * Estimate tokens from payload byte count using the HATP calibration table.
 * Deterministic and content-free.
 */
export function estimateTokens(provider: AIProvider, payloadBytes: number): number {
  if (payloadBytes <= 0) return 0
  const ratio =
    provider in BYTES_PER_TOKEN
      ? BYTES_PER_TOKEN[provider as KnownProvider]
      : DEFAULT_BYTES_PER_TOKEN
  return Math.floor(payloadBytes / ratio)
}
