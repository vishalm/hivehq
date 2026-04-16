/**
 * HIVE Cost Model — Token-to-dollar mapping per provider/model.
 *
 * Pricing is per 1M tokens. When exact model pricing isn't known,
 * the engine falls back to provider-level averages. All costs are
 * estimated — authoritative billing comes from provider invoices.
 *
 * HIVE doesn't read content. Costs are derived from:
 *   estimated_tokens × price_per_token
 *
 * The model includes input/output splits when token_breakdown is present.
 */

import type { TTPEvent } from '@hive/shared'

// ── Pricing table (USD per 1M tokens) ───────────────────────────────────────
// Updated 2026-Q1. Blended input/output averages unless breakdown available.

export interface ModelPricing {
  input: number   // $ per 1M input tokens
  output: number  // $ per 1M output tokens
}

/** Per-model exact pricing (commonly used models). */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o':                { input: 2.50,  output: 10.00 },
  'gpt-4o-2024-08-06':     { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':           { input: 0.15,  output: 0.60 },
  'gpt-4-turbo':           { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':         { input: 0.50,  output: 1.50 },
  'gpt-35-turbo':          { input: 0.50,  output: 1.50 },
  'o1':                    { input: 15.00, output: 60.00 },
  'o1-mini':               { input: 3.00,  output: 12.00 },
  'o3-mini':               { input: 1.10,  output: 4.40 },

  // Anthropic Claude
  'claude-opus-4-20250514':     { input: 15.00, output: 75.00 },
  'claude-sonnet-4-20250514':   { input: 3.00,  output: 15.00 },
  'claude-3-haiku-20240307':    { input: 0.25,  output: 1.25 },
  'claude-3.5-sonnet':          { input: 3.00,  output: 15.00 },
  'claude-3.5-haiku':           { input: 0.80,  output: 4.00 },

  // Google
  'gemini-1.5-pro':        { input: 1.25,  output: 5.00 },
  'gemini-1.5-flash':      { input: 0.075, output: 0.30 },
  'gemini-2.0-flash':      { input: 0.10,  output: 0.40 },

  // Mistral
  'mistral-large-latest':  { input: 2.00,  output: 6.00 },
  'mistral-small-latest':  { input: 0.20,  output: 0.60 },
  'codestral':             { input: 0.30,  output: 0.90 },

  // Meta via various providers
  'llama-3.1-70b':         { input: 0.88,  output: 0.88 },
  'llama-3.1-8b':          { input: 0.18,  output: 0.18 },
  'llama-3.2-90b':         { input: 0.90,  output: 0.90 },

  // Local / Ollama — $0 (running on your hardware)
  'ollama':                { input: 0, output: 0 },
}

/** Provider-level average when model isn't matched. */
export const PROVIDER_AVG_PRICING: Record<string, ModelPricing> = {
  openai:        { input: 2.50,  output: 10.00 },
  anthropic:     { input: 3.00,  output: 15.00 },
  google:        { input: 0.50,  output: 2.00 },
  azure_openai:  { input: 3.00,  output: 12.00 },
  bedrock:       { input: 3.00,  output: 15.00 },
  mistral:       { input: 1.00,  output: 3.00 },
  cohere:        { input: 0.50,  output: 1.50 },
  groq:          { input: 0.27,  output: 0.27 },
  together:      { input: 0.50,  output: 0.50 },
  ollama:        { input: 0,     output: 0 },
  perplexity:    { input: 1.00,  output: 1.00 },
  fireworks:     { input: 0.20,  output: 0.20 },
}

// ── Cost Calculator ─────────────────────────────────────────────────────────

export interface CostBreakdown {
  inputCost: number
  outputCost: number
  totalCost: number
  currency: 'USD'
  confidence: 'exact' | 'provider_avg' | 'estimate'
}

/**
 * Estimate the cost of a single TTP event.
 */
export function estimateEventCost(event: TTPEvent): CostBreakdown {
  const pricing = resolvePrice(event.provider, event.model_hint)

  let inputTokens: number
  let outputTokens: number

  if (event.token_breakdown) {
    inputTokens = event.token_breakdown.prompt_tokens ?? 0
    outputTokens = event.token_breakdown.completion_tokens ?? 0
  } else {
    // Rough 60/40 split for request/response
    if (event.direction === 'request') {
      inputTokens = event.estimated_tokens
      outputTokens = 0
    } else {
      inputTokens = Math.floor(event.estimated_tokens * 0.4)
      outputTokens = Math.floor(event.estimated_tokens * 0.6)
    }
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.price.input
  const outputCost = (outputTokens / 1_000_000) * pricing.price.output

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    currency: 'USD',
    confidence: pricing.confidence,
  }
}

/**
 * Estimate total cost for a batch of events.
 */
export function estimateBatchCost(events: TTPEvent[]): {
  total: number
  byProvider: Record<string, number>
  byModel: Record<string, number>
  byDept: Record<string, number>
  byProject: Record<string, number>
  currency: 'USD'
} {
  const byProvider: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  const byDept: Record<string, number> = {}
  const byProject: Record<string, number> = {}
  let total = 0

  for (const event of events) {
    const cost = estimateEventCost(event)
    total += cost.totalCost
    byProvider[event.provider] = (byProvider[event.provider] ?? 0) + cost.totalCost
    byModel[event.model_hint] = (byModel[event.model_hint] ?? 0) + cost.totalCost
    byDept[event.dept_tag ?? 'untagged'] = (byDept[event.dept_tag ?? 'untagged'] ?? 0) + cost.totalCost
    byProject[event.project_tag ?? 'untagged'] = (byProject[event.project_tag ?? 'untagged'] ?? 0) + cost.totalCost
  }

  return { total, byProvider, byModel, byDept, byProject, currency: 'USD' }
}

function resolvePrice(provider: string, modelHint: string): {
  price: ModelPricing
  confidence: 'exact' | 'provider_avg' | 'estimate'
} {
  // Try exact model match
  const exactModel = MODEL_PRICING[modelHint]
  if (exactModel) return { price: exactModel, confidence: 'exact' }

  // Try partial model match (e.g. "gpt-4o" matches "gpt-4o-2024-08-06")
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (modelHint.startsWith(key) || key.startsWith(modelHint)) {
      return { price, confidence: 'exact' }
    }
  }

  // Provider average
  const providerAvg = PROVIDER_AVG_PRICING[provider]
  if (providerAvg) return { price: providerAvg, confidence: 'provider_avg' }

  // Unknown — use GPT-4o-level pricing as conservative estimate
  return { price: { input: 2.50, output: 10.00 }, confidence: 'estimate' }
}
