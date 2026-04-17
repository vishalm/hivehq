/**
 * @hive/auth — Tenant service for CRUD and hierarchy traversal.
 *
 * Supports the full tenant hierarchy:
 *   Country > Government > Group > Enterprise > Company
 *
 * Provides recursive child lookup for super_admin and gov_auditor roles.
 */

import type { TenantNode, TenantCreate, TenantUpdate } from './types.js'

// ── Minimal pg types ────────────────────────────────────────────────────────

interface PgQueryResult<T = unknown> {
  rows: T[]
  rowCount: number | null
}

interface PgPool {
  query<T = unknown>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>
}

// ── Tenant service ──────────────────────────────────────────────────────────

export class TenantService {
  constructor(private readonly pool: PgPool) {}

  /** Get a single tenant by ID */
  async getById(id: string): Promise<TenantNode | null> {
    const res = await this.pool.query<TenantRow>(
      'SELECT * FROM hive_tenants WHERE id = $1',
      [id],
    )
    const row = res.rows[0]
    return row ? rowToTenant(row) : null
  }

  /** Get a tenant by slug */
  async getBySlug(slug: string): Promise<TenantNode | null> {
    const res = await this.pool.query<TenantRow>(
      'SELECT * FROM hive_tenants WHERE slug = $1',
      [slug],
    )
    const row = res.rows[0]
    return row ? rowToTenant(row) : null
  }

  /** List all tenants, optionally filtered */
  async list(opts: {
    tenant_type?: string
    country_code?: string
    parent_id?: string | null
    limit?: number
    offset?: number
  } = {}): Promise<TenantNode[]> {
    const conditions: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    if (opts.tenant_type) {
      conditions.push(`tenant_type = $${paramIdx++}`)
      values.push(opts.tenant_type)
    }
    if (opts.country_code) {
      conditions.push(`country_code = $${paramIdx++}`)
      values.push(opts.country_code)
    }
    if (opts.parent_id !== undefined) {
      if (opts.parent_id === null) {
        conditions.push('parent_id IS NULL')
      } else {
        conditions.push(`parent_id = $${paramIdx++}`)
        values.push(opts.parent_id)
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = Math.min(opts.limit ?? 100, 500)
    const offset = opts.offset ?? 0

    const res = await this.pool.query<TenantRow>(
      `SELECT * FROM hive_tenants ${where} ORDER BY name LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...values, limit, offset],
    )
    return res.rows.map(rowToTenant)
  }

  /** Create a new tenant */
  async create(data: TenantCreate): Promise<TenantNode> {
    const res = await this.pool.query<TenantRow>(
      `INSERT INTO hive_tenants (parent_id, tenant_type, name, slug, country_code, data_residency, regulation_tags, plan, keycloak_realm, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.parent_id,
        data.tenant_type,
        data.name,
        data.slug,
        data.country_code,
        data.data_residency,
        data.regulation_tags,
        data.plan,
        data.keycloak_realm,
        JSON.stringify(data.settings),
      ],
    )
    return rowToTenant(res.rows[0]!)
  }

  /** Update a tenant */
  async update(id: string, data: TenantUpdate): Promise<TenantNode | null> {
    const sets: string[] = ['updated_at = now()']
    const values: unknown[] = []
    let paramIdx = 1

    const fields: (keyof TenantUpdate)[] = [
      'parent_id', 'tenant_type', 'name', 'country_code',
      'data_residency', 'regulation_tags', 'plan', 'keycloak_realm', 'settings',
    ]

    for (const field of fields) {
      if (data[field] !== undefined) {
        sets.push(`${field} = $${paramIdx++}`)
        values.push(field === 'settings' ? JSON.stringify(data[field]) : data[field])
      }
    }

    values.push(id)
    const res = await this.pool.query<TenantRow>(
      `UPDATE hive_tenants SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values,
    )
    const row = res.rows[0]
    return row ? rowToTenant(row) : null
  }

  /** Delete a tenant (cascades to users, api keys, audit log) */
  async delete(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM hive_tenants WHERE id = $1', [id])
    return (res.rowCount ?? 0) > 0
  }

  /**
   * Get the full hierarchy path from a tenant up to the root.
   * Returns [root, ..., parent, self].
   */
  async getHierarchyPath(tenantId: string): Promise<TenantNode[]> {
    const res = await this.pool.query<TenantRow>(
      `WITH RECURSIVE ancestors AS (
        SELECT * FROM hive_tenants WHERE id = $1
        UNION ALL
        SELECT t.* FROM hive_tenants t
        JOIN ancestors a ON t.id = a.parent_id
      )
      SELECT * FROM ancestors ORDER BY
        CASE tenant_type
          WHEN 'country' THEN 1
          WHEN 'government' THEN 2
          WHEN 'group' THEN 3
          WHEN 'enterprise' THEN 4
          WHEN 'company' THEN 5
        END`,
      [tenantId],
    )
    return res.rows.map(rowToTenant)
  }

  /**
   * Get all descendant tenants recursively.
   * Used by super_admin to see all companies under their group/enterprise,
   * and by gov_auditor to see all companies in a country.
   */
  async getDescendants(tenantId: string): Promise<TenantNode[]> {
    const res = await this.pool.query<TenantRow>(
      `WITH RECURSIVE descendants AS (
        SELECT * FROM hive_tenants WHERE parent_id = $1
        UNION ALL
        SELECT t.* FROM hive_tenants t
        JOIN descendants d ON t.parent_id = d.id
      )
      SELECT * FROM descendants ORDER BY name`,
      [tenantId],
    )
    return res.rows.map(rowToTenant)
  }

  /**
   * Get all tenant IDs that a user can access based on their role.
   * - viewer/operator/admin: only their own tenant
   * - super_admin: their tenant + all descendants
   * - gov_auditor: all tenants in their country
   */
  async getAccessibleTenantIds(
    tenantId: string,
    roles: string[],
    countryCode?: string,
  ): Promise<string[]> {
    // Gov auditor — all tenants in country
    if (roles.includes('gov_auditor') && countryCode) {
      const res = await this.pool.query<{ id: string }>(
        'SELECT id FROM hive_tenants WHERE country_code = $1',
        [countryCode],
      )
      return res.rows.map((r) => r.id)
    }

    // Super admin — own tenant + descendants
    if (roles.includes('super_admin')) {
      const descendants = await this.getDescendants(tenantId)
      return [tenantId, ...descendants.map((d) => d.id)]
    }

    // Regular user — own tenant only
    return [tenantId]
  }
}

// ── Row mapping ─────────────────────────────────────────────────────────────

interface TenantRow {
  id: string
  parent_id: string | null
  tenant_type: string
  name: string
  slug: string
  country_code: string
  data_residency: string
  regulation_tags: string[]
  plan: string
  keycloak_realm: string | null
  settings: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

function rowToTenant(row: TenantRow): TenantNode {
  return {
    id: row.id,
    parent_id: row.parent_id,
    tenant_type: row.tenant_type as TenantNode['tenant_type'],
    name: row.name,
    slug: row.slug,
    country_code: row.country_code.trim(),
    data_residency: row.data_residency,
    regulation_tags: row.regulation_tags ?? [],
    plan: row.plan as TenantNode['plan'],
    keycloak_realm: row.keycloak_realm,
    settings: row.settings ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
