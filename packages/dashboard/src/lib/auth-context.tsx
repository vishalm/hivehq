'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  buildAuthUrl,
  buildLogoutUrl,
  generatePKCE,
  exchangeCode,
  refreshToken as doRefreshToken,
  decodeJWT,
  isTokenExpired,
  type TokenResponse,
  type JWTPayload,
} from './keycloak'

// ── Auth user shape ────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  roles: string[]
  tenant_id: string
  tenant_type: string
}

// ── Auth context ───────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Current authenticated user (null if not logged in) */
  user: AuthUser | null
  /** Raw access token for API calls */
  accessToken: string | null
  /** Whether auth initialization is still in progress */
  loading: boolean
  /** Redirect to Keycloak login */
  login: (action?: 'login' | 'register') => Promise<void>
  /** Logout and redirect to Keycloak end-session */
  logout: () => void
  /** Check if user has a specific role (with hierarchy) */
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  hasRole: () => false,
})

export function useAuth() {
  return useContext(AuthContext)
}

// ── Role hierarchy ─────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, string[]> = {
  viewer: [],
  operator: ['viewer'],
  admin: ['operator', 'viewer'],
  super_admin: ['admin', 'operator', 'viewer'],
  gov_auditor: [],
}

function userHasRole(userRoles: string[], required: string): boolean {
  return userRoles.some(
    (r) => r === required || (ROLE_HIERARCHY[r]?.includes(required) ?? false),
  )
}

// ── In-memory token store (no localStorage!) ───────────────────────────────

let _tokens: TokenResponse | null = null
let _pkceVerifier: string | null = null
let _pkceState: string | null = null

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const extractUser = useCallback((payload: JWTPayload): AuthUser => {
    const roles = payload.roles
      ?? payload.realm_access?.roles?.filter((r) => ['viewer', 'operator', 'admin', 'super_admin', 'gov_auditor'].includes(r))
      ?? []
    return {
      id: payload.sub,
      email: payload.email ?? payload.preferred_username ?? '',
      name: payload.name ?? (`${payload.given_name ?? ''} ${payload.family_name ?? ''}`.trim() || 'User'),
      roles,
      tenant_id: payload.tenant_id ?? '00000000-0000-0000-0000-000000000001',
      tenant_type: payload.tenant_type ?? 'company',
    }
  }, [])

  const setTokens = useCallback((tokens: TokenResponse) => {
    _tokens = tokens
    setAccessToken(tokens.access_token)
    const payload = decodeJWT(tokens.access_token)
    setUser(extractUser(payload))
  }, [extractUser])

  // Handle OIDC callback
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (code && state && _pkceVerifier && state === _pkceState) {
      const redirectUri = `${window.location.origin}/auth/callback`
      exchangeCode({ code, codeVerifier: _pkceVerifier, redirectUri })
        .then((tokens) => {
          setTokens(tokens)
          _pkceVerifier = null
          _pkceState = null
          // Clean URL
          window.history.replaceState({}, '', '/dashboard')
          setLoading(false)
        })
        .catch((err) => {
          console.error('Token exchange failed:', err)
          setLoading(false)
        })
      return
    }

    // Check if we have existing tokens (from a previous exchange in this session)
    if (_tokens && !isTokenExpired(_tokens.access_token)) {
      const payload = decodeJWT(_tokens.access_token)
      setUser(extractUser(payload))
      setAccessToken(_tokens.access_token)
      setLoading(false)
      return
    }

    // Try to refresh if we have a refresh token
    if (_tokens?.refresh_token && !isTokenExpired(_tokens.refresh_token, 60)) {
      doRefreshToken(_tokens.refresh_token)
        .then((tokens) => {
          setTokens(tokens)
          setLoading(false)
        })
        .catch(() => {
          _tokens = null
          setLoading(false)
        })
      return
    }

    // No valid session
    setLoading(false)
  }, [extractUser, setTokens])

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!_tokens) return

    const payload = decodeJWT(_tokens.access_token)
    const expiresIn = payload.exp * 1000 - Date.now()
    // Refresh 60 seconds before expiry
    const refreshIn = Math.max(expiresIn - 60_000, 1000)

    const timer = setTimeout(() => {
      if (_tokens?.refresh_token) {
        doRefreshToken(_tokens.refresh_token)
          .then(setTokens)
          .catch(() => {
            _tokens = null
            setUser(null)
            setAccessToken(null)
          })
      }
    }, refreshIn)

    return () => clearTimeout(timer)
  }, [accessToken, setTokens])

  const login = useCallback(async (action?: 'login' | 'register') => {
    const { codeVerifier, codeChallenge } = await generatePKCE()
    const state = crypto.randomUUID()
    _pkceVerifier = codeVerifier
    _pkceState = state

    const redirectUri = `${window.location.origin}/auth/callback`
    const authUrl = buildAuthUrl({
      redirectUri,
      codeChallenge,
      state,
      action,
    })

    window.location.href = authUrl
  }, [])

  const logout = useCallback(() => {
    const idToken = _tokens?.id_token
    _tokens = null
    setUser(null)
    setAccessToken(null)

    if (idToken) {
      const logoutUrl = buildLogoutUrl(idToken, window.location.origin)
      window.location.href = logoutUrl
    } else {
      window.location.href = '/'
    }
  }, [])

  const hasRole = useCallback((role: string): boolean => {
    if (!user) return false
    return userHasRole(user.roles, role)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}
