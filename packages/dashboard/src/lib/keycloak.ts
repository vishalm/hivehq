/**
 * Keycloak OIDC configuration for the HIVE Dashboard.
 *
 * Uses Authorization Code Flow with PKCE (no client secret needed).
 * All token storage is in-memory only — no localStorage.
 */

// ── Environment ────────────────────────────────────────────────────────────

export const KEYCLOAK_URL = process.env['NEXT_PUBLIC_KEYCLOAK_URL'] ?? 'http://localhost:8080'
export const KEYCLOAK_REALM = process.env['NEXT_PUBLIC_KEYCLOAK_REALM'] ?? 'hive'
export const KEYCLOAK_CLIENT_ID = process.env['NEXT_PUBLIC_KEYCLOAK_CLIENT_ID'] ?? 'hive-dashboard'

export const KEYCLOAK_ISSUER = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`
export const KEYCLOAK_AUTH_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/auth`
export const KEYCLOAK_TOKEN_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`
export const KEYCLOAK_LOGOUT_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/logout`
export const KEYCLOAK_USERINFO_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`

// ── PKCE helpers ───────────────────────────────────────────────────────────

function generateRandomString(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, length)
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function generatePKCE(): Promise<{
  codeVerifier: string
  codeChallenge: string
}> {
  const codeVerifier = generateRandomString(64)
  const digest = await sha256(codeVerifier)
  const codeChallenge = base64UrlEncode(digest)
  return { codeVerifier, codeChallenge }
}

// ── Build auth URL ─────────────────────────────────────────────────────────

export function buildAuthUrl(params: {
  redirectUri: string
  codeChallenge: string
  state: string
  action?: 'login' | 'register'
}): string {
  const url = new URL(KEYCLOAK_AUTH_URL)
  url.searchParams.set('client_id', KEYCLOAK_CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email roles')
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', params.state)
  if (params.action === 'register') {
    url.searchParams.set('kc_action', 'register')
  }
  return url.toString()
}

// ── Token exchange ─────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  refresh_token: string
  id_token: string
  expires_in: number
  refresh_expires_in: number
  token_type: string
  scope: string
}

export async function exchangeCode(params: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KEYCLOAK_CLIENT_ID,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  })

  const res = await fetch(KEYCLOAK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${res.status} — ${text}`)
  }

  return res.json() as Promise<TokenResponse>
}

export async function refreshToken(token: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: KEYCLOAK_CLIENT_ID,
    refresh_token: token,
  })

  const res = await fetch(KEYCLOAK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`)
  }

  return res.json() as Promise<TokenResponse>
}

// ── Build logout URL ───────────────────────────────────────────────────────

export function buildLogoutUrl(idToken: string, redirectUri: string): string {
  const url = new URL(KEYCLOAK_LOGOUT_URL)
  url.searchParams.set('id_token_hint', idToken)
  url.searchParams.set('post_logout_redirect_uri', redirectUri)
  url.searchParams.set('client_id', KEYCLOAK_CLIENT_ID)
  return url.toString()
}

// ── JWT decode (no verification — just payload extraction) ─────────────────

export interface JWTPayload {
  sub: string
  email?: string
  preferred_username?: string
  name?: string
  given_name?: string
  family_name?: string
  roles?: string[]
  realm_access?: { roles: string[] }
  tenant_id?: string
  tenant_type?: string
  exp: number
  iat: number
}

export function decodeJWT(token: string): JWTPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const payload = parts[1]!
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decoded) as JWTPayload
}

export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  try {
    const payload = decodeJWT(token)
    return payload.exp * 1000 < Date.now() + bufferSeconds * 1000
  } catch {
    return true
  }
}
