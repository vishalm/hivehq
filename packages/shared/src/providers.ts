/**
 * HATP Provider Registry — canonical provider identifiers.
 *
 * Tier 1 (core) providers are HIVE-maintained. Tier 2 (verified community)
 * are accepted via PR to the registry repo. Tier 3 (`custom:${string}`)
 * is self-declared, valid but unranked.
 */

import { z } from 'zod'

export const CORE_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'azure_openai',
  'bedrock',
  'mistral',
  'cohere',
  'groq',
  'together',
  'ollama',
] as const

export const VERIFIED_COMMUNITY_PROVIDERS = [
  'huggingface',
  'replicate',
  'perplexity',
  'fireworks',
] as const

export const KNOWN_PROVIDERS = [
  ...CORE_PROVIDERS,
  ...VERIFIED_COMMUNITY_PROVIDERS,
] as const

export type CoreProvider = (typeof CORE_PROVIDERS)[number]
export type VerifiedCommunityProvider = (typeof VERIFIED_COMMUNITY_PROVIDERS)[number]
export type KnownProvider = (typeof KNOWN_PROVIDERS)[number]

/** Custom providers — self-declared via the `custom:` namespace. */
export type CustomProvider = `custom:${string}`

export type AIProvider = KnownProvider | CustomProvider

export const AIProviderSchema = z.union([
  z.enum(KNOWN_PROVIDERS),
  z.custom<CustomProvider>(
    (val) => typeof val === 'string' && /^custom:[a-z0-9][a-z0-9-_]{0,63}$/.test(val),
    { message: 'Custom providers must match custom:[a-z0-9][a-z0-9-_]{0,63}' },
  ),
])

/**
 * Known host → provider mapping. Used by Scout network-proxy interception
 * to classify outbound traffic.
 */
export const PROVIDER_HOSTS: Record<string, KnownProvider> = {
  'api.openai.com': 'openai',
  'api.anthropic.com': 'anthropic',
  'generativelanguage.googleapis.com': 'google',
  'api.mistral.ai': 'mistral',
  'api.cohere.ai': 'cohere',
  'api.cohere.com': 'cohere',
  'api.groq.com': 'groq',
  'api.together.xyz': 'together',
  'api.fireworks.ai': 'fireworks',
  'api.perplexity.ai': 'perplexity',
  'api.replicate.com': 'replicate',
  'api-inference.huggingface.co': 'huggingface',
  'localhost:11434': 'ollama',
}

/**
 * Host suffix patterns for providers that run on variable subdomains.
 */
export const PROVIDER_HOST_SUFFIXES: Array<[string, KnownProvider]> = [
  ['.openai.azure.com', 'azure_openai'],
  ['.bedrock-runtime.amazonaws.com', 'bedrock'],
  ['bedrock-runtime.', 'bedrock'],
]

/**
 * Classify a hostname as a known provider, or return undefined for Shadow AI.
 */
export function classifyHost(host: string): KnownProvider | undefined {
  const normalized = host.toLowerCase()
  const direct = PROVIDER_HOSTS[normalized]
  if (direct) return direct
  for (const [suffix, provider] of PROVIDER_HOST_SUFFIXES) {
    if (normalized.includes(suffix)) return provider
  }
  return undefined
}
