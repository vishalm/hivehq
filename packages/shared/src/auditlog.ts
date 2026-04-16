/**
 * Hash-chained audit log primitives.
 *
 * Each event in the audit log carries `prev_hash` and `event_hash`:
 *   event_hash_i = sha256(prev_hash_{i-1} || canonicalize(event_i))
 *
 * Tampering with any earlier event breaks the chain; daily Merkle roots
 * are published to anchor the log externally (git, transparency log, etc).
 *
 * This module is pure — no I/O. Storage backends use these helpers to
 * compute hashes consistently.
 */

import { createHash } from 'node:crypto'
import { canonicalize, type TTPEvent } from './ttp.js'

/** Genesis hash for the very first entry in any chain. */
export const GENESIS_HASH = '0'.repeat(64)

export interface ChainLink {
  event: TTPEvent
  /** sha256 hex of the previous link's event_hash. */
  prev_hash: string
  /** sha256 hex of (prev_hash || canonicalize(event)). */
  event_hash: string
  /** Monotonic sequence number within the chain. */
  seq: number
}

/**
 * Compute the event hash for a given (prev_hash, event) pair.
 */
export function computeEventHash(prevHash: string, event: TTPEvent): string {
  const h = createHash('sha256')
  h.update(prevHash)
  h.update('\n')
  h.update(canonicalize(event))
  return h.digest('hex')
}

/**
 * Extend a chain by appending one event. Returns the new link.
 * If `tail` is undefined, the chain is seeded from GENESIS.
 */
export function appendChain(tail: ChainLink | undefined, event: TTPEvent): ChainLink {
  const prev_hash = tail?.event_hash ?? GENESIS_HASH
  const seq = (tail?.seq ?? -1) + 1
  return {
    event,
    prev_hash,
    event_hash: computeEventHash(prev_hash, event),
    seq,
  }
}

/**
 * Verify an entire chain. Returns the first broken seq, or null if valid.
 */
export function verifyChain(chain: ChainLink[]): { ok: true } | { ok: false; brokenAt: number } {
  let prev = GENESIS_HASH
  for (let i = 0; i < chain.length; i++) {
    const link = chain[i]!
    if (link.seq !== i) return { ok: false, brokenAt: i }
    if (link.prev_hash !== prev) return { ok: false, brokenAt: i }
    if (link.event_hash !== computeEventHash(prev, link.event)) return { ok: false, brokenAt: i }
    prev = link.event_hash
  }
  return { ok: true }
}

// ── Merkle root for daily anchoring ──────────────────────────────────────────

function pairHash(a: string, b: string): string {
  const h = createHash('sha256')
  h.update(a)
  h.update(b)
  return h.digest('hex')
}

/**
 * Compute a Merkle root over a list of event_hashes.
 * Uses duplicate-last-leaf promotion (Bitcoin-style) for odd layers.
 */
export function merkleRoot(eventHashes: string[]): string {
  if (eventHashes.length === 0) return GENESIS_HASH
  let layer = [...eventHashes]
  while (layer.length > 1) {
    const next: string[] = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!
      const right = layer[i + 1] ?? left
      next.push(pairHash(left, right))
    }
    layer = next
  }
  return layer[0]!
}

/**
 * Daily anchor — one row per (region, day) summarising the chain state.
 */
export interface DailyAnchor {
  date: string // YYYY-MM-DD
  region: string
  seq_start: number
  seq_end: number
  merkle_root: string
  head_event_hash: string
  published_at: number
}
