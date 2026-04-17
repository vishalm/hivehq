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

/* ── Demo API keys ──────────────────────────────────────────────────────── */
const DEMO_KEYS = [
  { id: '1', name: 'Scout Agent', prefix: 'hive_ak_aB3x', roles: ['operator'], lastUsed: '2026-04-16T10:00:00Z', created: '2026-04-15T08:00:00Z' },
  { id: '2', name: 'CI/CD Pipeline', prefix: 'hive_ak_Xk9m', roles: ['operator'], lastUsed: '2026-04-14T16:30:00Z', created: '2026-04-10T12:00:00Z' },
]

export default function ApiKeysPage() {
  const [showGenerate, setShowGenerate] = useState(false)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'rgba(255,255,255,0.92)', margin: '0 0 4px' }}>
            API Keys
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Machine-to-machine authentication for TTP ingest
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(!showGenerate)}
          style={{
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
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Generate Key
        </button>
      </div>

      {/* Generate key form */}
      {showGenerate && (
        <div style={{ ...glassCard, marginBottom: 20, borderColor: 'rgba(255,214,10,0.2)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: '0 0 16px' }}>
            Generate New API Key
          </h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                Key Name
              </label>
              <input
                type="text"
                placeholder="e.g., Scout Agent Production"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
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
              whiteSpace: 'nowrap',
            }}>
              Create
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '10px 0 0' }}>
            The full key is shown only once. Store it securely.
          </p>
        </div>
      )}

      {/* Keys table */}
      <div style={glassCard}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Key Prefix', 'Role', 'Last Used', 'Created', 'Actions'].map((h) => (
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
            {DEMO_KEYS.map((k) => (
              <tr key={k.id}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                  {k.name}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <code style={{ fontSize: 11, color: '#007aff', background: 'rgba(0,122,255,0.08)', padding: '2px 6px', borderRadius: 4, fontFamily: "'SF Mono', monospace" }}>
                    {k.prefix}...
                  </code>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', background: 'rgba(175,82,222,0.15)', color: '#af52de' }}>
                    {k.roles[0]}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(k.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  {new Date(k.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <button style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,59,48,0.2)',
                    background: 'rgba(255,59,48,0.06)',
                    color: '#ff3b30',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key format info */}
      <div style={{ ...glassCard, marginTop: 20, borderLeftColor: 'rgba(0,122,255,0.3)', borderLeftWidth: 2 }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
          API keys use the format <code style={{ fontSize: 11, color: '#007aff', background: 'rgba(0,122,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>hive_ak_PREFIX_SECRET</code>.
          Use them as Bearer tokens: <code style={{ fontSize: 11, color: '#007aff', background: 'rgba(0,122,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>Authorization: Bearer hive_ak_...</code>
        </p>
      </div>
    </div>
  )
}
