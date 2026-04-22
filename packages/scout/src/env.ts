import { z } from 'zod'

/**
 * Environment schema for the Scout agent.
 * Validated at startup — the process refuses to run with invalid env.
 */
export const ScoutEnvSchema = z
  .object({
    TTP_ENDPOINT: z.string().url().optional(),
    TTP_TOKEN: z.string().optional(),
    HIVE_DEPLOYMENT: z.enum(['solo', 'node', 'federated', 'open']).default('solo'),
    HIVE_DATA_RESIDENCY: z.string().min(2).max(8).default('AE'),
    HIVE_RETENTION_DAYS: z.coerce.number().int().min(-1).default(90),
    HIVE_REGULATION_TAGS: z.string().default('UAE_AI_LAW,GDPR'),
    HIVE_FLUSH_INTERVAL_MS: z.coerce.number().int().nonnegative().default(60_000),
    HIVE_DEPT_TAG: z.string().optional(),
    HIVE_PROJECT_TAG: z.string().optional(),
    HIVE_NODE_REGION: z.string().length(2).optional(),
    HIVE_DEVICE_FINGERPRINT: z.string().min(8).optional(),
    /** Comma-separated list of connectors to enable. Empty = all. */
    HIVE_CONNECTORS: z.string().default('anthropic,openai,ollama'),
    /** Custom Ollama host (default: localhost:11434). */
    HIVE_OLLAMA_HOST: z.string().optional(),
    /** Admin HTTP server port. Default 9477. Set 0 to disable. */
    HIVE_ADMIN_PORT: z.coerce.number().int().min(0).max(65_535).default(9477),
    /** Admin HTTP server bind address. Default loopback-only. */
    HIVE_ADMIN_BIND: z.string().default('127.0.0.1'),
    /** WAL directory for durable event buffering. Default: .hive/scout/queue */
    HIVE_WAL_DIR: z.string().default('.hive/scout/queue'),
    /** Max bytes held in the WAL before oldest is evicted. Default 500 MB. */
    HIVE_WAL_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(500 * 1024 * 1024),
    /** How often the WAL replay loop sweeps. Default 15 s. */
    HIVE_REPLAY_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
    /** Log level — trace|debug|info|warn|error|fatal. Default info. */
    HIVE_LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .default('info'),
  })
  .transform((e) => ({
    ...e,
    regulationTags: e.HIVE_REGULATION_TAGS.split(',').map((t) => t.trim()).filter(Boolean),
    enabledConnectors: e.HIVE_CONNECTORS.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean),
  }))

export type ScoutEnv = z.infer<typeof ScoutEnvSchema>

export function loadScoutEnv(source: NodeJS.ProcessEnv = process.env): ScoutEnv {
  const parsed = ScoutEnvSchema.safeParse(source)
  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`Invalid Scout environment:\n${errors}`)
  }
  return parsed.data
}
