import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import pino from 'pino'
import { pinoHttp } from 'pino-http'
import {
  TTPBatchSchema,
  TTPEventSchema,
  type TTPEvent,
  type TTPIngestResponse,
  verifyBatch,
  type SignedBatchEnvelope,
} from '@hive/shared'
import {
  KeycloakClient,
  createAuthMiddleware,
  requireRole,
  loadAuthEnv,
  type AuthEnv,
  type AuthMiddlewareConfig,
} from '@hive/auth'
import type { PolicyEngine } from '@hive/policy'
import type { NodeEnv } from './env.js'
import { InMemoryEventStore, type EventStore } from './store.js'
import { ConfigStore, type HiveConfig } from './config-store.js'
import {
  estimateBatchCost,
  detectAnomalies,
  forecastSpend,
  clusterBehavior,
  analyzeFlows,
  fingerprintByDept,
  fingerprintByProject,
} from '@hive/intelligence'
import {
  recordIngest,
  recordError,
  recordCovenantViolation,
  renderMetrics,
} from './metrics.js'
import { mountSwagger } from './swagger.js'

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
  const configStore = new ConfigStore()
  const startedAt = Date.now()

  // Load config on startup
  void configStore.load().catch(() => {/* use defaults */})

  // ── Auth setup ──────────────────────────────────────────────────────────
  let authEnv: AuthEnv
  try {
    authEnv = loadAuthEnv(process.env)
  } catch {
    // Fall back to no-auth if env is incomplete (dev/test mode)
    authEnv = {
      HIVE_AUTH_MODE: 'none',
      HIVE_DEPLOYMENT_MODE: 'bespoke',
      KEYCLOAK_REALM: 'hive',
      KEYCLOAK_CLIENT_ID: 'hive-api',
    }
    logger.warn('Auth env incomplete — running in no-auth mode')
  }

  let keycloak: KeycloakClient | undefined
  if (authEnv.HIVE_AUTH_MODE === 'keycloak' && authEnv.KEYCLOAK_URL) {
    try {
      keycloak = new KeycloakClient(authEnv)
      logger.info({ realm: authEnv.KEYCLOAK_REALM, url: authEnv.KEYCLOAK_URL }, 'Keycloak client initialized')
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize Keycloak client — falling back to no-auth')
    }
  }

  const authConfig: AuthMiddlewareConfig = {
    env: authEnv,
    keycloak,
    // API key resolution will be wired up when DB is available
  }

  const authMiddleware = createAuthMiddleware(authConfig)

  const app = express()
  app.disable('x-powered-by')

  // ── CORS — allow dashboard (different port) to reach the API ──────────────
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return }
    next()
  })

  app.use(express.json({ limit: '2mb' }))
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      recordError('json_parse_error')
      res.status(400).json({
        accepted: 0,
        rejected: 0,
        errors: [{ code: 'MALFORMED_JSON', field: 'body' }],
        batch_id: '',
        ingested_at: Date.now(),
      } satisfies TTPIngestResponse)
      return
    }
    next(err)
  })
  app.use(pinoHttp({ logger }))

  // ── Swagger UI at /api/docs ──────────────────────────────────────────────
  mountSwagger(app)

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC ROUTES — no auth required
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/health', async (_req, res) => {
    res.json({
      status: 'ok',
      uptime_ms: Date.now() - startedAt,
      region: deps.env.NODE_REGION,
      node_id: deps.env.NODE_ID ?? 'unspecified',
      events_ingested: await store.count(),
      auth_mode: authEnv.HIVE_AUTH_MODE,
      deployment_mode: authEnv.HIVE_DEPLOYMENT_MODE,
      policy: deps.policy?.name ?? null,
      trust_kids: deps.trustStore ? [...deps.trustStore.keys()] : [],
    })
  })

  app.get('/version', (_req, res) => {
    res.json({ name: '@hive/node-server', version: '0.1.0', TTP: '0.1' })
  })

  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4')
    res.send(renderMetrics())
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // TTP INGEST — API key or legacy token auth
  // ═══════════════════════════════════════════════════════════════════════════

  app.post(
    '/api/v1/ttp/ingest',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const batchResult = TTPBatchSchema.safeParse(req.body)
        if (!batchResult.success) {
          recordError('batch_invalid')
          res.status(400).json({
            accepted: 0,
            rejected: 0,
            errors: [{ code: 'BATCH_INVALID', field: batchResult.error.issues[0]?.path.join('.') }],
            batch_id: '',
            ingested_at: Date.now(),
          } satisfies TTPIngestResponse)
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
            } satisfies TTPIngestResponse)
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
            } satisfies TTPIngestResponse)
            return
          }
          const ok = verifyBatch(envelope, batch.events as TTPEvent[], pubKey)
          if (!ok) {
            recordError('signature_invalid')
            recordCovenantViolation('signature_invalid')
            res.status(401).json({
              accepted: 0,
              rejected: batch.events.length,
              errors: [{ code: 'SIGNATURE_INVALID' }],
              batch_id: batch.batch_id,
              ingested_at: Date.now(),
            } satisfies TTPIngestResponse)
            return
          }
        }

        const accepted: TTPEvent[] = []
        const errors: TTPIngestResponse['errors'] = []

        for (const raw of batch.events) {
          const parsed = TTPEventSchema.safeParse(raw)
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

        const response: TTPIngestResponse = {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PROTECTED ROUTES — viewer+ (OIDC or API key)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Read API (dashboard) ──────────────────────────────────────────────────
  app.get('/api/v1/events/recent', authMiddleware, requireRole('viewer'), async (req, res) => {
    const limit = Math.min(Number(req.query['limit'] ?? 50), 500)
    res.json({ events: await store.recent(limit) })
  })

  app.get('/api/v1/rollups/aggregate', authMiddleware, requireRole('viewer'), async (_req, res) => {
    res.json({ rows: await store.aggregate() })
  })

  // ── Intelligence API — viewer+ ────────────────────────────────────────────
  app.get('/api/v1/intelligence/cost', authMiddleware, requireRole('viewer'), async (req, res) => {
    const limit = Math.min(Number(req.query['limit'] ?? 500), 2000)
    const events = await store.recent(limit)
    const cost = estimateBatchCost(events)
    res.json(cost)
  })

  app.get('/api/v1/intelligence/anomalies', authMiddleware, requireRole('viewer'), async (req, res) => {
    const limit = Math.min(Number(req.query['limit'] ?? 500), 2000)
    const events = await store.recent(limit)
    const anomalies = detectAnomalies(events)
    res.json({ anomalies, analyzedEvents: events.length })
  })

  app.get('/api/v1/intelligence/forecast', authMiddleware, requireRole('viewer'), async (req, res) => {
    const limit = Math.min(Number(req.query['limit'] ?? 1000), 5000)
    const horizon = Math.min(Number(req.query['horizon'] ?? 90), 365)
    const events = await store.recent(limit)
    const forecast = forecastSpend(events, { horizonDays: horizon })
    res.json(forecast ?? { error: 'insufficient_data', message: 'Need at least 3 days of data for forecasting.' })
  })

  app.get('/api/v1/intelligence/clusters', authMiddleware, requireRole('viewer'), async (req, res) => {
    const limit = Math.min(Number(req.query['limit'] ?? 500), 2000)
    const events = await store.recent(limit)
    const clusters = clusterBehavior(events)
    const flows = analyzeFlows(events)
    res.json({ clusters, flows, analyzedEvents: events.length })
  })

  app.get('/api/v1/intelligence/fingerprints', authMiddleware, requireRole('viewer'), async (req, res) => {
    const limit = Math.min(Number(req.query['limit'] ?? 500), 2000)
    const groupBy = req.query['groupBy'] ?? 'dept'
    const events = await store.recent(limit)
    const fingerprints = groupBy === 'project'
      ? fingerprintByProject(events)
      : fingerprintByDept(events)
    res.json({ fingerprints, groupBy, analyzedEvents: events.length })
  })

  // ── Connector & Setup API — operator+ ─────────────────────────────────────
  app.get('/api/v1/connectors', authMiddleware, requireRole('viewer'), (_req, res) => {
    res.json({
      connectors: [
        {
          id: 'anthropic',
          name: 'Claude (Anthropic)',
          provider: 'anthropic',
          description: 'Intercepts Anthropic Claude API calls — Messages, Completions, Embeddings.',
          icon: 'brain',
          hosts: ['api.anthropic.com'],
          envHint: 'ANTHROPIC_API_KEY',
          detectionMethod: 'fetch-intercept',
          status: 'available',
          category: 'cloud',
        },
        {
          id: 'ollama',
          name: 'Ollama (Local)',
          provider: 'ollama',
          description: 'Monitors local Ollama instance — Llama, CodeLlama, Mistral, Gemma, and all models.',
          icon: 'server',
          hosts: ['localhost:11434'],
          envHint: null,
          detectionMethod: 'fetch-intercept',
          status: 'available',
          category: 'local',
        },
        {
          id: 'openai',
          name: 'OpenAI',
          provider: 'openai',
          description: 'Captures OpenAI GPT-4, GPT-3.5, Embeddings, and DALL-E usage.',
          icon: 'zap',
          hosts: ['api.openai.com'],
          envHint: 'OPENAI_API_KEY',
          detectionMethod: 'fetch-intercept',
          status: 'available',
          category: 'cloud',
        },
        {
          id: 'google',
          name: 'Google Gemini',
          provider: 'google',
          description: 'Tracks Google Gemini Pro, Flash, and Vertex AI calls.',
          icon: 'globe',
          hosts: ['generativelanguage.googleapis.com'],
          envHint: 'GOOGLE_API_KEY',
          detectionMethod: 'fetch-intercept',
          status: 'available',
          category: 'cloud',
        },
        {
          id: 'mistral',
          name: 'Mistral AI',
          provider: 'mistral',
          description: 'Monitors Mistral Large, Small, and Codestral endpoints.',
          icon: 'wind',
          hosts: ['api.mistral.ai'],
          envHint: 'MISTRAL_API_KEY',
          detectionMethod: 'fetch-intercept',
          status: 'available',
          category: 'cloud',
        },
        {
          id: 'azure_openai',
          name: 'Azure OpenAI',
          provider: 'azure_openai',
          description: 'Captures Azure-hosted OpenAI endpoints and deployments.',
          icon: 'cloud',
          hosts: ['*.openai.azure.com'],
          envHint: 'AZURE_OPENAI_API_KEY',
          detectionMethod: 'fetch-intercept',
          status: 'available',
          category: 'cloud',
        },
        {
          id: 'bedrock',
          name: 'AWS Bedrock',
          provider: 'bedrock',
          description: 'Monitors Amazon Bedrock model invocations (Claude, Titan, Llama).',
          icon: 'database',
          hosts: ['*.bedrock-runtime.amazonaws.com'],
          envHint: 'AWS_ACCESS_KEY_ID',
          detectionMethod: 'fetch-intercept',
          status: 'available',
          category: 'cloud',
        },
      ],
    })
  })

  // ── Config API — operator+ (read), admin+ (write) ────────────────────────
  app.get('/api/v1/config', authMiddleware, requireRole('operator'), async (_req, res) => {
    const config = await configStore.load()
    res.json(config)
  })

  app.put('/api/v1/config', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const updated = await configStore.save(req.body as Partial<HiveConfig>)
      logger.info('Config updated via UI')
      res.json(updated)
    } catch (err) {
      logger.error({ err }, 'Failed to save config')
      res.status(500).json({ error: 'failed_to_save_config' })
    }
  })

  app.get('/api/v1/config/defaults', authMiddleware, requireRole('operator'), (_req, res) => {
    res.json(ConfigStore.defaults())
  })

  app.get('/api/v1/setup/status', authMiddleware, requireRole('operator'), async (_req, res) => {
    const count = await store.count()
    const recentEvents = await store.recent(5)
    const providers = new Set(recentEvents.map((e) => e.provider))
    res.json({
      node: {
        status: 'running',
        region: deps.env.NODE_REGION,
        uptime_ms: Date.now() - startedAt,
        events_ingested: count,
      },
      active_providers: [...providers],
      last_event_at: recentEvents[0]?.timestamp ?? null,
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES — admin+ (user mgmt, API keys, audit log)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/v1/admin/auth-info', authMiddleware, requireRole('viewer'), (req, res) => {
    res.json({
      auth_mode: authEnv.HIVE_AUTH_MODE,
      deployment_mode: authEnv.HIVE_DEPLOYMENT_MODE,
      user: req.auth ? {
        user_id: req.auth.user_id,
        email: req.auth.email,
        name: req.auth.name,
        roles: req.auth.roles,
        tenant_id: req.auth.tenant_id,
        tenant_type: req.auth.tenant_type,
        auth_method: req.auth.auth_method,
      } : null,
    })
  })

  // ── Error handler ─────────────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled error')
    res.status(500).json({ error: 'internal_error' })
  })

  return { app, store, logger }
}
