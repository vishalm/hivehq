/**
 * HiveConnectorEvent — the minimal event emitted by a connector before
 * Scout enrichment. Connectors produce this; Scouts upgrade it to TTPEvent.
 */

import { z } from 'zod'
import { DirectionSchema } from './ttp.js'
import { AIProviderSchema } from './providers.js'
import { SignedBatchEnvelopeSchema } from './signatures-schema.js'

export const HiveConnectorEventSchema = z
  .object({
    timestamp: z.number().int().nonnegative(),
    provider: AIProviderSchema,
    endpoint: z.string().min(1),
    model_hint: z.string().min(1),
    direction: DirectionSchema,
    payload_bytes: z.number().int().nonnegative(),
    latency_ms: z.number().nonnegative().optional(),
    ttfb_ms: z.number().nonnegative().optional(),
    status_code: z.number().int(),
    session_hash: z.string().min(1),
  })
  .strict()

export type HiveConnectorEvent = z.infer<typeof HiveConnectorEventSchema>

/**
 * Batch envelope used by Scout → Node transport.
 */
export const TTPBatchSchema = z
  .object({
    batch_id: z.string().uuid(),
    sent_at: z.number().int().nonnegative(),
    events: z.array(z.unknown()).min(1).max(500),
    signature: SignedBatchEnvelopeSchema.optional(),
  })
  .strict()

export type TTPBatch = z.infer<typeof TTPBatchSchema>

export const TTPIngestResponseSchema = z
  .object({
    accepted: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    errors: z.array(
      z.object({
        event_id: z.string().optional(),
        code: z.string(),
        field: z.string().optional(),
        version: z.string().optional(),
      }),
    ),
    batch_id: z.string(),
    ingested_at: z.number().int().nonnegative(),
  })
  .strict()

export type TTPIngestResponse = z.infer<typeof TTPIngestResponseSchema>
