import { describe, it, expect } from 'vitest'
import { HATP_VERSION, HATP_SCHEMA_HASH } from './hatp.js'
import type { HATPEvent } from './hatp.js'
import { generateSigningKeypair, signBatch, verifyBatch, eventsDigest } from './signatures.js'

function buildEvent(eventId: string, tokens = 10): HATPEvent {
  return {
    hatp_version: HATP_VERSION,
    event_id: eventId,
    schema_hash: HATP_SCHEMA_HASH,
    timestamp: 1_700_000_000_000,
    observed_at: 1_700_000_000_001,
    emitter_id: 'scout-abc',
    emitter_type: 'scout',
    session_hash: 'sess-abc',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model_hint: 'gpt-4',
    direction: 'response',
    payload_bytes: 128,
    status_code: 200,
    estimated_tokens: tokens,
    deployment: 'node',
    governance: {
      consent_basis: 'org_policy',
      data_residency: 'AE',
      retention_days: 30,
      regulation_tags: ['UAE_AI_LAW'],
      pii_asserted: false,
      content_asserted: false,
    },
  }
}

describe('HATP batch signatures', () => {
  it('round-trips sign and verify', () => {
    const kp = generateSigningKeypair()
    const events = [
      buildEvent('11111111-1111-1111-1111-111111111111'),
      buildEvent('22222222-2222-2222-2222-222222222222', 20),
    ]
    const envelope = signBatch(events, kp)
    expect(envelope.kid).toBe(kp.kid)
    expect(envelope.events_digest).toMatch(/^[a-f0-9]{64}$/)
    expect(verifyBatch(envelope, events, kp.publicKey)).toBe(true)
  })

  it('rejects tampered events', () => {
    const kp = generateSigningKeypair()
    const events = [buildEvent('11111111-1111-1111-1111-111111111111', 10)]
    const envelope = signBatch(events, kp)
    const tampered = [{ ...events[0]!, estimated_tokens: 9999 }]
    expect(verifyBatch(envelope, tampered, kp.publicKey)).toBe(false)
  })

  it('rejects wrong public key', () => {
    const kpA = generateSigningKeypair()
    const kpB = generateSigningKeypair()
    const events = [buildEvent('11111111-1111-1111-1111-111111111111')]
    const envelope = signBatch(events, kpA)
    expect(verifyBatch(envelope, events, kpB.publicKey)).toBe(false)
  })

  it('events_digest is order-independent', () => {
    const a = buildEvent('11111111-1111-1111-1111-111111111111')
    const b = buildEvent('22222222-2222-2222-2222-222222222222', 20)
    expect(eventsDigest([a, b])).toBe(eventsDigest([b, a]))
  })
})
