/**
 * HIVE Node Server — OpenAPI 3.1 specification
 *
 * Serves Swagger UI at /api/docs and the raw spec at /api/docs/spec.json.
 */
import type { Express } from 'express'
import swaggerUi from 'swagger-ui-express'

// ── OpenAPI 3.1 Spec ───────────────────────────────────────────────────────

export const spec = {
  openapi: '3.1.0',
  info: {
    title: 'HIVE — Token Telemetry Protocol API',
    version: '0.1.0',
    description:
      'HIVE ingests, governs, and visualises AI token consumption across your organisation.\n\n' +
      '**Zero Content Principle** — HIVE never reads prompts, completions, or API keys. Metadata only.\n\n' +
      '**Token Economy** — Every token is a unit of spend. This API makes invisible API calls visible.\n\n' +
      '**Token Governance** — Every event carries a GovernanceBlock with frozen privacy guarantees.',
    contact: { name: 'Black N Green', url: 'https://blackngreen.com', email: 'vishal.mishra@blackngreen.com' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'http://node-server:3000', description: 'Docker network' },
  ],
  tags: [
    { name: 'Health', description: 'Server health, version, and metrics' },
    { name: 'Ingest', description: 'TTP event ingestion — the core write path' },
    { name: 'Events', description: 'Read API for dashboard consumption' },
    { name: 'Intelligence', description: 'Cost modelling, anomaly detection, forecasting, and clustering' },
    { name: 'Config', description: 'Runtime configuration — replaces .env files entirely' },
    { name: 'Connectors', description: 'Connector discovery and setup status' },
  ],

  // ── Paths ──────────────────────────────────────────────────────────────────

  paths: {
    // ── Health ────────────────────────────────────────────────────────────────
    '/health': {
      get: {
        operationId: 'getHealth',
        tags: ['Health'],
        summary: 'Server health check',
        responses: {
          200: {
            description: 'Server is healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },

    '/version': {
      get: {
        operationId: 'getVersion',
        tags: ['Health'],
        summary: 'API version info',
        responses: {
          200: {
            description: 'Version details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: '@hive/node-server' },
                    version: { type: 'string', example: '0.1.0' },
                    TTP: { type: 'string', example: '0.1' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/metrics': {
      get: {
        operationId: 'getMetrics',
        tags: ['Health'],
        summary: 'Prometheus metrics',
        description:
          'Returns Prometheus-format metrics: `TTP_ingest_events_total`, `TTP_ingest_bytes_total`, ' +
          '`TTP_ingest_tokens_total`, `TTP_ingest_latency_ms`, `TTP_ingest_errors_total`, ' +
          '`TTP_covenant_violations_total`, `TTP_node_up`.',
        responses: {
          200: {
            description: 'Prometheus exposition format',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
        },
      },
    },

    // ── Ingest ───────────────────────────────────────────────────────────────
    '/api/v1/ttp/ingest': {
      post: {
        operationId: 'ingestBatch',
        tags: ['Ingest'],
        summary: 'Ingest a batch of TTP events',
        description:
          'Core write path. Accepts 1-500 events per batch. Each event is independently validated against ' +
          'the TTP schema, governance rules, residency policy, and the optional policy engine. ' +
          'Events that fail validation are rejected individually — valid events in the same batch still succeed.\n\n' +
          'When a trust store is configured, batches must include an Ed25519 signature envelope.',
        security: [{ bearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TTPBatch' } } },
        },
        responses: {
          200: {
            description: 'Batch processed (some or all events accepted)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TTPIngestResponse' } } },
          },
          400: {
            description: 'Batch-level validation failure or all events rejected',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TTPIngestResponse' } } },
          },
          401: {
            description: 'Invalid token, missing signature, unknown kid, or signature verification failed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TTPIngestResponse' } } },
          },
        },
      },
    },

    // ── Events ───────────────────────────────────────────────────────────────
    '/api/v1/events/recent': {
      get: {
        operationId: 'getRecentEvents',
        tags: ['Events'],
        summary: 'Fetch recent events',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, minimum: 1, maximum: 500 } },
        ],
        responses: {
          200: {
            description: 'Recent events',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { events: { type: 'array', items: { $ref: '#/components/schemas/TTPEvent' } } },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/rollups/aggregate': {
      get: {
        operationId: 'getAggregateRollups',
        tags: ['Events'],
        summary: 'Aggregated event statistics',
        description: 'Returns per-provider, per-department roll-ups: call count, total tokens, total bytes, average latency.',
        responses: {
          200: {
            description: 'Aggregated rows',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    rows: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AggregateRow' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Intelligence ─────────────────────────────────────────────────────────
    '/api/v1/intelligence/cost': {
      get: {
        operationId: 'getCostEstimate',
        tags: ['Intelligence'],
        summary: 'Estimate batch cost',
        description: 'Runs the HIVE cost model across recent events and returns estimated USD spend per provider and model.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, minimum: 1, maximum: 2000 } },
        ],
        responses: {
          200: {
            description: 'Cost estimation',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CostEstimate' } } },
          },
        },
      },
    },

    '/api/v1/intelligence/anomalies': {
      get: {
        operationId: 'getAnomalies',
        tags: ['Intelligence'],
        summary: 'Detect consumption anomalies',
        description: 'Identifies statistical outliers in token consumption — burst usage, unusual providers, shadow AI.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, minimum: 1, maximum: 2000 } },
        ],
        responses: {
          200: {
            description: 'Anomaly detection results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    anomalies: { type: 'array', items: { $ref: '#/components/schemas/Anomaly' } },
                    analyzedEvents: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/intelligence/forecast': {
      get: {
        operationId: 'getForecast',
        tags: ['Intelligence'],
        summary: 'Forecast future spend',
        description: 'Projects future AI spend based on historical patterns. Requires at least 3 days of data.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 1000, minimum: 1, maximum: 5000 } },
          { name: 'horizon', in: 'query', description: 'Forecast horizon in days', schema: { type: 'integer', default: 90, minimum: 1, maximum: 365 } },
        ],
        responses: {
          200: {
            description: 'Spend forecast',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Forecast' } } },
          },
        },
      },
    },

    '/api/v1/intelligence/clusters': {
      get: {
        operationId: 'getClusters',
        tags: ['Intelligence'],
        summary: 'Cluster behavioural patterns',
        description: 'Groups events into usage clusters and analyses data flow patterns across providers and departments.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, minimum: 1, maximum: 2000 } },
        ],
        responses: {
          200: {
            description: 'Clusters and flows',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    clusters: { type: 'array', items: { $ref: '#/components/schemas/Cluster' } },
                    flows: { type: 'array', items: { $ref: '#/components/schemas/Flow' } },
                    analyzedEvents: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/intelligence/fingerprints': {
      get: {
        operationId: 'getFingerprints',
        tags: ['Intelligence'],
        summary: 'Behaviour fingerprints',
        description: 'Generates unique behavioural fingerprints per department or project — useful for anomaly baseline and drift detection.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, minimum: 1, maximum: 2000 } },
          { name: 'groupBy', in: 'query', schema: { type: 'string', enum: ['dept', 'project'], default: 'dept' } },
        ],
        responses: {
          200: {
            description: 'Fingerprint results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fingerprints: { type: 'array', items: { $ref: '#/components/schemas/Fingerprint' } },
                    groupBy: { type: 'string' },
                    analyzedEvents: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Config ───────────────────────────────────────────────────────────────
    '/api/v1/config': {
      get: {
        operationId: 'getConfig',
        tags: ['Config'],
        summary: 'Fetch current configuration',
        responses: {
          200: {
            description: 'Current HIVE configuration',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HiveConfig' } } },
          },
        },
      },
      put: {
        operationId: 'updateConfig',
        tags: ['Config'],
        summary: 'Update configuration',
        description: 'Merges the provided fields into the current config and persists to the vault.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HiveConfig' } } },
        },
        responses: {
          200: {
            description: 'Updated configuration',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HiveConfig' } } },
          },
          500: { description: 'Failed to save config' },
        },
      },
    },

    '/api/v1/config/defaults': {
      get: {
        operationId: 'getConfigDefaults',
        tags: ['Config'],
        summary: 'Default configuration template',
        responses: {
          200: {
            description: 'Default config values',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HiveConfig' } } },
          },
        },
      },
    },

    // ── Connectors & Setup ───────────────────────────────────────────────────
    '/api/v1/connectors': {
      get: {
        operationId: 'listConnectors',
        tags: ['Connectors'],
        summary: 'List available AI provider connectors',
        responses: {
          200: {
            description: 'Connector registry',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connectors: { type: 'array', items: { $ref: '#/components/schemas/Connector' } },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/setup/status': {
      get: {
        operationId: 'getSetupStatus',
        tags: ['Connectors'],
        summary: 'Onboarding / setup status',
        responses: {
          200: {
            description: 'Setup status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    node: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'running' },
                        region: { type: 'string', example: 'AE' },
                        uptime_ms: { type: 'integer' },
                        events_ingested: { type: 'integer' },
                      },
                    },
                    active_providers: { type: 'array', items: { type: 'string' } },
                    last_event_at: { type: ['integer', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  // ── Components ─────────────────────────────────────────────────────────────

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'NODE_INGEST_TOKEN — required for ingest endpoint when configured. Pass as `Authorization: Bearer <token>`.',
      },
    },

    schemas: {
      // ── Health ──────────────────────────────────────────────────────────────
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          uptime_ms: { type: 'integer', example: 123456 },
          region: { type: 'string', example: 'AE' },
          node_id: { type: 'string', example: 'hive-node-01' },
          events_ingested: { type: 'integer', example: 1500 },
          policy: { type: ['string', 'null'] },
          trust_kids: { type: 'array', items: { type: 'string' } },
        },
      },

      // ── TTP Core ────────────────────────────────────────────────────────────
      GovernanceBlock: {
        type: 'object',
        required: ['pii_asserted', 'content_asserted', 'data_residency', 'retention_days', 'regulation_tags'],
        description:
          'Frozen governance metadata. `pii_asserted` and `content_asserted` are structurally locked to `false` — ' +
          'HIVE never touches content. This is the trust foundation for enterprise adoption.',
        properties: {
          consent_basis: {
            type: 'string',
            enum: ['legitimate_interest', 'org_policy', 'explicit', 'not_applicable'],
            default: 'org_policy',
          },
          data_residency: { type: 'string', minLength: 2, maxLength: 8, example: 'AE' },
          retention_days: { type: 'integer', minimum: -1, example: 90 },
          regulation_tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['GDPR', 'UAE_AI_LAW'],
          },
          pii_asserted: { type: 'boolean', const: false, description: 'Structurally frozen to false' },
          content_asserted: { type: 'boolean', const: false, description: 'Structurally frozen to false' },
        },
      },

      TokenBreakdown: {
        type: 'object',
        properties: {
          prompt_tokens: { type: 'integer' },
          completion_tokens: { type: 'integer' },
          cached_tokens: { type: 'integer' },
          reasoning_tokens: { type: 'integer' },
        },
      },

      TTPEvent: {
        type: 'object',
        required: [
          'TTP_version', 'event_id', 'schema_hash', 'timestamp', 'observed_at',
          'emitter_id', 'emitter_type', 'session_hash', 'provider', 'endpoint',
          'model_hint', 'direction', 'payload_bytes', 'status_code',
          'estimated_tokens', 'deployment', 'governance',
        ],
        properties: {
          TTP_version: { type: 'string', const: '0.1' },
          event_id: { type: 'string', format: 'uuid' },
          schema_hash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
          timestamp: { type: 'integer', description: 'Unix epoch ms' },
          observed_at: { type: 'integer', description: 'Unix epoch ms' },
          emitter_id: { type: 'string', minLength: 1 },
          emitter_type: { type: 'string', enum: ['scout', 'sdk', 'proxy', 'agent', 'sidecar', 'widget'] },
          org_node_id: { type: 'string' },
          session_hash: { type: 'string', minLength: 1 },
          provider: {
            type: 'string',
            description: 'AI provider identifier',
            example: 'openai',
          },
          provider_version: { type: 'string' },
          endpoint: { type: 'string', minLength: 1 },
          model_hint: { type: 'string', minLength: 1, example: 'gpt-4o' },
          model_family: { type: 'string' },
          direction: { type: 'string', enum: ['request', 'response', 'stream_chunk', 'stream_end', 'error'] },
          payload_bytes: { type: 'integer', minimum: 0 },
          latency_ms: { type: 'number' },
          ttfb_ms: { type: 'number' },
          status_code: { type: 'integer', example: 200 },
          estimated_tokens: { type: 'integer', minimum: 0 },
          token_breakdown: { $ref: '#/components/schemas/TokenBreakdown' },
          dept_tag: { type: 'string', example: 'engineering' },
          project_tag: { type: 'string', example: 'search-v2' },
          env_tag: { type: 'string', enum: ['production', 'staging', 'development', 'ci'] },
          use_case_tag: { type: 'string' },
          deployment: { type: 'string', enum: ['solo', 'node', 'federated', 'open'] },
          node_region: { type: 'string', minLength: 2, maxLength: 2, example: 'AE' },
          governance: { $ref: '#/components/schemas/GovernanceBlock' },
          signature: { type: 'string' },
        },
      },

      SignedBatchEnvelope: {
        type: 'object',
        required: ['TTP_version', 'schema_hash', 'events_digest', 'signature', 'kid', 'signed_at'],
        properties: {
          TTP_version: { type: 'string', const: '0.1' },
          schema_hash: { type: 'string', pattern: '^sha256:[a-f0-9]+$' },
          events_digest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          signature: { type: 'string', description: 'Base64url Ed25519 signature' },
          kid: { type: 'string', description: 'Key ID matching a registered public key' },
          signed_at: { type: 'integer' },
        },
      },

      TTPBatch: {
        type: 'object',
        required: ['batch_id', 'sent_at', 'events'],
        properties: {
          batch_id: { type: 'string', format: 'uuid' },
          sent_at: { type: 'integer', minimum: 0, description: 'Unix epoch ms' },
          events: {
            type: 'array',
            items: { $ref: '#/components/schemas/TTPEvent' },
            minItems: 1,
            maxItems: 500,
          },
          signature: { $ref: '#/components/schemas/SignedBatchEnvelope' },
        },
      },

      TTPIngestResponse: {
        type: 'object',
        required: ['accepted', 'rejected', 'errors', 'batch_id', 'ingested_at'],
        properties: {
          accepted: { type: 'integer', example: 5 },
          rejected: { type: 'integer', example: 1 },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                event_id: { type: 'string', format: 'uuid' },
                code: {
                  type: 'string',
                  enum: [
                    'BATCH_INVALID', 'SCHEMA_INVALID', 'RESIDENCY_VIOLATION',
                    'POLICY_DENY', 'SIGNATURE_MISSING', 'UNKNOWN_KID', 'SIGNATURE_INVALID',
                    'MALFORMED_JSON',
                  ],
                },
                field: { type: 'string' },
              },
            },
          },
          batch_id: { type: 'string', format: 'uuid' },
          ingested_at: { type: 'integer', description: 'Unix epoch ms' },
        },
      },

      // ── Events / Rollups ────────────────────────────────────────────────────
      AggregateRow: {
        type: 'object',
        properties: {
          provider: { type: 'string', example: 'openai' },
          dept_tag: { type: ['string', 'null'] },
          call_count: { type: 'integer' },
          total_tokens: { type: 'integer' },
          total_bytes: { type: 'integer' },
          avg_latency_ms: { type: ['number', 'null'] },
        },
      },

      // ── Intelligence ────────────────────────────────────────────────────────
      CostEstimate: {
        type: 'object',
        description: 'Cost breakdown by provider, model, and department.',
        properties: {
          totalCostUsd: { type: 'number', example: 42.87 },
          byProvider: { type: 'object', additionalProperties: { type: 'number' } },
          byModel: { type: 'object', additionalProperties: { type: 'number' } },
          byDept: { type: 'object', additionalProperties: { type: 'number' } },
          eventCount: { type: 'integer' },
        },
      },

      Anomaly: {
        type: 'object',
        properties: {
          type: { type: 'string', example: 'burst_usage' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          description: { type: 'string' },
          event_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          metric: { type: 'string' },
          value: { type: 'number' },
          threshold: { type: 'number' },
        },
      },

      Forecast: {
        type: 'object',
        properties: {
          horizonDays: { type: 'integer' },
          dailyForecast: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                estimatedCostUsd: { type: 'number' },
                estimatedTokens: { type: 'integer' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          totalProjectedCostUsd: { type: 'number' },
        },
      },

      Cluster: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          size: { type: 'integer' },
          centroid: { type: 'object', additionalProperties: { type: 'number' } },
          providers: { type: 'array', items: { type: 'string' } },
        },
      },

      Flow: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          volume: { type: 'integer' },
          avgLatencyMs: { type: 'number' },
        },
      },

      Fingerprint: {
        type: 'object',
        properties: {
          group: { type: 'string', example: 'engineering' },
          hash: { type: 'string' },
          features: { type: 'object', additionalProperties: { type: 'number' } },
          eventCount: { type: 'integer' },
        },
      },

      // ── Config ──────────────────────────────────────────────────────────────
      HiveConfig: {
        type: 'object',
        properties: {
          updatedAt: { type: 'integer' },
          scout: {
            type: 'object',
            properties: {
              deployment: { type: 'string', enum: ['solo', 'node', 'federated', 'open'] },
              connectors: { type: 'array', items: { type: 'string' } },
              dataResidency: { type: 'string' },
              retentionDays: { type: 'integer' },
              regulationTags: { type: 'array', items: { type: 'string' } },
              flushIntervalMs: { type: 'integer' },
              deptTag: { type: 'string' },
              projectTag: { type: 'string' },
              ollamaHost: { type: 'string' },
              nodeRegion: { type: 'string' },
            },
          },
          node: {
            type: 'object',
            properties: {
              port: { type: 'integer' },
              region: { type: 'string' },
              nodeId: { type: 'string' },
              ingestToken: { type: 'string' },
            },
          },
          dashboard: {
            type: 'object',
            properties: {
              port: { type: 'integer' },
              nodeUrl: { type: 'string' },
            },
          },
          llm: {
            type: 'object',
            properties: {
              activeProvider: { type: 'string' },
              providers: { type: 'object', additionalProperties: { type: 'object' } },
            },
          },
          providers: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                hosts: { type: 'array', items: { type: 'string' } },
                customLabel: { type: 'string' },
              },
            },
          },
        },
      },

      // ── Connectors ──────────────────────────────────────────────────────────
      Connector: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'openai' },
          name: { type: 'string', example: 'OpenAI' },
          provider: { type: 'string' },
          description: { type: 'string' },
          icon: { type: 'string' },
          hosts: { type: 'array', items: { type: 'string' } },
          envHint: { type: ['string', 'null'] },
          detectionMethod: { type: 'string' },
          status: { type: 'string' },
          category: { type: 'string', enum: ['cloud', 'local'] },
        },
      },
    },
  },
} as const

// ── Mount helper ─────────────────────────────────────────────────────────────

export function mountSwagger(app: Express): void {
  // Raw JSON spec
  app.get('/api/docs/spec.json', (_req, res) => {
    res.json(spec)
  })

  // Swagger UI
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec as unknown as swaggerUi.JsonObject, {
      customCss: `
        .swagger-ui .topbar { background-color: #0a0a0f; }
        .swagger-ui .topbar .download-url-wrapper .select-label select { border-color: #ffd60a; }
        .swagger-ui .info .title { color: #ffd60a; }
        .swagger-ui .scheme-container { background: #12121a; }
      `,
      customSiteTitle: 'HIVE API Documentation',
      customfavIcon: '/favicon.ico',
    }),
  )
}
