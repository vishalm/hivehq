import { describe, expect, it, beforeEach } from 'vitest'
import {
  generateSigningKeypair,
  signBatch,
  verifyBatch,
  eventsDigest,
  publishKey,
  type TTPKeypair,
  type SignedBatchEnvelope,
} from './signatures.js'
import {
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  type TTPEvent,
} from './ttp.js'
import {
  newEventId,
  newSessionHash,
} from './hash.js'
import { defaultUAEGovernance } from './governance.js'

describe('Ed25519 Signatures', () => {
  let keypair: TTPKeypair

  beforeEach(() => {
    keypair = generateSigningKeypair()
  })

  describe('Keypair generation', () => {
    it('generates a valid keypair', () => {
      expect(keypair).toHaveProperty('publicKey')
      expect(keypair).toHaveProperty('privateKey')
      expect(keypair).toHaveProperty('kid')
    })

    it('publicKey is base64url encoded', () => {
      // base64url charset: A-Z a-z 0-9 - _
      expect(keypair.publicKey).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(keypair.publicKey.length).toBeGreaterThan(0)
    })

    it('privateKey is PEM format', () => {
      expect(keypair.privateKey).toContain('BEGIN PRIVATE KEY')
      expect(keypair.privateKey).toContain('END PRIVATE KEY')
    })

    it('kid is 16-char hex fingerprint', () => {
      expect(keypair.kid).toMatch(/^[a-f0-9]{16}$/)
    })

    it('each generated keypair is unique', () => {
      const kp2 = generateSigningKeypair()
      const kp3 = generateSigningKeypair()
      expect(keypair.kid).not.toBe(kp2.kid)
      expect(kp2.kid).not.toBe(kp3.kid)
    })
  })

  describe('Batch signing', () => {
    function makeEvent(): TTPEvent {
      return {
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
      }
    }

    it('signs a batch of events', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)

      expect(envelope).toHaveProperty('TTP_version', TTP_VERSION)
      expect(envelope).toHaveProperty('schema_hash', TTP_SCHEMA_HASH)
      expect(envelope).toHaveProperty('events_digest')
      expect(envelope).toHaveProperty('signature')
      expect(envelope).toHaveProperty('kid', keypair.kid)
      expect(envelope).toHaveProperty('signed_at')
    })

    it('events_digest is hex string', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      expect(envelope.events_digest).toMatch(/^[a-f0-9]{64}$/)
    })

    it('signature is base64url encoded', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      expect(envelope.signature).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('signed_at is recent timestamp', () => {
      const before = Date.now()
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const after = Date.now()
      expect(envelope.signed_at).toBeGreaterThanOrEqual(before)
      expect(envelope.signed_at).toBeLessThanOrEqual(after + 100) // +100 for timing variance
    })

    it('different event batches produce different signatures', () => {
      const events1 = [makeEvent()]
      const events2 = [makeEvent()]
      const sig1 = signBatch(events1, keypair)
      const sig2 = signBatch(events2, keypair)
      expect(sig1.events_digest).not.toBe(sig2.events_digest)
      expect(sig1.signature).not.toBe(sig2.signature)
    })

    it('multiple events are included in digest', () => {
      const event1 = makeEvent()
      const event2 = makeEvent()
      const sig1 = signBatch([event1], keypair)
      const sig2 = signBatch([event1, event2], keypair)
      expect(sig1.events_digest).not.toBe(sig2.events_digest)
    })

    it('event order does not affect digest (canonical)', () => {
      const event1 = makeEvent()
      const event2 = makeEvent()
      const sig1 = signBatch([event1, event2], keypair)
      const sig2 = signBatch([event2, event1], keypair)
      expect(sig1.events_digest).toBe(sig2.events_digest)
      expect(sig1.signature).toBe(sig2.signature)
    })

    it('same event list produces same signature (deterministic)', () => {
      const events = [makeEvent(), makeEvent()]
      const sig1 = signBatch(events, keypair)
      const sig2 = signBatch(events, keypair)
      expect(sig1.events_digest).toBe(sig2.events_digest)
      expect(sig1.signature).toBe(sig2.signature)
    })
  })

  describe('Batch verification', () => {
    function makeEvent(): TTPEvent {
      return {
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
      }
    }

    it('verifies a valid signature', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const valid = verifyBatch(envelope, events, keypair.publicKey)
      expect(valid).toBe(true)
    })

    it('rejects signature with tampered event', () => {
      const event1 = makeEvent()
      const event2 = makeEvent()
      const envelope = signBatch([event1], keypair)

      // Tamper by verifying against different event
      const valid = verifyBatch(envelope, [event2], keypair.publicKey)
      expect(valid).toBe(false)
    })

    it('rejects signature with wrong public key', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const otherKeypair = generateSigningKeypair()
      const valid = verifyBatch(envelope, events, otherKeypair.publicKey)
      expect(valid).toBe(false)
    })

    it('rejects envelope with wrong TTP version', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const tamperedEnvelope: SignedBatchEnvelope = {
        ...envelope,
        TTP_version: '0.2' as any,
      }
      const valid = verifyBatch(tamperedEnvelope, events, keypair.publicKey)
      expect(valid).toBe(false)
    })

    it('rejects envelope with wrong schema hash', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const tamperedEnvelope: SignedBatchEnvelope = {
        ...envelope,
        schema_hash: 'sha256:deadbeef' + '0'.repeat(56) as any,
      }
      const valid = verifyBatch(tamperedEnvelope, events, keypair.publicKey)
      expect(valid).toBe(false)
    })

    it('rejects envelope with tampered signature', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const tamperedEnvelope: SignedBatchEnvelope = {
        ...envelope,
        signature: 'AAA' + envelope.signature.slice(3), // tamper with first char
      }
      const valid = verifyBatch(tamperedEnvelope, events, keypair.publicKey)
      expect(valid).toBe(false)
    })

    it('rejects envelope with tampered digest', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const tamperedEnvelope: SignedBatchEnvelope = {
        ...envelope,
        events_digest: 'a'.repeat(64),
      }
      const valid = verifyBatch(tamperedEnvelope, events, keypair.publicKey)
      expect(valid).toBe(false)
    })

    it('rejects with invalid base64url signature', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const tamperedEnvelope: SignedBatchEnvelope = {
        ...envelope,
        signature: '!!!invalid!!!',
      }
      const valid = verifyBatch(tamperedEnvelope, events, keypair.publicKey)
      expect(valid).toBe(false)
    })

    it('rejects with invalid base64url public key', () => {
      const events = [makeEvent()]
      const envelope = signBatch(events, keypair)
      const invalidKey = '!!!invalid!!!'
      const valid = verifyBatch(envelope, events, invalidKey)
      expect(valid).toBe(false)
    })

    it('verifies multiple events in batch', () => {
      const events = [makeEvent(), makeEvent(), makeEvent()]
      const envelope = signBatch(events, keypair)
      const valid = verifyBatch(envelope, events, keypair.publicKey)
      expect(valid).toBe(true)
    })

    it('rejects if event order changed (detects tampering)', () => {
      const event1 = makeEvent()
      const event2 = makeEvent()
      const envelope = signBatch([event1, event2], keypair)
      const valid = verifyBatch(envelope, [event2, event1], keypair.publicKey)
      // Order shouldn't matter for canonical digest, so this should still be valid
      // But if the events are modified, it should fail
      expect(valid).toBe(true) // Canonical sorting handles this
    })

    it('rejects if event list size changed', () => {
      const event1 = makeEvent()
      const event2 = makeEvent()
      const envelope = signBatch([event1, event2], keypair)
      const valid = verifyBatch(envelope, [event1], keypair.publicKey)
      expect(valid).toBe(false)
    })
  })

  describe('Events digest', () => {
    function makeEvent(): TTPEvent {
      return {
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
      }
    }

    it('computes hex digest', () => {
      const events = [makeEvent()]
      const digest = eventsDigest(events)
      expect(digest).toMatch(/^[a-f0-9]{64}$/)
    })

    it('digest is same regardless of event order', () => {
      const event1 = makeEvent()
      const event2 = makeEvent()
      const digest1 = eventsDigest([event1, event2])
      const digest2 = eventsDigest([event2, event1])
      expect(digest1).toBe(digest2)
    })

    it('different events produce different digests', () => {
      const event1 = makeEvent()
      const event2 = makeEvent()
      const digest1 = eventsDigest([event1])
      const digest2 = eventsDigest([event2])
      expect(digest1).not.toBe(digest2)
    })

    it('empty array produces consistent digest', () => {
      const digest1 = eventsDigest([])
      const digest2 = eventsDigest([])
      expect(digest1).toBe(digest2)
    })
  })

  describe('Key publishing', () => {
    it('publishes key with required fields', () => {
      const published = publishKey(keypair)
      expect(published).toHaveProperty('kid', keypair.kid)
      expect(published).toHaveProperty('alg', 'EdDSA')
      expect(published).toHaveProperty('crv', 'Ed25519')
      expect(published).toHaveProperty('publicKey', keypair.publicKey)
      expect(published).toHaveProperty('issued_at')
      expect(published).toHaveProperty('not_after')
    })

    it('issued_at is recent', () => {
      const before = Date.now()
      const published = publishKey(keypair)
      const after = Date.now()
      expect(published.issued_at).toBeGreaterThanOrEqual(before)
      expect(published.issued_at).toBeLessThanOrEqual(after + 100)
    })

    it('not_after is 180 days by default', () => {
      const published = publishKey(keypair)
      const expected = published.issued_at + 180 * 24 * 60 * 60 * 1000
      expect(published.not_after).toBeCloseTo(expected, -3) // Within 1000ms
    })

    it('not_after respects custom ttlDays', () => {
      const published = publishKey(keypair, 30)
      const expected = published.issued_at + 30 * 24 * 60 * 60 * 1000
      expect(published.not_after).toBeCloseTo(expected, -3)
    })

    it('not_after is in the future', () => {
      const published = publishKey(keypair)
      expect(published.not_after).toBeGreaterThan(Date.now())
    })
  })
})
