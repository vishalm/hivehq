import { describe, expect, it } from 'vitest'
import {
  TTPEventSchema,
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  parseTTPEvent,
  safeParseTTPEvent,
} from './ttp.js'
import { TTPBatchSchema } from './telemetry.js'
import {
  GovernanceBlockSchema,
  defaultUAEGovernance,
} from './governance.js'
import {
  newEventId,
  newSessionHash,
} from './hash.js'

describe('TTP Schema', () => {
  const validEvent = {
    TTP_version: TTP_VERSION,
    event_id: newEventId(),
    schema_hash: TTP_SCHEMA_HASH,
    timestamp: Date.now(),
    observed_at: Date.now(),
    emitter_id: 'scout-test',
    emitter_type: 'scout' as const,
    session_hash: newSessionHash(),
    provider: 'openai' as const,
    endpoint: '/v1/chat/completions',
    model_hint: 'gpt-4o',
    direction: 'response' as const,
    payload_bytes: 1024,
    status_code: 200,
    estimated_tokens: 250,
    deployment: 'solo' as const,
    governance: defaultUAEGovernance(),
  }

  it('valid event passes Zod parse', () => {
    const parsed = parseTTPEvent(validEvent)
    expect(parsed).toMatchObject({
      TTP_version: TTP_VERSION,
      provider: 'openai',
      deployment: 'solo',
    })
  })

  it('safeParseTTPEvent returns success on valid event', () => {
    const result = safeParseTTPEvent(validEvent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.provider).toBe('openai')
    }
  })

  it('rejects missing required fields', () => {
    const invalid = { ...validEvent }
    delete (invalid as any).TTP_version
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('pii_asserted: true is rejected', () => {
    const invalid = {
      ...validEvent,
      governance: {
        ...validEvent.governance,
        pii_asserted: true,
      },
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('content_asserted: true is rejected', () => {
    const invalid = {
      ...validEvent,
      governance: {
        ...validEvent.governance,
        content_asserted: true,
      },
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('invalid provider types are rejected', () => {
    const invalid = { ...validEvent, provider: 'unknown_provider' }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('custom provider types are accepted', () => {
    const customEvent = {
      ...validEvent,
      provider: 'custom:myai',
    }
    const result = safeParseTTPEvent(customEvent)
    expect(result.success).toBe(true)
  })

  it('invalid custom provider format is rejected', () => {
    const invalid = {
      ...validEvent,
      provider: 'custom:_invalid', // starts with underscore (not allowed)
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('governance block validation requires all fields', () => {
    const invalid = {
      ...validEvent,
      governance: {
        consent_basis: 'org_policy',
        data_residency: 'AE',
        // missing retention_days, regulation_tags, pii_asserted, content_asserted
      },
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('event_id must be valid UUID', () => {
    const invalid = {
      ...validEvent,
      event_id: 'not-a-uuid',
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('schema_hash must start with sha256:', () => {
    const invalid = {
      ...validEvent,
      schema_hash: 'md5:abc123',
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('timestamps must be non-negative integers', () => {
    const invalid = {
      ...validEvent,
      timestamp: -1,
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('node_region must be 2-letter uppercase code', () => {
    const invalid = {
      ...validEvent,
      node_region: 'USA', // 3 letters
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('valid node_region is accepted', () => {
    const valid = {
      ...validEvent,
      node_region: 'US' as const,
    }
    const result = safeParseTTPEvent(valid)
    expect(result.success).toBe(true)
  })

  it('token_breakdown is optional', () => {
    const result = safeParseTTPEvent(validEvent)
    expect(result.success).toBe(true)
  })

  it('token_breakdown with valid breakdown is accepted', () => {
    const withBreakdown = {
      ...validEvent,
      token_breakdown: {
        prompt_tokens: 100,
        completion_tokens: 50,
        cached_tokens: 0,
        reasoning_tokens: 0,
      },
    }
    const result = safeParseTTPEvent(withBreakdown)
    expect(result.success).toBe(true)
  })

  it('token_breakdown with negative tokens is rejected', () => {
    const invalid = {
      ...validEvent,
      token_breakdown: {
        prompt_tokens: -1,
      },
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('optional latency_ms and ttfb_ms are accepted', () => {
    const withLatency = {
      ...validEvent,
      latency_ms: 250,
      ttfb_ms: 50,
    }
    const result = safeParseTTPEvent(withLatency)
    expect(result.success).toBe(true)
  })

  it('optional classification tags are accepted', () => {
    const withTags = {
      ...validEvent,
      dept_tag: 'engineering',
      project_tag: 'ml-platform',
      env_tag: 'production' as const,
      use_case_tag: 'inference',
    }
    const result = safeParseTTPEvent(withTags)
    expect(result.success).toBe(true)
  })

  it('org_node_id is optional', () => {
    const result = safeParseTTPEvent(validEvent)
    expect(result.success).toBe(true)
  })

  it('provider_version is optional', () => {
    const result = safeParseTTPEvent(validEvent)
    expect(result.success).toBe(true)
  })

  it('strict mode rejects extra fields', () => {
    const invalid = {
      ...validEvent,
      extra_field: 'not allowed',
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('parseTTPEvent throws on invalid input', () => {
    const invalid = { ...validEvent, event_id: 'invalid' }
    expect(() => parseTTPEvent(invalid)).toThrow()
  })

  it('direction enum is enforced', () => {
    const invalid = {
      ...validEvent,
      direction: 'invalid_direction',
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('all valid direction types are accepted', () => {
    const directions = ['request', 'response', 'stream_chunk', 'stream_end', 'error']
    for (const dir of directions) {
      const event = {
        ...validEvent,
        direction: dir,
      }
      const result = safeParseTTPEvent(event)
      expect(result.success).toBe(true)
    }
  })

  it('deployment enum is enforced', () => {
    const invalid = {
      ...validEvent,
      deployment: 'invalid_deployment',
    }
    const result = safeParseTTPEvent(invalid)
    expect(result.success).toBe(false)
  })

  it('all valid deployment types are accepted', () => {
    const deployments = ['solo', 'node', 'federated', 'open']
    for (const dep of deployments) {
      const event = {
        ...validEvent,
        deployment: dep,
      }
      const result = safeParseTTPEvent(event)
      expect(result.success).toBe(true)
    }
  })
})

describe('Governance Block Schema', () => {
  it('validates complete governance block', () => {
    const governance = {
      consent_basis: 'org_policy' as const,
      data_residency: 'AE',
      retention_days: 90,
      regulation_tags: ['UAE_AI_LAW', 'GDPR'],
      pii_asserted: false,
      content_asserted: false,
    }
    const result = GovernanceBlockSchema.safeParse(governance)
    expect(result.success).toBe(true)
  })

  it('accepts known regulation tags', () => {
    const governance = {
      consent_basis: 'legitimate_interest' as const,
      data_residency: 'US',
      retention_days: 30,
      regulation_tags: ['GDPR', 'CCPA', 'HIPAA'],
      pii_asserted: false,
      content_asserted: false,
    }
    const result = GovernanceBlockSchema.safeParse(governance)
    expect(result.success).toBe(true)
  })

  it('accepts custom regulation tags', () => {
    const governance = {
      consent_basis: 'explicit' as const,
      data_residency: 'EU',
      retention_days: 365,
      regulation_tags: ['custom:myregulation'],
      pii_asserted: false,
      content_asserted: false,
    }
    const result = GovernanceBlockSchema.safeParse(governance)
    expect(result.success).toBe(true)
  })

  it('rejects invalid custom regulation tag format', () => {
    const governance = {
      consent_basis: 'org_policy' as const,
      data_residency: 'AE',
      retention_days: 90,
      regulation_tags: ['custom: invalid'], // space in custom tag
      pii_asserted: false,
      content_asserted: false,
    }
    const result = GovernanceBlockSchema.safeParse(governance)
    expect(result.success).toBe(false)
  })

  it('accepts all consent basis values', () => {
    const bases = ['legitimate_interest', 'org_policy', 'explicit', 'not_applicable']
    for (const basis of bases) {
      const governance = {
        consent_basis: basis,
        data_residency: 'AE',
        retention_days: 90,
        regulation_tags: ['GDPR'],
        pii_asserted: false,
        content_asserted: false,
      }
      const result = GovernanceBlockSchema.safeParse(governance)
      expect(result.success).toBe(true)
    }
  })

  it('data_residency must be 2-8 characters', () => {
    const invalid = {
      consent_basis: 'org_policy',
      data_residency: 'A', // too short
      retention_days: 90,
      regulation_tags: ['GDPR'],
      pii_asserted: false,
      content_asserted: false,
    }
    const result = GovernanceBlockSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('retention_days can be -1 (indefinite)', () => {
    const governance = {
      consent_basis: 'org_policy' as const,
      data_residency: 'AE',
      retention_days: -1,
      regulation_tags: ['GDPR'],
      pii_asserted: false,
      content_asserted: false,
    }
    const result = GovernanceBlockSchema.safeParse(governance)
    expect(result.success).toBe(true)
  })

  it('rejects negative retention_days other than -1', () => {
    const invalid = {
      consent_basis: 'org_policy',
      data_residency: 'AE',
      retention_days: -2,
      regulation_tags: ['GDPR'],
      pii_asserted: false,
      content_asserted: false,
    }
    const result = GovernanceBlockSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('TTP Batch Schema', () => {
  const validBatch = {
    batch_id: '11111111-1111-4111-9111-111111111111',
    sent_at: Date.now(),
    events: [
      {
        TTP_version: TTP_VERSION,
        event_id: newEventId(),
        schema_hash: TTP_SCHEMA_HASH,
        timestamp: Date.now(),
        observed_at: Date.now(),
        emitter_id: 'scout-test',
        emitter_type: 'scout',
        session_hash: newSessionHash(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'response',
        payload_bytes: 1024,
        status_code: 200,
        estimated_tokens: 250,
        deployment: 'solo',
        governance: defaultUAEGovernance(),
      },
    ],
  }

  it('validates batch with single event', () => {
    const result = TTPBatchSchema.safeParse(validBatch)
    expect(result.success).toBe(true)
  })

  it('batch_id must be valid UUID', () => {
    const invalid = {
      ...validBatch,
      batch_id: 'not-uuid',
    }
    const result = TTPBatchSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('sent_at must be non-negative integer', () => {
    const invalid = {
      ...validBatch,
      sent_at: -1,
    }
    const result = TTPBatchSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('events array must have at least 1 event', () => {
    const invalid = {
      ...validBatch,
      events: [],
    }
    const result = TTPBatchSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('events array max 500 events', () => {
    const events = []
    for (let i = 0; i < 501; i++) {
      events.push({
        TTP_version: TTP_VERSION,
        event_id: newEventId(),
        schema_hash: TTP_SCHEMA_HASH,
        timestamp: Date.now(),
        observed_at: Date.now(),
        emitter_id: 'scout-test',
        emitter_type: 'scout',
        session_hash: newSessionHash(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'response',
        payload_bytes: 1024,
        status_code: 200,
        estimated_tokens: 250,
        deployment: 'solo',
        governance: defaultUAEGovernance(),
      })
    }
    const invalid = {
      ...validBatch,
      events,
    }
    const result = TTPBatchSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('batch accepts multiple valid events', () => {
    const batch = {
      ...validBatch,
      events: [validBatch.events[0], validBatch.events[0]],
    }
    const result = TTPBatchSchema.safeParse(batch)
    expect(result.success).toBe(true)
  })

  it('signature field is optional', () => {
    const result = TTPBatchSchema.safeParse(validBatch)
    expect(result.success).toBe(true)
  })

  it('strict mode rejects extra fields', () => {
    const invalid = {
      ...validBatch,
      extra_field: 'not allowed',
    }
    const result = TTPBatchSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})
