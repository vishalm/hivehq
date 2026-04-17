/**
 * @hive/auth — User service.
 *
 * Syncs users from Keycloak on login and manages the local user record.
 * The local hive_users table serves as a cache and extension of Keycloak data,
 * enabling tenant-scoped user queries without hitting Keycloak for every request.
 */

import type { Role } from './types.js'

// ── Minimal pg types ────────────────────────────────────────────────────────

interface PgQueryResult<T = unknown> {
  rows: T[]
  rowCount: number | null
}

interface PgPool {
  query<T = unknown>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>
}

// ── User types ──────────────────────────────────────────────────────────────

export interface HiveUser {
  id: string
  email: string
  name: string | null
  tenant_id: string
  roles: Role[]
  last_login_at: Date | null
  created_at: Date
}

// ── User service ────────────────────────────────────────────────────────────

export class UserService {
  constructor(private readonly pool: PgPool) {}

  /**
   * Upsert a user on login — syncs from Keycloak claims.
   * Called after successful OIDC verification.
   */
  async syncFromLogin(params: {
    id: string
    email: string
    name: string
    tenant_id: string
    roles: Role[]
  }): Promise<HiveUser> {
    const res = await this.pool.query<UserRow>(
      `INSERT INTO hive_users (id, email, name, tenant_id, roles, last_login_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         roles = EXCLUDED.roles,
         last_login_at = now()
       RETURNING *`,
      [params.id, params.email, params.name, params.tenant_id, params.roles],
    )
    return rowToUser(res.rows[0]!)
  }

  /** Get user by ID */
  async getById(id: string): Promise<HiveUser | null> {
    const res = await this.pool.query<UserRow>(
      'SELECT * FROM hive_users WHERE id = $1',
      [id],
    )
    const row = res.rows[0]
    return row ? rowToUser(row) : null
  }

  /** Get user by email */
  async getByEmail(email: string): Promise<HiveUser | null> {
    const res = await this.pool.query<UserRow>(
      'SELECT * FROM hive_users WHERE email = $1',
      [email],
    )
    const row = res.rows[0]
    return row ? rowToUser(row) : null
  }

  /** List users for a tenant */
  async listByTenant(
    tenantId: string,
    opts: { limit?: number; offset?: number; search?: string } = {},
  ): Promise<{ users: HiveUser[]; total: number }> {
    const limit = Math.min(opts.limit ?? 50, 500)
    const offset = opts.offset ?? 0

    const conditions = ['tenant_id = $1']
    const values: unknown[] = [tenantId]
    let paramIdx = 2

    if (opts.search) {
      conditions.push(`(email ILIKE $${paramIdx} OR name ILIKE $${paramIdx})`)
      values.push(`%${opts.search}%`)
      paramIdx++
    }

    const where = conditions.join(' AND ')

    const countRes = await this.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM hive_users WHERE ${where}`,
      values,
    )
    const total = Number(countRes.rows[0]?.n ?? 0)

    const res = await this.pool.query<UserRow>(
      `SELECT * FROM hive_users WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...values, limit, offset],
    )

    return {
      users: res.rows.map(rowToUser),
      total,
    }
  }

  /** Update user roles */
  async updateRoles(userId: string, tenantId: string, roles: Role[]): Promise<HiveUser | null> {
    const res = await this.pool.query<UserRow>(
      'UPDATE hive_users SET roles = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [roles, userId, tenantId],
    )
    const row = res.rows[0]
    return row ? rowToUser(row) : null
  }

  /** Delete user */
  async delete(userId: string, tenantId: string): Promise<boolean> {
    const res = await this.pool.query(
      'DELETE FROM hive_users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId],
    )
    return (res.rowCount ?? 0) > 0
  }

  /** Count users for a tenant */
  async countByTenant(tenantId: string): Promise<number> {
    const res = await this.pool.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM hive_users WHERE tenant_id = $1',
      [tenantId],
    )
    return Number(res.rows[0]?.n ?? 0)
  }
}

// ── Row mapping ─────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  email: string
  name: string | null
  tenant_id: string
  roles: string[]
  last_login_at: Date | null
  created_at: Date
}

function rowToUser(row: UserRow): HiveUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    tenant_id: row.tenant_id,
    roles: row.roles as Role[],
    last_login_at: row.last_login_at,
    created_at: row.created_at,
  }
}
