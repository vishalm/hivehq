/**
 * TTP batch signatures — Ed25519 provenance.
 *
 * Every TTP batch SHOULD be signed by the emitting Scout or Node.
 * Verification is REQUIRED at federation boundaries (Node → Hive).
 *
 * We use Ed25519 for:
 *  - deterministic signatures (no nonce → no leak risk)
 *  - tiny keys and signatures (32B pub / 64B sig)
 *  - universal library support
 *
 * Signing surface is the canonical UTF-8 bytes of:
 *   `${TTP_VERSION}.${schema_hash}.${sha256(events_canonical)}`
 *
 * The receiver recomputes the sha256 of canonicalised events and verifies
 * against the sender's published Ed25519 public key.
 */

import { createHash, generateKeyPairSync, sign as nodeSign, verify as nodeVerify } from 'node:crypto'
import { TTP_VERSION, TTP_SCHEMA_HASH, canonicalize, type TTPEvent } from './ttp.js'

export interface TTPKeypair {
  /** Ed25519 public key, 32 bytes base64url-encoded. */
  publicKey: string
  /** Ed25519 private key, PKCS8 PEM. Keep secret. */
  privateKey: string
  /** Stable identifier for rotation + JWKS lookup. */
  kid: string
}

export interface SignedBatchEnvelope {
  TTP_version: typeof TTP_VERSION
  schema_hash: typeof TTP_SCHEMA_HASH
  /** sha256 of sorted canonical events, hex. */
  events_digest: string
  /** Ed25519 signature over `${version}.${schema_hash}.${events_digest}`, base64url. */
  signature: string
  /** Key identifier — receiver looks this up in its trust store. */
  kid: string
  /** UTC unix millis — bounds replay windows. */
  signed_at: number
}

// ── Keypair generation ───────────────────────────────────────────────────────

/**
 * Generate a fresh Ed25519 keypair for batch signing.
 * `kid` is a short hex fingerprint derived from the public key.
 */
export function generateSigningKeypair(): TTPKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const rawPublic = publicKey.export({ format: 'der', type: 'spki' })
  const rawPrivate = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string
  const kid = createHash('sha256').update(rawPublic).digest('hex').slice(0, 16)
  return {
    publicKey: rawPublic.toString('base64url'),
    privateKey: rawPrivate,
    kid,
  }
}

// ── Canonical digest ─────────────────────────────────────────────────────────

/**
 * Compute the sha256 digest over a batch of events.
 * Events are canonicalized individually, then their canonical forms are
 * sorted lexicographically so the digest is independent of batch order.
 */
export function eventsDigest(events: TTPEvent[]): string {
  const canonicalEvents = events.map(canonicalize).sort()
  const hash = createHash('sha256')
  for (const c of canonicalEvents) {
    hash.update(c)
    hash.update('\n')
  }
  return hash.digest('hex')
}

// ── Sign / Verify ────────────────────────────────────────────────────────────

function signingSurface(digest: string): Buffer {
  return Buffer.from(`${TTP_VERSION}.${TTP_SCHEMA_HASH}.${digest}`, 'utf8')
}

/**
 * Sign a batch of TTP events with an Ed25519 private key (PKCS8 PEM).
 */
export function signBatch(events: TTPEvent[], keypair: TTPKeypair): SignedBatchEnvelope {
  const digest = eventsDigest(events)
  const signature = nodeSign(null, signingSurface(digest), {
    key: keypair.privateKey,
    format: 'pem',
    type: 'pkcs8',
  })
  return {
    TTP_version: TTP_VERSION,
    schema_hash: TTP_SCHEMA_HASH,
    events_digest: digest,
    signature: signature.toString('base64url'),
    kid: keypair.kid,
    signed_at: Date.now(),
  }
}

/**
 * Verify a signed batch envelope against a trusted public key (base64url DER).
 * Returns `true` only if the signature is valid AND the recomputed events
 * digest matches what was signed.
 */
export function verifyBatch(
  envelope: SignedBatchEnvelope,
  events: TTPEvent[],
  trustedPublicKey: string,
): boolean {
  if (envelope.TTP_version !== TTP_VERSION) return false
  if (envelope.schema_hash !== TTP_SCHEMA_HASH) return false
  const recomputed = eventsDigest(events)
  if (recomputed !== envelope.events_digest) return false

  try {
    const publicKeyDer = Buffer.from(trustedPublicKey, 'base64url')
    const signature = Buffer.from(envelope.signature, 'base64url')
    return nodeVerify(
      null,
      signingSurface(envelope.events_digest),
      {
        key: publicKeyDer,
        format: 'der',
        type: 'spki',
      },
      signature,
    )
  } catch {
    return false
  }
}

// ── Public key export for JWKS-lite trust stores ─────────────────────────────

export interface PublishedKey {
  kid: string
  alg: 'EdDSA'
  crv: 'Ed25519'
  publicKey: string // base64url DER
  issued_at: number
  not_after?: number
}

export function publishKey(keypair: TTPKeypair, ttlDays = 180): PublishedKey {
  const now = Date.now()
  return {
    kid: keypair.kid,
    alg: 'EdDSA',
    crv: 'Ed25519',
    publicKey: keypair.publicKey,
    issued_at: now,
    not_after: now + ttlDays * 24 * 60 * 60 * 1000,
  }
}
