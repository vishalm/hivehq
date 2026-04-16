/**
 * Zod schema for SignedBatchEnvelope, split out from signatures.ts so it can
 * be referenced by telemetry.ts without pulling in node:crypto.
 */
import { z } from 'zod'
import { TTP_VERSION, TTP_SCHEMA_HASH } from './ttp.js'

export const SignedBatchEnvelopeSchema = z
  .object({
    TTP_version: z.literal(TTP_VERSION),
    schema_hash: z.literal(TTP_SCHEMA_HASH),
    events_digest: z.string().regex(/^[a-f0-9]{64}$/),
    signature: z.string().min(1),
    kid: z.string().min(1),
    signed_at: z.number().int().nonnegative(),
  })
  .strict()
