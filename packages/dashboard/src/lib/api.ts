/**
 * Auth-aware API client for HIVE dashboard.
 *
 * Server-side (SSR) fetches use DASHBOARD_NODE_URL and don't need auth tokens.
 * Client-side fetches use NEXT_PUBLIC_NODE_URL and include the Bearer token.
 */

const isServer = typeof window === 'undefined'

/** Get the base API URL */
export function getApiBase(): string {
  if (isServer) {
    return process.env['DASHBOARD_NODE_URL'] ?? 'http://localhost:3000'
  }
  return (
    process.env['NEXT_PUBLIC_NODE_URL'] ?? 'http://localhost:3000'
  )
}

/**
 * Fetch wrapper that adds Authorization header when a token is available.
 * For server-side calls, no auth header is added (internal network).
 */
export async function apiFetch(
  path: string,
  opts: {
    token?: string | null
    method?: string
    body?: unknown
    cache?: RequestCache
  } = {},
): Promise<Response> {
  const base = getApiBase()
  const headers: Record<string, string> = {}

  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`
  }

  if (opts.body) {
    headers['Content-Type'] = 'application/json'
  }

  return fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? 'no-store',
  })
}
