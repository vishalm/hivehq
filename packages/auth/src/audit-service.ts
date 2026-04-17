/**
 * @hive/auth — Immutable audit log service.
 *
 * Records all security-relevant actions: logins, role changes,
 * API key creation/revocation, config changes, etc.
 *
 * The audit log is append-only — no UPDATE or DELETE operations.
 */

import type { ActorType, AuditEntry, AuthContext } from './types.js'

// ── Minimal pg types ────────────────────────────────────────────────────────

interface PgQueryResult<T = unknown> {
  rows: T[]
  rowCount: number | null
}

interface PgPool {
  query<T = unknown>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>
}

// ── Audit service ───────────────────────────────────────────────────────────

export interface AuditWriteParams {
  tenant_id: string
  actor_id: string | null
  actor_type: ActorType
  action: string
  resource?: string | null
  details?: Record<string, unknown> | null
  ip_address?: string | null
}

export class AuditService {
  constructor(private readonly pool: PgPool) {}

  /** Write an audit log entry */
  async log(params: AuditWriteParams): Promise<AuditEntry> {
    const res = await this.pool.query<AuditRow>(
      `INSERT INTO hive_audit_log (tenant_id, actor_id, actor_type, action, resource, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7::inet)
       RETURNING *`,
      [
        params.tenant_id,
        params.actor_id,
        params.actor_type,
        params.action,
        params.resource ?? null,
        params.details ? JSON.stringify(params.details) : null,
        params.ip_address ?? null,
      ],
    )
    return rowToAudit(res.rows[0]!)
  }

  /**
   * Convenience: log from an AuthContext.
   */
  async logFromAuth(
    auth: AuthContext,
    action: string,
    opts: { resource?: string; details?: Record<string, unknown>; ip?: string } = {},
  ): Promise<AuditEntry> {
    return this.log({
      tenant_id: auth.tenant_id,
      actor_id: auth.user_id,
      actor_type: auth.auth_method === 'api_key' ? 'api_key' : 'user',
      action,
      resource: opts.resource,
      details: opts.details,
      ip_address: opts.ip,
    })
  }

  /** Query audit log for a tenant */
  async query(opts: {
    tenant_id: string
    /** Optional: filter to specific tenant IDs (for cross-tenant audit) */
    tenant_ids?: string[]
    action?: string
    actor_id?: string
    actor_type?: ActorType
    from?: Date
    to?: Date
    limit?: number
    offset?: number
  }): Promise<{ entries: AuditEntry[]; total: number }> {
    const conditions: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    if (opts.tenant_ids && opts.tenant_ids.length > 0) {
      conditions.push(`tenant_id = ANY($${paramIdx++})`)
      values.push(opts.tenant_ids)
    } else {
      conditions.push(`tenant_id = $${paramIdx++}`)
      values.push(opts.tenant_id)
    }

    if (opts.action) {
      conditions.push(`action = $${paramIdx++}`)
      values.push(opts.action)
    }
    if (opts.actor_id) {
      conditions.push(`actor_id = $${paramIdx++}`)
      values.push(opts.actor_id)
    }
    if (opts.actor_type) {
      conditions.push(`actor_type = $${paramIdx++}`)
      values.push(opts.actor_type)
    }
    if (opts.from) {
      conditions.push(`created_at >= $${paramIdx++}`)
      values.push(opts.from)
    }
    if (opts.to) {
      conditions.push(`created_at <= $${paramIdx++}`)
      values.push(opts.to)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = Math.min(opts.limit ?? 50, 500)
    const offset = opts.offset ?? 0

    // Count total
    const countRes = await this.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM hive_audit_log ${where}`,
      values,
    )
    const total = Number(countRes.rows[0]?.n ?? 0)

    // Fetch page
    const res = await this.pool.query<AuditRow>(
      `SELECT * FROM hive_audit_log ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...values, limit, offset],
    )

    return {
      entries: res.rows.map(rowToAudit),
      total,
    }
  }

  /** Get audit log for a specific resource */
  async getResourceHistory(tenantId: string, resource: string): Promise<AuditEntry[]> {
    const res = await this.pool.query<AuditRow>(
      `SELECT * FROM hive_audit_log
       WHERE tenant_id = $1 AND resource = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [tenantId, resource],
    )
    return res.rows.map(rowToAudit)
  }
}

// ── Row mapping ─────────────────────────────────────────────────────────────

interface AuditRow {
  id: string
  tenant_id: string
  actor_id: string | null
  actor_type: string
  action: string
  resource: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: Date
}

function rowToAudit(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    actor_id: row.actor_id,
    actor_type: row.actor_type as ActorType,
    action: row.action,
    resource: row.resource,
    details: row.details,
    ip_address: row.ip_address,
    created_at: row.created_at,
  }
}
