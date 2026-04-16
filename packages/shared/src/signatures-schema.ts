/**
 * Zod schema for SignedBatchEnvelope, split out from signatures.ts so it can
 * be referenced by telemetry.ts without pulling in node:crypto.
 */
import { z } from 'zod'
import { HATP_VERSION, HATP_SCHEMA_HASH } from './hatp.js'

export const SignedBatchEnvelopeSchema = z
  .object({
    hatp_version: z.literal(HATP_VERSION),
    schema_hash: z.literal(HATP_SCHEMA_HASH),
    events_digest: z.string().regex(/^[a-f0-9]{64}$/),
    signature: z.string().min(1),
    kid: z.string().min(1),
    signed_at: z.number().int().nonnegative(),
  })
  .strict()
