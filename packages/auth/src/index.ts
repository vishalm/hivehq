/**
 * @hive/auth — Authentication, RBAC, multi-tenant isolation, and audit logging.
 *
 * Public API for the HIVE auth package.
 */

// ── Types ───────────────────────────────────────────────────────────────────
export {
  // Roles
  ROLES,
  ROLE_HIERARCHY,
  hasRole,
  type Role,

  // Tenants
  TENANT_TYPES,
  PLANS,
  DEPLOYMENT_MODES,
  AUTH_MODES,
  AUTH_METHODS,
  type TenantType,
  type Plan,
  type DeploymentMode,
  type AuthMode,
  type AuthMethod,

  // Interfaces
  type TenantNode,
  type AuthContext,
  type ApiKey,
  type AuditEntry,
  type ActorType,
  ACTOR_TYPES,

  // Zod schemas
  RoleSchema,
  TenantCreateSchema,
  TenantUpdateSchema,
  ApiKeyCreateSchema,
  type TenantCreate,
  type TenantUpdate,
  type ApiKeyCreate,

  // Keycloak JWT
  type KeycloakJWTClaims,

  // Environment
  AuthEnvSchema,
  loadAuthEnv,
  type AuthEnv,
} from './types.js'

// ── Keycloak client ─────────────────────────────────────────────────────────
export { KeycloakClient, AuthError, type KeycloakUser } from './keycloak-client.js'

// ── Middleware ───────────────────────────────────────────────────────────────
export {
  createAuthMiddleware,
  requireRole,
  requireTenant,
  optionalAuth,
  type AuthMiddlewareConfig,
  type ApiKeyResolution,
} from './middleware.js'

// ── Services ────────────────────────────────────────────────────────────────
export { TenantService } from './tenant-service.js'
export { ApiKeyService } from './api-key-service.js'
export { AuditService, type AuditWriteParams } from './audit-service.js'
export { UserService, type HiveUser } from './user-service.js'

// ── Migrations ──────────────────────────────────────────────────────────────
export { runAuthMigrations, AUTH_MIGRATION_STATEMENTS, type MigrationResult } from './migrations.js'
