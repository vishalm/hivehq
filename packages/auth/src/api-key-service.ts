/**
 * @hive/auth — API Key service.
 *
 * Generates, validates, rotates, and revokes HIVE API keys.
 *
 * Key format: hive_ak_XXXXXXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYYYYYY
 *   - hive_ak_ prefix (8 chars)
 *   - 12-char prefix (stored in plaintext for lookup)
 *   - _ separator
 *   - 28-char secret (stored as SHA-256 hash)
 *
 * Lookup flow: extract prefix → query by prefix → hash verify → resolve tenant.
 */

import { createHash, randomBytes } from 'node:crypto'
import type { ApiKey, ApiKeyCreate, Role, TenantType } from './types.js'
import type { ApiKeyResolution } from './middleware.js'

// ── Minimal pg types ────────────────────────────────────────────────────────

interface PgQueryResult<T = unknown> {
  rows: T[]
  rowCount: number | null
}

interface PgPool {
  query<T = unknown>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>
}

// ── API Key service ─────────────────────────────────────────────────────────

export class ApiKeyService {
  constructor(private readonly pool: PgPool) {}

  /**
   * Generate a new API key for a tenant.
   * Returns the full key (only shown once) and the stored record.
   */
  async generate(tenantId: string, data: ApiKeyCreate): Promise<{ key: string; record: ApiKey }> {
    const prefix = randomAlphanumeric(12)
    const secret = randomAlphanumeric(28)
    const fullKey = `hive_ak_${prefix}_${secret}`
    const keyHash = sha256(fullKey)

    const res = await this.pool.query<ApiKeyRow>(
      `INSERT INTO hive_api_keys (tenant_id, name, key_prefix, key_hash, roles, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        data.name,
        prefix,
        keyHash,
        data.roles,
        data.expires_at,
      ],
    )

    return {
      key: fullKey,
      record: rowToApiKey(res.rows[0]!),
    }
  }

  /**
   * Resolve an API key from its full token string.
   * Returns null if key not found, revoked, or expired.
   */
  async resolve(prefix: string, rawKey: string): Promise<ApiKeyResolution | null> {
    const res = await this.pool.query<ApiKeyRow & { tenant_type: string }>(
      `SELECT k.*, t.tenant_type
       FROM hive_api_keys k
       JOIN hive_tenants t ON t.id = k.tenant_id
       WHERE k.key_prefix = $1
         AND k.revoked_at IS NULL`,
      [prefix],
    )

    const row = res.rows[0]
    if (!row) return null

    // Verify hash
    const hash = sha256(rawKey)
    if (hash !== row.key_hash) return null

    // Check expiration
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null

    // Update last_used_at
    await this.pool.query(
      'UPDATE hive_api_keys SET last_used_at = now() WHERE id = $1',
      [row.id],
    )

    return {
      key_id: row.id,
      tenant_id: row.tenant_id,
      tenant_type: row.tenant_type as TenantType,
      roles: row.roles as Role[],
    }
  }

  /** List API keys for a tenant (secrets are never returned) */
  async listByTenant(tenantId: string): Promise<ApiKey[]> {
    const res = await this.pool.query<ApiKeyRow>(
      `SELECT * FROM hive_api_keys
       WHERE tenant_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [tenantId],
    )
    return res.rows.map(rowToApiKey)
  }

  /** Revoke an API key (soft delete) */
  async revoke(keyId: string, tenantId: string): Promise<boolean> {
    const res = await this.pool.query(
      'UPDATE hive_api_keys SET revoked_at = now() WHERE id = $1 AND tenant_id = $2',
      [keyId, tenantId],
    )
    return (res.rowCount ?? 0) > 0
  }

  /** Count active keys for a tenant */
  async countByTenant(tenantId: string): Promise<number> {
    const res = await this.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM hive_api_keys
       WHERE tenant_id = $1 AND revoked_at IS NULL`,
      [tenantId],
    )
    return Number(res.rows[0]?.n ?? 0)
  }
}

// ── Row mapping ─────────────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string
  tenant_id: string
  name: string
  key_prefix: string
  key_hash: string
  roles: string[]
  last_used_at: Date | null
  expires_at: Date | null
  revoked_at: Date | null
  created_at: Date
}

function rowToApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    key_prefix: row.key_prefix,
    key_hash: '***', // never expose hash
    roles: row.roles as Role[],
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function randomAlphanumeric(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i]! % chars.length]
  }
  return result
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
