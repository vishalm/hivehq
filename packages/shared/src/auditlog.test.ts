import { describe, it, expect } from 'vitest'
import { HATP_VERSION, HATP_SCHEMA_HASH, type HATPEvent } from './hatp.js'
import { appendChain, verifyChain, merkleRoot, GENESIS_HASH } from './auditlog.js'

function evt(id: string, tokens = 1): HATPEvent {
  return {
    hatp_version: HATP_VERSION,
    event_id: id,
    schema_hash: HATP_SCHEMA_HASH,
    timestamp: 1,
    observed_at: 2,
    emitter_id: 'e',
    emitter_type: 'scout',
    session_hash: 'sess',
    provider: 'openai',
    endpoint: 'x',
    model_hint: 'm',
    direction: 'response',
    payload_bytes: 1,
    status_code: 200,
    estimated_tokens: tokens,
    deployment: 'solo',
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

describe('audit log hash chain', () => {
  it('genesis link starts from all-zero hash', () => {
    const link = appendChain(undefined, evt('11111111-1111-1111-1111-111111111111'))
    expect(link.prev_hash).toBe(GENESIS_HASH)
    expect(link.seq).toBe(0)
    expect(link.event_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('chains link-to-link', () => {
    const a = appendChain(undefined, evt('11111111-1111-1111-1111-111111111111'))
    const b = appendChain(a, evt('22222222-2222-2222-2222-222222222222'))
    const c = appendChain(b, evt('33333333-3333-3333-3333-333333333333'))
    expect(b.prev_hash).toBe(a.event_hash)
    expect(c.prev_hash).toBe(b.event_hash)
    expect(verifyChain([a, b, c])).toEqual({ ok: true })
  })

  it('detects tampering', () => {
    const a = appendChain(undefined, evt('11111111-1111-1111-1111-111111111111', 10))
    const b = appendChain(a, evt('22222222-2222-2222-2222-222222222222', 20))
    const tampered = { ...a, event: { ...a.event, estimated_tokens: 9999 } }
    expect(verifyChain([tampered, b])).toEqual({ ok: false, brokenAt: 0 })
  })

  it('merkle root is deterministic and handles odd counts', () => {
    const root1 = merkleRoot(['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)])
    const root2 = merkleRoot(['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)])
    expect(root1).toBe(root2)
    expect(merkleRoot([])).toBe(GENESIS_HASH)
    expect(merkleRoot(['a'.repeat(64)])).toBe('a'.repeat(64))
  })
})
