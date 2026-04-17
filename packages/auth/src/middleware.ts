/**
 * @hive/auth — Express middleware for authentication and authorization.
 *
 * Three auth strategies checked in order:
 *   1. OIDC Bearer — JWT from Keycloak (Authorization: Bearer <JWT>)
 *   2. API Key    — HIVE API key     (Authorization: Bearer hive_ak_...)
 *   3. Legacy     — NODE_INGEST_TOKEN (backward compat for solo/dev mode)
 *
 * When HIVE_AUTH_MODE=none, all middleware is bypassed (dev mode).
 */

import type { Request, Response, NextFunction } from 'express'
import { KeycloakClient, AuthError } from './keycloak-client.js'
import type { AuthContext, AuthEnv, AuthMethod, DeploymentMode, Role, TenantType } from './types.js'
import { hasRole } from './types.js'

// ── Extend Express Request with auth context ────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

// ── Middleware factory ───────────────────────────────────────────────────────

export interface AuthMiddlewareConfig {
  env: AuthEnv
  /** Keycloak client — only needed when auth mode is keycloak */
  keycloak?: KeycloakClient
  /** API key validator — resolves prefix to key details */
  resolveApiKey?: (prefix: string, rawKey: string) => Promise<ApiKeyResolution | null>
}

export interface ApiKeyResolution {
  key_id: string
  tenant_id: string
  tenant_type: TenantType
  roles: Role[]
}

/**
 * Creates the main authentication middleware.
 * Tries OIDC, API key, legacy token in order.
 * If no auth method succeeds, returns 401.
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const { env, keycloak, resolveApiKey } = config

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Dev bypass
    if (env.HIVE_AUTH_MODE === 'none') {
      req.auth = devAuthContext(env)
      next()
      return
    }

    const header = req.header('authorization')
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized', message: 'Missing Bearer token' })
      return
    }

    const token = header.slice(7)

    try {
      // Strategy 1: HIVE API Key (prefixed with hive_ak_)
      if (token.startsWith('hive_ak_') && resolveApiKey) {
        const prefix = token.slice(0, 12)
        const resolution = await resolveApiKey(prefix, token)
        if (!resolution) {
          res.status(401).json({ error: 'invalid_api_key', message: 'API key not found or revoked' })
          return
        }
        req.auth = {
          user_id: resolution.key_id,
          email: `apikey:${resolution.key_id}`,
          name: `API Key ${prefix}`,
          roles: resolution.roles,
          tenant_id: resolution.tenant_id,
          tenant_type: resolution.tenant_type,
          deployment_mode: env.HIVE_DEPLOYMENT_MODE,
          auth_method: 'api_key',
        }
        next()
        return
      }

      // Strategy 2: Legacy ingest token
      if (env.NODE_INGEST_TOKEN && token === env.NODE_INGEST_TOKEN) {
        req.auth = legacyAuthContext(env)
        next()
        return
      }

      // Strategy 3: OIDC JWT from Keycloak
      if (keycloak) {
        const claims = await keycloak.verifyToken(token)
        const roles = keycloak.extractRoles(claims)
        const tenantId = claims.tenant_id ?? env.HIVE_DEFAULT_TENANT_ID ?? '00000000-0000-0000-0000-000000000001'
        const tenantType = (claims.tenant_type as TenantType) ?? 'company'

        req.auth = {
          user_id: claims.sub,
          email: claims.email ?? claims.preferred_username ?? '',
          name: claims.name ?? `${claims.given_name ?? ''} ${claims.family_name ?? ''}`.trim(),
          roles,
          tenant_id: tenantId,
          tenant_type: tenantType,
          deployment_mode: env.HIVE_DEPLOYMENT_MODE,
          auth_method: 'oidc',
        }
        next()
        return
      }

      // No strategy matched
      res.status(401).json({ error: 'unauthorized', message: 'Invalid or unrecognized token' })
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(401).json({ error: err.code.toLowerCase(), message: err.message })
        return
      }
      next(err)
    }
  }
}

/**
 * Role-based access control middleware.
 * Must be applied AFTER createAuthMiddleware.
 */
export function requireRole(...required: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth
    if (!auth) {
      res.status(401).json({ error: 'unauthorized', message: 'Authentication required' })
      return
    }

    const hasRequired = required.some((role) => hasRole(auth.roles, role))
    if (!hasRequired) {
      res.status(403).json({
        error: 'forbidden',
        message: `Required role: ${required.join(' or ')}`,
        your_roles: auth.roles,
      })
      return
    }

    next()
  }
}

/**
 * Tenant scoping middleware.
 * Ensures the authenticated user belongs to the requested tenant.
 * Super admins and gov auditors can access cross-tenant data.
 */
export function requireTenant(tenantIdParam = 'tenantId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    const requestedTenantId = req.params[tenantIdParam] ?? req.query['tenant_id']
    if (!requestedTenantId) {
      // No explicit tenant requested — scope to user's own tenant
      next()
      return
    }

    // Super admins and gov auditors can access any tenant
    if (hasRole(auth.roles, 'super_admin') || hasRole(auth.roles, 'gov_auditor')) {
      next()
      return
    }

    // Regular users must match their own tenant
    if (requestedTenantId !== auth.tenant_id) {
      res.status(403).json({
        error: 'tenant_mismatch',
        message: 'You do not have access to this tenant',
      })
      return
    }

    next()
  }
}

/**
 * Optional auth middleware — does not reject unauthenticated requests,
 * but attaches auth context if a valid token is present.
 */
export function optionalAuth(config: AuthMiddlewareConfig) {
  const authMiddleware = createAuthMiddleware(config)

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.header('authorization')
    if (!header) {
      next()
      return
    }

    // Wrap to prevent 401 response — just skip if auth fails
    const stubRes = {
      status: () => ({ json: () => undefined }),
    } as unknown as Response

    await authMiddleware(req, stubRes, () => {
      // Auth succeeded or failed silently — either way, continue
      next()
    })
  }
}

// ── Dev bypass context ──────────────────────────────────────────────────────

function devAuthContext(env: AuthEnv): AuthContext {
  return {
    user_id: 'dev-user',
    email: 'dev@hive.local',
    name: 'Dev User',
    roles: ['admin'],
    tenant_id: env.HIVE_DEFAULT_TENANT_ID ?? '00000000-0000-0000-0000-000000000001',
    tenant_type: 'company',
    deployment_mode: env.HIVE_DEPLOYMENT_MODE,
    auth_method: 'oidc' as AuthMethod,
  }
}

function legacyAuthContext(env: AuthEnv): AuthContext {
  return {
    user_id: 'legacy-token',
    email: 'system@hive.local',
    name: 'Legacy Ingest',
    roles: ['operator'],
    tenant_id: env.HIVE_DEFAULT_TENANT_ID ?? '00000000-0000-0000-0000-000000000001',
    tenant_type: 'company',
    deployment_mode: env.HIVE_DEPLOYMENT_MODE as DeploymentMode,
    auth_method: 'legacy_token',
  }
}
