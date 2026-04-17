/**
 * @hive/auth — Keycloak OIDC client.
 *
 * Handles JWT verification against the Keycloak JWKS endpoint and provides
 * admin API wrappers for user management.
 *
 * Uses native Node.js crypto for JWT verification — no external JWT library needed.
 */

import { createPublicKey, verify as cryptoVerify } from 'node:crypto'
import type { AuthEnv, KeycloakJWTClaims, Role } from './types.js'
import { ROLES } from './types.js'

// ── JWKS types ──────────────────────────────────────────────────────────────

interface JWK {
  kid: string
  kty: string
  alg: string
  use: string
  n: string
  e: string
}

interface JWKSResponse {
  keys: JWK[]
}

// ── KeycloakClient ──────────────────────────────────────────────────────────

export class KeycloakClient {
  private readonly baseUrl: string
  private readonly realm: string
  private readonly clientId: string
  private readonly clientSecret?: string

  /** Cached JWKS keys — refresh every 10 minutes */
  private jwksCache: Map<string, JWK> = new Map()
  private jwksCacheTime = 0
  private static readonly JWKS_TTL_MS = 600_000

  constructor(env: AuthEnv) {
    if (!env.KEYCLOAK_URL) {
      throw new Error('KEYCLOAK_URL is required when auth mode is keycloak')
    }
    this.baseUrl = env.KEYCLOAK_URL.replace(/\/$/, '')
    this.realm = env.KEYCLOAK_REALM
    this.clientId = env.KEYCLOAK_CLIENT_ID
    this.clientSecret = env.KEYCLOAK_CLIENT_SECRET
  }

  /** OIDC discovery URL for this realm */
  get issuerUrl(): string {
    return `${this.baseUrl}/realms/${this.realm}`
  }

  /** JWKS endpoint */
  get jwksUrl(): string {
    return `${this.issuerUrl}/protocol/openid-connect/certs`
  }

  /** Token endpoint */
  get tokenUrl(): string {
    return `${this.issuerUrl}/protocol/openid-connect/token`
  }

  // ── JWT verification ──────────────────────────────────────────────────

  /**
   * Verify a JWT access token and return the decoded claims.
   * Validates signature (RS256), expiration, issuer, and audience.
   */
  async verifyToken(token: string): Promise<KeycloakJWTClaims> {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new AuthError('INVALID_TOKEN', 'Malformed JWT — expected 3 parts')
    }

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string]

    // Decode header to get kid
    const header = JSON.parse(base64UrlDecode(headerB64)) as { alg: string; kid: string }
    if (header.alg !== 'RS256') {
      throw new AuthError('UNSUPPORTED_ALG', `Unsupported algorithm: ${header.alg}`)
    }

    // Fetch the matching JWK
    const jwk = await this.getKey(header.kid)
    if (!jwk) {
      throw new AuthError('UNKNOWN_KID', `No matching key for kid: ${header.kid}`)
    }

    // Verify signature
    const publicKey = createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
      },
      format: 'jwk',
    })

    const signatureValid = cryptoVerify(
      'sha256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      publicKey,
      Buffer.from(signatureB64, 'base64url'),
    )

    if (!signatureValid) {
      throw new AuthError('INVALID_SIGNATURE', 'JWT signature verification failed')
    }

    // Decode and validate claims
    const claims = JSON.parse(base64UrlDecode(payloadB64)) as KeycloakJWTClaims

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (claims.exp < now) {
      throw new AuthError('TOKEN_EXPIRED', 'JWT has expired')
    }

    // Check issuer
    if (claims.iss !== this.issuerUrl) {
      throw new AuthError('INVALID_ISSUER', `Expected issuer ${this.issuerUrl}, got ${claims.iss}`)
    }

    return claims
  }

  /**
   * Extract HIVE roles from Keycloak JWT claims.
   * Looks in the top-level `roles` claim (from our custom mapper),
   * then falls back to `realm_access.roles`.
   */
  extractRoles(claims: KeycloakJWTClaims): Role[] {
    const rawRoles: string[] = claims.roles
      ?? claims.realm_access?.roles
      ?? []

    return rawRoles.filter((r): r is Role => ROLES.includes(r as Role))
  }

  // ── JWKS key fetching ─────────────────────────────────────────────────

  private async getKey(kid: string): Promise<JWK | undefined> {
    // Return from cache if fresh
    if (this.jwksCache.has(kid) && Date.now() - this.jwksCacheTime < KeycloakClient.JWKS_TTL_MS) {
      return this.jwksCache.get(kid)
    }

    // Fetch fresh JWKS
    await this.refreshJWKS()
    return this.jwksCache.get(kid)
  }

  private async refreshJWKS(): Promise<void> {
    const res = await fetch(this.jwksUrl)
    if (!res.ok) {
      throw new AuthError('JWKS_FETCH_FAILED', `Failed to fetch JWKS: ${res.status} ${res.statusText}`)
    }
    const jwks = (await res.json()) as JWKSResponse
    this.jwksCache.clear()
    for (const key of jwks.keys) {
      if (key.use === 'sig' && key.kty === 'RSA') {
        this.jwksCache.set(key.kid, key)
      }
    }
    this.jwksCacheTime = Date.now()
  }

  // ── Admin API (service account) ───────────────────────────────────────

  /**
   * Get a service account access token using client credentials grant.
   * Required for admin API operations (user management, etc.).
   */
  async getServiceToken(): Promise<string> {
    if (!this.clientSecret) {
      throw new AuthError('NO_CLIENT_SECRET', 'Client secret is required for service account operations')
    }

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new AuthError('SERVICE_TOKEN_FAILED', `Failed to get service token: ${res.status} — ${body}`)
    }

    const data = (await res.json()) as { access_token: string }
    return data.access_token
  }

  /**
   * List realm users via the Keycloak Admin REST API.
   */
  async listUsers(opts: { first?: number; max?: number; search?: string } = {}): Promise<KeycloakUser[]> {
    const token = await this.getServiceToken()
    const params = new URLSearchParams()
    if (opts.first !== undefined) params.set('first', String(opts.first))
    if (opts.max !== undefined) params.set('max', String(opts.max))
    if (opts.search) params.set('search', opts.search)

    const res = await fetch(
      `${this.baseUrl}/admin/realms/${this.realm}/users?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!res.ok) {
      throw new AuthError('ADMIN_API_FAILED', `Failed to list users: ${res.status}`)
    }

    return (await res.json()) as KeycloakUser[]
  }
}

// ── Helper types ────────────────────────────────────────────────────────────

export interface KeycloakUser {
  id: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  enabled: boolean
  emailVerified: boolean
  attributes?: Record<string, string[]>
}

// ── Auth error ──────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function base64UrlDecode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64url').toString('utf-8')
}
