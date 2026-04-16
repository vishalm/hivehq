import { describe, expect, it } from 'vitest'
import {
  HATPEventSchema,
  HATP_VERSION,
  HATP_SCHEMA_HASH,
  canonicalize,
  parseHATPEvent,
  safeParseHATPEvent,
} from './hatp.js'
import { defaultUAEGovernance } from './governance.js'
import { estimateTokens } from './tokens.js'
import { newEventId, newSessionHash } from './hash.js'

const baseEvent = {
  hatp_version: HATP_VERSION,
  event_id: newEventId(),
  schema_hash: HATP_SCHEMA_HASH,
  timestamp: Date.now(),
  observed_at: Date.now(),
  emitter_id: 'scout-hash-abc123',
  emitter_type: 'scout' as const,
  session_hash: newSessionHash(),
  provider: 'openai' as const,
  endpoint: '/v1/chat/completions',
  model_hint: 'gpt-4o',
  direction: 'response' as const,
  payload_bytes: 2048,
  latency_ms: 412,
  status_code: 200,
  estimated_tokens: 538,
  deployment: 'solo' as const,
  governance: defaultUAEGovernance(),
}

describe('HATPEventSchema', () => {
  it('accepts a well-formed event', () => {
    const parsed = parseHATPEvent(baseEvent)
    expect(parsed.provider).toBe('openai')
    expect(parsed.governance.pii_asserted).toBe(false)
  })

  it('rejects events missing governance', () => {
    const { governance: _g, ...invalid } = baseEvent
    const result = safeParseHATPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects attempts to set pii_asserted: true', () => {
    const invalid = {
      ...baseEvent,
      governance: { ...baseEvent.governance, pii_asserted: true },
    }
    const result = HATPEventSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects unknown fields (strict mode)', () => {
    const invalid = { ...baseEvent, rogue_field: 'should-not-pass' }
    const result = HATPEventSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts custom:* providers', () => {
    const event = { ...baseEvent, provider: 'custom:my-llm' as const }
    const parsed = parseHATPEvent(event)
    expect(parsed.provider).toBe('custom:my-llm')
  })
})

describe('estimateTokens', () => {
  it('returns 0 for non-positive input', () => {
    expect(estimateTokens('openai', 0)).toBe(0)
    expect(estimateTokens('openai', -10)).toBe(0)
  })

  it('is deterministic for the same provider + size', () => {
    expect(estimateTokens('openai', 3800)).toBe(estimateTokens('openai', 3800))
  })

  it('uses provider calibration', () => {
    // openai: 3.8 → 3800 / 3.8 = 1000
    expect(estimateTokens('openai', 3800)).toBe(1000)
    // google: 4.1 → 4100 / 4.1 = 1000
    expect(estimateTokens('google', 4100)).toBe(1000)
  })

  it('falls back for custom providers', () => {
    // default 4.0 → 4000 / 4.0 = 1000
    expect(estimateTokens('custom:new-llm', 4000)).toBe(1000)
  })
})

describe('canonicalize', () => {
  it('produces stable output for signing', () => {
    const a = canonicalize(baseEvent)
    const b = canonicalize(baseEvent)
    expect(a).toBe(b)
  })
})
