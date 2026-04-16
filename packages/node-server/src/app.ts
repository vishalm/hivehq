import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import pino from 'pino'
import { pinoHttp } from 'pino-http'
import {
  HATPBatchSchema,
  HATPEventSchema,
  type HATPEvent,
  type HATPIngestResponse,
  verifyBatch,
  type SignedBatchEnvelope,
} from '@hive/shared'
import type { PolicyEngine } from '@hive/policy'
import type { NodeEnv } from './env.js'
import { InMemoryEventStore, type EventStore } from './store.js'
import {
  recordIngest,
  recordError,
  recordCovenantViolation,
  renderMetrics,
} from './metrics.js'

export interface AppDeps {
  env: NodeEnv
  store?: EventStore
  logger?: pino.Logger
  /** Optional policy engine — runs admission control on each event. */
  policy?: PolicyEngine
  /**
   * Optional trust store for batch signatures — `kid → publicKey` (base64url DER).
   * When non-empty, signed envelopes are verified and unsigned batches are rejected.
   */
  trustStore?: Map<string, string>
}

export interface AppContext {
  app: Express
  store: EventStore
  logger: pino.Logger
}

export function buildApp(deps: AppDeps): AppContext {
  const logger = deps.logger ?? pino({ level: process.env['LOG_LEVEL'] ?? 'info' })
  const store = deps.store ?? new InMemoryEventStore()
  const startedAt = Date.now()

  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger }))

  // ── Health check — governance blocker B3 ──────────────────────────────────
  app.get('/health', async (_req, res) => {
    res.json({
      status: 'ok',
      uptime_ms: Date.now() - startedAt,
      region: deps.env.NODE_REGION,
      node_id: deps.env.NODE_ID ?? 'unspecified',
      events_ingested: await store.count(),
      policy: deps.policy?.name ?? null,
      trust_kids: deps.trustStore ? [...deps.trustStore.keys()] : [],
    })
  })

  app.get('/version', (_req, res) => {
    res.json({ name: '@hive/node-server', version: '0.1.0', hatp: '0.1' })
  })

  // ── Prometheus metrics ────────────────────────────────────────────────────
  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4')
    res.send(renderMetrics())
  })

  // ── HATP ingest ───────────────────────────────────────────────────────────
  app.post(
    '/api/v1/hatp/ingest',
    authenticate(deps.env),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const batchResult = HATPBatchSchema.safeParse(req.body)
        if (!batchResult.success) {
          recordError('batch_invalid')
          res.status(400).json({
            accepted: 0,
            rejected: 0,
            errors: [{ code: 'BATCH_INVALID', field: batchResult.error.issues[0]?.path.join('.') }],
            batch_id: '',
            ingested_at: Date.now(),
          } satisfies HATPIngestResponse)
          return
        }
        const batch = batchResult.data

        // ── Signature verification ─────────────────────────────────────────
        if (deps.trustStore && deps.trustStore.size > 0) {
          const envelope = req.body?.signature as SignedBatchEnvelope | undefined
          if (!envelope) {
            recordError('signature_missing')
            res.status(401).json({
              accepted: 0,
              rejected: batch.events.length,
              errors: [{ code: 'SIGNATURE_MISSING' }],
              batch_id: batch.batch_id,
              ingested_at: Date.now(),
            } satisfies HATPIngestResponse)
            return
          }
          const pubKey = deps.trustStore.get(envelope.kid)
          if (!pubKey) {
            recordError('unknown_kid')
            res.status(401).json({
              accepted: 0,
              rejected: batch.events.length,
              errors: [{ code: 'UNKNOWN_KID' }],
              batch_id: batch.batch_id,
              ingested_at: Date.now(),
            } satisfies HATPIngestResponse)
            return
          }
          const ok = verifyBatch(envelope, batch.events as HATPEvent[], pubKey)
          if (!ok) {
            recordError('signature_invalid')
            recordCovenantViolation('signature_invalid')
            res.status(401).json({
              accepted: 0,
              rejected: batch.events.length,
              errors: [{ code: 'SIGNATURE_INVALID' }],
              batch_id: batch.batch_id,
              ingested_at: Date.now(),
            } satisfies HATPIngestResponse)
            return
          }
        }

        const accepted: HATPEvent[] = []
        const errors: HATPIngestResponse['errors'] = []

        for (const raw of batch.events) {
          const parsed = HATPEventSchema.safeParse(raw)
          if (!parsed.success) {
            errors.push({
              event_id:
                typeof raw === 'object' && raw !== null && 'event_id' in raw
                  ? String((raw as { event_id: unknown }).event_id)
                  : undefined,
              code: 'SCHEMA_INVALID',
              field: parsed.error.issues[0]?.path.join('.'),
            })
            const field = parsed.error.issues[0]?.path.join('.') ?? ''
            if (field.includes('pii_asserted') || field.includes('content_asserted')) {
              recordCovenantViolation(field)
            }
            continue
          }
          // Governance enforcement: node_region must match when federated/open.
          if (
            (parsed.data.deployment === 'federated' || parsed.data.deployment === 'open') &&
            parsed.data.node_region &&
            parsed.data.node_region !== deps.env.NODE_REGION
          ) {
            errors.push({
              event_id: parsed.data.event_id,
              code: 'RESIDENCY_VIOLATION',
              field: 'node_region',
            })
            recordCovenantViolation('residency')
            continue
          }

          // ── Policy admission control ─────────────────────────────────────
          if (deps.policy) {
            const decision = deps.policy.evaluate(parsed.data)
            if (decision.decision === 'deny') {
              errors.push({
                event_id: parsed.data.event_id,
                code: 'POLICY_DENY',
                field: decision.matchedRuleId ?? 'policy',
              })
              recordCovenantViolation(`policy:${decision.matchedRuleId ?? 'unknown'}`)
              continue
            }
          }

          accepted.push(parsed.data)
        }
        if (accepted.length > 0) {
          await store.insert(accepted)
          recordIngest(accepted)
        }

        const response: HATPIngestResponse = {
          accepted: accepted.length,
          rejected: errors.length,
          errors,
          batch_id: batch.batch_id,
          ingested_at: Date.now(),
        }
        res.status(accepted.length === 0 && errors.length > 0 ? 400 : 200).json(response)
      } catch (err) {
        next(err)
      }
    },
  )

  // ── Read API (dashboard) ──────────────────────────────────────────────────
  app.get('/api/v1/events/recent', async (req, res) => {
    const limit = Math.min(Number(req.query['limit'] ?? 50), 500)
    res.json({ events: await store.recent(limit) })
  })

  app.get('/api/v1/rollups/aggregate', async (_req, res) => {
    res.json({ rows: await store.aggregate() })
  })

  // ── Error handler ─────────────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled error')
    res.status(500).json({ error: 'internal_error' })
  })

  return { app, store, logger }
}

function authenticate(env: NodeEnv) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!env.NODE_INGEST_TOKEN) {
      next()
      return
    }
    const header = req.header('authorization')
    if (header !== `Bearer ${env.NODE_INGEST_TOKEN}`) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    next()
  }
}
