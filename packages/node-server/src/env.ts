import { z } from 'zod'

export const NodeEnvSchema = z.object({
  NODE_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_DATABASE_URL: z.string().url().optional(),
  NODE_REDIS_URL: z.string().url().optional(),
  NODE_REGION: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .default('AE'),
  NODE_ID: z.string().min(1).optional(),
  NODE_INGEST_TOKEN: z.string().min(16).optional(),

  // ── Auth / Keycloak ──────────────────────────────────────────────────
  KEYCLOAK_URL: z.string().optional(),
  KEYCLOAK_REALM: z.string().min(1).default('hive'),
  KEYCLOAK_CLIENT_ID: z.string().min(1).default('hive-api'),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1).optional(),
  HIVE_AUTH_MODE: z.enum(['keycloak', 'none']).default('keycloak'),
  HIVE_DEPLOYMENT_MODE: z.enum(['bespoke', 'saas']).default('bespoke'),
  HIVE_DEFAULT_TENANT_ID: z.string().uuid().optional(),
})

export type NodeEnv = z.infer<typeof NodeEnvSchema>

export function loadNodeEnv(source: NodeJS.ProcessEnv = process.env): NodeEnv {
  const parsed = NodeEnvSchema.safeParse(source)
  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`Invalid Node server environment:\n${errors}`)
  }
  return parsed.data
}
