import { describe, it, expect } from 'vitest'
import { HATP_VERSION, HATP_SCHEMA_HASH, type HATPEvent } from '@hive/shared'
import { PolicyEngine, loadPolicy, resolvePath } from './engine.js'
import { uaeResidencyPolicy, buildShadowAIPolicy, buildRetentionPolicy } from './builtins.js'

function evt(overrides: Partial<HATPEvent> = {}): HATPEvent {
  return {
    hatp_version: HATP_VERSION,
    event_id: '11111111-1111-1111-1111-111111111111',
    schema_hash: HATP_SCHEMA_HASH,
    timestamp: 1,
    observed_at: 2,
    emitter_id: 'e',
    emitter_type: 'scout',
    session_hash: 's',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model_hint: 'gpt-4',
    direction: 'response',
    payload_bytes: 100,
    status_code: 200,
    estimated_tokens: 42,
    deployment: 'node',
    governance: {
      consent_basis: 'org_policy',
      data_residency: 'AE',
      retention_days: 30,
      regulation_tags: ['UAE_AI_LAW', 'GDPR'],
      pii_asserted: false,
      content_asserted: false,
    },
    ...overrides,
  }
}

describe('policy engine', () => {
  it('allows by default when no rules match', () => {
    const engine = new PolicyEngine({
      version: 1,
      name: 'empty',
      default_decision: 'allow',
      rules: [],
    })
    expect(engine.evaluate(evt()).decision).toBe('allow')
  })

  it('UAE policy allows AE events', () => {
    const engine = loadPolicy(uaeResidencyPolicy)
    expect(engine.evaluate(evt()).decision).toBe('allow')
  })

  it('UAE policy denies non-AE events', () => {
    const engine = loadPolicy(uaeResidencyPolicy)
    const result = engine.evaluate(
      evt({ governance: { ...evt().governance, data_residency: 'US' } }),
    )
    expect(result.decision).toBe('deny')
    expect(result.reason).toMatch(/RESIDENCY_VIOLATION/)
  })

  it('UAE policy routes missing UAE_AI_LAW tag', () => {
    const engine = loadPolicy(uaeResidencyPolicy)
    const result = engine.evaluate(
      evt({ governance: { ...evt().governance, regulation_tags: ['GDPR'] } }),
    )
    expect(result.decision).toBe('route')
    expect(result.route).toBe('audit-review')
  })

  it('shadow-AI policy flags unsanctioned providers', () => {
    const engine = loadPolicy(buildShadowAIPolicy(['openai', 'anthropic']))
    expect(engine.evaluate(evt({ provider: 'openai' })).decision).toBe('allow')
    const shadow = engine.evaluate(evt({ provider: 'mistral' }))
    expect(shadow.decision).toBe('route')
    expect(shadow.route).toBe('security-review')
  })

  it('retention policy denies excessive windows', () => {
    const engine = loadPolicy(buildRetentionPolicy(90))
    expect(
      engine.evaluate(evt({ governance: { ...evt().governance, retention_days: 120 } })).decision,
    ).toBe('deny')
    expect(
      engine.evaluate(evt({ governance: { ...evt().governance, retention_days: 30 } })).decision,
    ).toBe('allow')
  })

  it('higher priority rule wins', () => {
    const engine = new PolicyEngine({
      version: 1,
      name: 'priority-test',
      default_decision: 'allow',
      rules: [
        {
          id: 'low',
          priority: 1,
          decision: 'allow',
          when: { op: 'eq', path: 'provider', value: 'openai' },
        },
        {
          id: 'high',
          priority: 100,
          decision: 'deny',
          when: { op: 'eq', path: 'provider', value: 'openai' },
        },
      ],
    })
    expect(engine.evaluate(evt()).matchedRuleId).toBe('high')
  })

  it('resolvePath handles nested and missing paths', () => {
    const e = evt()
    expect(resolvePath(e, 'provider')).toBe('openai')
    expect(resolvePath(e, 'governance.data_residency')).toBe('AE')
    expect(resolvePath(e, 'token_breakdown.cached_tokens')).toBeUndefined()
    expect(resolvePath(e, 'does.not.exist')).toBeUndefined()
  })
})
