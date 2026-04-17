'use client'

import { useState } from 'react'

const glassCard = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
}

/* ── Action type styling ───────────────────────────────────────────────── */
function ActionPill({ action }: { action: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'auth.login': { bg: 'rgba(52,199,89,0.15)', text: '#34c759' },
    'auth.logout': { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' },
    'auth.login_failed': { bg: 'rgba(255,59,48,0.15)', text: '#ff3b30' },
    'api_key.created': { bg: 'rgba(0,122,255,0.15)', text: '#007aff' },
    'api_key.revoked': { bg: 'rgba(255,149,0,0.15)', text: '#ff9500' },
    'user.role_changed': { bg: 'rgba(175,82,222,0.15)', text: '#af52de' },
    'user.invited': { bg: 'rgba(0,122,255,0.15)', text: '#007aff' },
    'config.updated': { bg: 'rgba(255,214,10,0.15)', text: '#ffd60a' },
    'tenant.created': { bg: 'rgba(52,199,89,0.15)', text: '#34c759' },
    'governance.violation': { bg: 'rgba(255,59,48,0.15)', text: '#ff3b30' },
  }
  const c = colors[action] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' }
  return (
    <span style={{
      padding: '3px 8px',
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0.3,
      background: c.bg,
      color: c.text,
      fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace",
    }}>
      {action}
    </span>
  )
}

/* ── Severity dot ──────────────────────────────────────────────────────── */
function SeverityDot({ level }: { level: string }) {
  const color: Record<string, string> = {
    info: '#007aff',
    warn: '#ff9500',
    error: '#ff3b30',
    critical: '#ff3b30',
  }
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color[level] ?? 'rgba(255,255,255,0.3)',
      boxShadow: level === 'critical' ? `0 0 6px ${color[level]}` : 'none',
    }} />
  )
}

/* ── Demo audit entries ────────────────────────────────────────────────── */
const DEMO_AUDIT: {
  id: string
  timestamp: string
  action: string
  severity: string
  actor_email: string
  actor_role: string
  resource_type: string
  resource_id: string
  detail: string
  ip: string
}[] = [
  {
    id: '1',
    timestamp: '2026-04-16T10:30:12Z',
    action: 'auth.login',
    severity: 'info',
    actor_email: 'admin@hive.local',
    actor_role: 'admin',
    resource_type: 'session',
    resource_id: 'sess_a1b2c3',
    detail: 'OIDC login via Keycloak',
    ip: '10.0.1.42',
  },
  {
    id: '2',
    timestamp: '2026-04-16T10:28:05Z',
    action: 'api_key.created',
    severity: 'info',
    actor_email: 'admin@hive.local',
    actor_role: 'admin',
    resource_type: 'api_key',
    resource_id: 'hive_ak_aB3x',
    detail: 'Created key "Scout Agent" with operator role',
    ip: '10.0.1.42',
  },
  {
    id: '3',
    timestamp: '2026-04-16T09:45:33Z',
    action: 'user.role_changed',
    severity: 'warn',
    actor_email: 'admin@hive.local',
    actor_role: 'admin',
    resource_type: 'user',
    resource_id: 'user_op01',
    detail: 'Roles changed: [viewer] -> [operator, viewer]',
    ip: '10.0.1.42',
  },
  {
    id: '4',
    timestamp: '2026-04-16T09:15:20Z',
    action: 'auth.login',
    severity: 'info',
    actor_email: 'operator@hive.local',
    actor_role: 'operator',
    resource_type: 'session',
    resource_id: 'sess_d4e5f6',
    detail: 'OIDC login via Keycloak',
    ip: '10.0.1.55',
  },
  {
    id: '5',
    timestamp: '2026-04-16T08:52:11Z',
    action: 'auth.login_failed',
    severity: 'error',
    actor_email: 'unknown@external.com',
    actor_role: 'none',
    resource_type: 'session',
    resource_id: 'n/a',
    detail: 'Invalid credentials (3rd attempt)',
    ip: '203.0.113.99',
  },
  {
    id: '6',
    timestamp: '2026-04-16T08:30:00Z',
    action: 'config.updated',
    severity: 'warn',
    actor_email: 'admin@hive.local',
    actor_role: 'admin',
    resource_type: 'config',
    resource_id: 'cost_model',
    detail: 'Updated cost model: gpt-4o input $2.50 -> $2.00 per 1M tokens',
    ip: '10.0.1.42',
  },
  {
    id: '7',
    timestamp: '2026-04-15T17:00:45Z',
    action: 'governance.violation',
    severity: 'critical',
    actor_email: 'system',
    actor_role: 'system',
    resource_type: 'ttp_event',
    resource_id: 'evt_xyz789',
    detail: 'GovernanceBlock missing on ingest from unregistered provider',
    ip: '10.0.2.10',
  },
  {
    id: '8',
    timestamp: '2026-04-15T14:22:10Z',
    action: 'auth.login',
    severity: 'info',
    actor_email: 'viewer@hive.local',
    actor_role: 'viewer',
    resource_type: 'session',
    resource_id: 'sess_g7h8i9',
    detail: 'OIDC login via Keycloak',
    ip: '10.0.1.80',
  },
]

const ACTION_FILTERS = [
  'All',
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'api_key.created',
  'api_key.revoked',
  'user.role_changed',
  'config.updated',
  'governance.violation',
]

const SEVERITY_FILTERS = ['All', 'info', 'warn', 'error', 'critical']

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState('All')
  const [severityFilter, setSeverityFilter] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = DEMO_AUDIT.filter((e) => {
    if (actionFilter !== 'All' && e.action !== actionFilter) return false
    if (severityFilter !== 'All' && e.severity !== severityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        e.actor_email.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.resource_id.toLowerCase().includes(q) ||
        e.ip.includes(q)
      )
    }
    return true
  })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'rgba(255,255,255,0.92)', margin: '0 0 4px' }}>
          Audit Log
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          Immutable record of all authentication, authorization, and configuration events
        </p>
      </div>

      {/* Filters */}
      <div style={{ ...glassCard, marginBottom: 20, padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ flex: '1 1 220px', minWidth: 180 }}>
          <input
            type="text"
            placeholder="Search by email, detail, resource, or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.92)',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Action filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Action
          </span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
              fontFamily: "'SF Mono', monospace",
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {ACTION_FILTERS.map((a) => (
              <option key={a} value={a} style={{ background: '#12121a' }}>{a}</option>
            ))}
          </select>
        </div>

        {/* Severity filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Severity
          </span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {SEVERITY_FILTERS.map((s) => (
              <option key={s} value={s} style={{ background: '#12121a' }}>{s}</option>
            ))}
          </select>
        </div>

        {/* Result count */}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Audit log table */}
      <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['', 'Timestamp', 'Action', 'Actor', 'Resource', 'Detail', 'IP'].map((h) => (
                <th key={h} style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'rgba(255,255,255,0.35)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent' }}>
                {/* Severity */}
                <td style={{ padding: '12px 6px 12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                  <SeverityDot level={e.severity} />
                </td>
                {/* Timestamp */}
                <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'SF Mono', monospace", whiteSpace: 'nowrap' }}>
                  {new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                  {new Date(e.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </td>
                {/* Action */}
                <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <ActionPill action={e.action} />
                </td>
                {/* Actor */}
                <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{e.actor_email}</span>
                </td>
                {/* Resource */}
                <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <code style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', padding: '2px 5px', borderRadius: 3, fontFamily: "'SF Mono', monospace" }}>
                    {e.resource_type}/{e.resource_id}
                  </code>
                </td>
                {/* Detail */}
                <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.55)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.detail}
                </td>
                {/* IP */}
                <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: "'SF Mono', monospace" }}>
                  {e.ip}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No audit events match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info card */}
      <div style={{ ...glassCard, marginTop: 20, borderLeftColor: 'rgba(0,122,255,0.3)', borderLeftWidth: 2 }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
          The audit log is append-only and immutable. Every authentication, authorization change, and configuration
          modification is recorded with actor identity, timestamp, IP address, and resource context.
          Entries cannot be edited or deleted. Governance auditors with the{' '}
          <code style={{ fontSize: 11, color: '#34c759', background: 'rgba(52,199,89,0.08)', padding: '1px 4px', borderRadius: 3 }}>gov_auditor</code>{' '}
          role have read-only access to the full log across all tenants.
        </p>
      </div>
    </div>
  )
}
