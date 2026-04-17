'use client'

import { useAuth } from '../../../lib/auth-context'

/* ── Glass card style ────────────────────────────────────────────────────── */
const glassCard = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
}

/* ── Role pill ───────────────────────────────────────────────────────────── */
function RolePill({ role }: { role: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    viewer: { bg: 'rgba(0,122,255,0.15)', text: '#007aff' },
    operator: { bg: 'rgba(175,82,222,0.15)', text: '#af52de' },
    admin: { bg: 'rgba(255,149,0,0.15)', text: '#ff9500' },
    super_admin: { bg: 'rgba(255,214,10,0.15)', text: '#ffd60a' },
    gov_auditor: { bg: 'rgba(52,199,89,0.15)', text: '#34c759' },
  }
  const c = colors[role] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' }
  return (
    <span style={{
      padding: '3px 8px',
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      background: c.bg,
      color: c.text,
    }}>
      {role.replace('_', ' ')}
    </span>
  )
}

/* ── Demo users (from Keycloak realm config) ─────────────────────────────── */
const DEMO_USERS = [
  { id: '1', email: 'admin@hive.local', name: 'HIVE Admin', roles: ['admin', 'operator', 'viewer'], lastLogin: '2026-04-16T10:30:00Z' },
  { id: '2', email: 'operator@hive.local', name: 'Demo Operator', roles: ['operator', 'viewer'], lastLogin: '2026-04-16T09:15:00Z' },
  { id: '3', email: 'viewer@hive.local', name: 'Demo Viewer', roles: ['viewer'], lastLogin: '2026-04-15T14:22:00Z' },
]

export default function UsersPage() {
  const { user } = useAuth()

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingTop: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'rgba(255,255,255,0.92)', margin: '0 0 4px' }}>
            User Management
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Manage users and role assignments for your organization
          </p>
        </div>
        <button style={{
          padding: '10px 20px',
          borderRadius: 10,
          border: 'none',
          background: '#ffd60a',
          color: '#0a0a0f',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          Invite User
        </button>
      </div>

      {/* Users table */}
      <div style={glassCard}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['User', 'Roles', 'Last Login', 'Actions'].map((h) => (
                <th key={h} style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'rgba(255,255,255,0.35)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEMO_USERS.map((u) => (
              <tr key={u.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(255,214,10,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#ffd60a',
                    }}>
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
                        {u.name}
                        {u.email === user?.email && (
                          <span style={{ fontSize: 10, color: 'rgba(255,214,10,0.6)', marginLeft: 6 }}>(you)</span>
                        )}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>{u.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {u.roles.map((r) => <RolePill key={r} role={r} />)}
                  </div>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(u.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <button style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info card */}
      <div style={{
        ...glassCard,
        marginTop: 20,
        borderLeftColor: 'rgba(0,122,255,0.3)',
        borderLeftWidth: 2,
      }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
          Users are managed through Keycloak SSO. Invite users by sending them a registration link.
          Role assignments sync automatically on login. Keycloak admin console is available at{' '}
          <code style={{ fontSize: 11, color: '#007aff', background: 'rgba(0,122,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>
            localhost:8080
          </code>{' '}
          for advanced identity management.
        </p>
      </div>
    </div>
  )
}
