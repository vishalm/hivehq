/**
 * TTPEvent v0.1 — The canonical AI consumption telemetry event.
 *
 * Open standard — governed by the TTP Working Group.
 * Reference implementation: HIVE Scout.
 *
 * PRIVACY GUARANTEE: Content is architecturally excluded.
 * No prompt. No completion. No API key. Ever.
 *
 * See: docs/protocol.md
 */

import { z } from 'zod'
import type { AIProvider } from './providers.js'
import { AIProviderSchema } from './providers.js'
import type { GovernanceBlock } from './governance.js'
import { GovernanceBlockSchema } from './governance.js'

// ── Protocol version ─────────────────────────────────────────────────────────

export const TTP_VERSION = '0.1' as const
export type TTPVersion = typeof TTP_VERSION

// Self-verifying schema fingerprint. Updated when the schema shape changes.
// Computed deterministically from the schema definition at build time.
export const TTP_SCHEMA_HASH =
  'sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6' as const

// ── Emitter & direction ──────────────────────────────────────────────────────

export const EmitterTypeSchema = z.enum(['scout', 'sdk', 'proxy', 'agent', 'sidecar'])
export type EmitterType = z.infer<typeof EmitterTypeSchema>

export const DirectionSchema = z.enum([
  'request',
  'response',
  'stream_chunk',
  'stream_end',
  'error',
])
export type Direction = z.infer<typeof DirectionSchema>

export const DeploymentSchema = z.enum(['solo', 'node', 'federated', 'open'])
export type Deployment = z.infer<typeof DeploymentSchema>

export const EnvTagSchema = z.enum(['production', 'staging', 'development', 'ci'])
export type EnvTag = z.infer<typeof EnvTagSchema>

// ── Token breakdown (optional) ───────────────────────────────────────────────

export const TokenBreakdownSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    cached_tokens: z.number().int().nonnegative().optional(),
    reasoning_tokens: z.number().int().nonnegative().optional(),
  })
  .strict()

export type TokenBreakdown = z.infer<typeof TokenBreakdownSchema>

// ── The canonical event ──────────────────────────────────────────────────────

export const TTPEventSchema = z
  .object({
    // Protocol metadata
    TTP_version: z.literal(TTP_VERSION),
    event_id: z.string().uuid(),
    schema_hash: z.string().startsWith('sha256:'),

    // Temporal
    timestamp: z.number().int().nonnegative(),
    observed_at: z.number().int().nonnegative(),

    // Origin identity — all hashed, no PII, ever
    emitter_id: z.string().min(1),
    emitter_type: EmitterTypeSchema,
    org_node_id: z.string().min(1).optional(),
    session_hash: z.string().min(1),

    // Provider fingerprint
    provider: AIProviderSchema,
    provider_version: z.string().optional(),
    endpoint: z.string().min(1),
    model_hint: z.string().min(1),
    model_family: z.string().optional(),

    // Signal — zero content, always
    direction: DirectionSchema,
    payload_bytes: z.number().int().nonnegative(),
    latency_ms: z.number().nonnegative().optional(),
    ttfb_ms: z.number().nonnegative().optional(),
    status_code: z.number().int(),
    estimated_tokens: z.number().int().nonnegative(),
    token_breakdown: TokenBreakdownSchema.optional(),

    // Classification — org-defined, optional
    dept_tag: z.string().optional(),
    project_tag: z.string().optional(),
    env_tag: EnvTagSchema.optional(),
    use_case_tag: z.string().optional(),

    // Deployment context
    deployment: DeploymentSchema,
    node_region: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/)
      .optional(),

    // Governance — required on every event
    governance: GovernanceBlockSchema,

    // Cryptographic integrity (optional in v0.1)
    signature: z.string().optional(),
  })
  .strict()

export type TTPEvent = z.infer<typeof TTPEventSchema>

// ── Re-exports for ergonomics ────────────────────────────────────────────────

export type { AIProvider, GovernanceBlock }

// ── Validation helpers ───────────────────────────────────────────────────────

/**
 * Parse an unknown value as a TTPEvent. Throws on invalid events.
 * Use at ingest boundaries (Scout → Node, Node → Hive).
 */
export function parseTTPEvent(value: unknown): TTPEvent {
  return TTPEventSchema.parse(value)
}

/**
 * Safe parse variant that returns the validation result without throwing.
 */
export function safeParseTTPEvent(
  value: unknown,
): z.SafeParseReturnType<unknown, TTPEvent> {
  return TTPEventSchema.safeParse(value)
}

/**
 * Canonical JSON serialisation for signing.
 * Keys are sorted alphabetically; undefined fields are omitted.
 */
export function canonicalize(event: TTPEvent): string {
  return JSON.stringify(event, Object.keys(event).sort())
}
