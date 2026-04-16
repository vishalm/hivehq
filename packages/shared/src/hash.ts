/**
 * Hashing utilities for identity fields.
 *
 * scout_id, node_id, session_hash — all hashed. Never store personal
 * identifiers in plaintext. scout_id rotates monthly, preventing long-term
 * linking.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto'

/** SHA-256 → hex. Stable and collision-resistant enough for identity hashing. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** Short hash for session linking — not a security primitive, just a correlator. */
export function shortHash(input: string): string {
  return sha256Hex(input).slice(0, 16)
}

/**
 * Returns a YYYY-MM month key for scout_id rotation.
 */
export function currentRotationPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Derive a rotating scout_id from a stable device fingerprint and a salt.
 * Rotates monthly so the same device is unlinkable across months.
 */
export function deriveScoutId(deviceFingerprint: string, salt: string, now: Date = new Date()): string {
  const period = currentRotationPeriod(now)
  return sha256Hex(`${deviceFingerprint}:${salt}:${period}`)
}

/** Fresh session hash — links a request to its response pair, nothing more. */
export function newSessionHash(): string {
  return shortHash(`${Date.now()}:${randomBytes(16).toString('hex')}`)
}

/** Fresh event id. */
export function newEventId(): string {
  return randomUUID()
}
