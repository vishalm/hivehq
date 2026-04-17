/**
 * @hive/auth — Types for authentication, RBAC, and multi-tenant isolation.
 */

import { z } from 'zod'

// ── Roles ──────────────────────────────────────────────────────────────────

export const ROLES = ['viewer', 'operator', 'admin', 'super_admin', 'gov_auditor'] as const
export type Role = (typeof ROLES)[number]

/**
 * Role hierarchy — each role inherits the permissions of the roles below it.
 * `gov_auditor` is separate (not in the main hierarchy).
 */
export const ROLE_HIERARCHY: Record<Role, Role[]> = {
  viewer: [],
  operator: ['viewer'],
  admin: ['operator', 'viewer'],
  super_admin: ['admin', 'operator', 'viewer'],
  gov_auditor: [],
}

/** Check if a user's roles satisfy a required role. */
export function hasRole(userRoles: Role[], required: Role): boolean {
  return userRoles.some(
    (r) => r === required || (ROLE_HIERARCHY[r]?.includes(required) ?? false),
  )
}

// ── Tenant types ────────────────────────────────────────────────────────────

export const TENANT_TYPES = ['country', 'government', 'group', 'enterprise', 'company'] as const
export type TenantType = (typeof TENANT_TYPES)[number]

export const PLANS = ['community', 'professional', 'enterprise', 'government'] as const
export type Plan = (typeof PLANS)[number]

export const DEPLOYMENT_MODES = ['bespoke', 'saas'] as const
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number]

export const AUTH_MODES = ['keycloak', 'none'] as const
export type AuthMode = (typeof AUTH_MODES)[number]

export const AUTH_METHODS = ['oidc', 'api_key', 'legacy_token'] as const
export type AuthMethod = (typeof AUTH_METHODS)[number]

// ── Tenant node ────────────────────────────────────────────────────────────

export interface TenantNode {
  id: string
  parent_id: string | null
  tenant_type: TenantType
  name: string
  slug: string
  country_code: string
  data_residency: string
  regulation_tags: string[]
  plan: Plan
  keycloak_realm: string | null
  settings: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

// ── Auth context (attached to every authenticated request) ──────────────────

export interface AuthContext {
  user_id: string
  email: string
  name: string
  roles: Role[]
  tenant_id: string
  tenant_type: TenantType
  deployment_mode: DeploymentMode
  auth_method: AuthMethod
}

// ── API Key ────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string
  tenant_id: string
  name: string
  key_prefix: string
  key_hash: string
  roles: Role[]
  last_used_at: Date | null
  expires_at: Date | null
  created_at: Date
}

// ── Audit log entry ────────────────────────────────────────────────────────

export const ACTOR_TYPES = ['user', 'api_key', 'system'] as const
export type ActorType = (typeof ACTOR_TYPES)[number]

export interface AuditEntry {
  id: string
  tenant_id: string
  actor_id: string | null
  actor_type: ActorType
  action: string
  resource: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: Date
}

// ── Zod schemas for validation ─────────────────────────────────────────────

export const RoleSchema = z.enum(ROLES)

export const TenantCreateSchema = z.object({
  parent_id: z.string().uuid().nullable().default(null),
  tenant_type: z.enum(TENANT_TYPES),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  country_code: z.string().length(2).regex(/^[A-Z]{2}$/),
  data_residency: z.string().min(1).default('AE'),
  regulation_tags: z.array(z.string()).default([]),
  plan: z.enum(PLANS).default('community'),
  keycloak_realm: z.string().nullable().default(null),
  settings: z.record(z.unknown()).default({}),
})

export type TenantCreate = z.infer<typeof TenantCreateSchema>

export const TenantUpdateSchema = TenantCreateSchema.partial().omit({ slug: true })
export type TenantUpdate = z.infer<typeof TenantUpdateSchema>

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(255),
  roles: z.array(RoleSchema).min(1).default(['operator']),
  expires_at: z.string().datetime().nullable().default(null),
})

export type ApiKeyCreate = z.infer<typeof ApiKeyCreateSchema>

// ── Keycloak JWT claims ────────────────────────────────────────────────────

export interface KeycloakJWTClaims {
  sub: string
  email?: string
  preferred_username?: string
  name?: string
  given_name?: string
  family_name?: string
  roles?: string[]
  realm_access?: { roles: string[] }
  resource_access?: Record<string, { roles: string[] }>
  tenant_id?: string
  tenant_type?: string
  iss: string
  aud: string | string[]
  exp: number
  iat: number
}

// ── Auth environment config ────────────────────────────────────────────────

export const AuthEnvSchema = z.object({
  KEYCLOAK_URL: z.string().url().optional(),
  KEYCLOAK_REALM: z.string().min(1).default('hive'),
  KEYCLOAK_CLIENT_ID: z.string().min(1).default('hive-api'),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1).optional(),
  HIVE_AUTH_MODE: z.enum(AUTH_MODES).default('keycloak'),
  HIVE_DEPLOYMENT_MODE: z.enum(DEPLOYMENT_MODES).default('bespoke'),
  HIVE_DEFAULT_TENANT_ID: z.string().uuid().optional(),
  NODE_INGEST_TOKEN: z.string().min(16).optional(),
})

export type AuthEnv = z.infer<typeof AuthEnvSchema>

export function loadAuthEnv(source: NodeJS.ProcessEnv = process.env): AuthEnv {
  const parsed = AuthEnvSchema.safeParse(source)
  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`Invalid auth environment:\n${errors}`)
  }
  return parsed.data
}
