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

/* ── Tenant type styling ───────────────────────────────────────────────── */
const TENANT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  country:    { bg: 'rgba(255,214,10,0.15)',  text: '#ffd60a', icon: 'M3 21V3h18v18H3z' },
  government: { bg: 'rgba(255,149,0,0.15)',   text: '#ff9500', icon: 'M12 2L2 7v2h20V7L12 2zM4 11v8h3v-8H4zm5 0v8h3v-8H9zm5 0v8h3v-8h-3zm5 0v8h3v-8h-3z' },
  group:      { bg: 'rgba(175,82,222,0.15)',   text: '#af52de', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  enterprise: { bg: 'rgba(0,122,255,0.15)',    text: '#007aff', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  company:    { bg: 'rgba(52,199,89,0.15)',    text: '#34c759', icon: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 3H8l-2 4h12l-2-4z' },
  individual: { bg: 'rgba(255,255,255,0.08)',   text: 'rgba(255,255,255,0.5)', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
}

function TenantTypePill({ type }: { type: string }) {
  const c = TENANT_COLORS[type] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' }
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
      {type}
    </span>
  )
}

/* ── Demo tenant hierarchy ─────────────────────────────────────────────── */
interface TenantNode {
  id: string
  name: string
  type: string
  slug: string
  users: number
  tokens_30d: string
  children?: TenantNode[]
}

const DEMO_HIERARCHY: TenantNode = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'ACME National',
  type: 'country',
  slug: 'acme-national',
  users: 142,
  tokens_30d: '48.2M',
  children: [
    {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'Federal Cyber Division',
      type: 'government',
      slug: 'fed-cyber',
      users: 28,
      tokens_30d: '12.1M',
      children: [
        {
          id: '20000000-0000-0000-0000-000000000001',
          name: 'ACME Defence Group',
          type: 'group',
          slug: 'acme-defence',
          users: 45,
          tokens_30d: '18.5M',
          children: [
            {
              id: '30000000-0000-0000-0000-000000000001',
              name: 'ACME Aerospace',
              type: 'enterprise',
              slug: 'acme-aero',
              users: 32,
              tokens_30d: '10.3M',
              children: [
                {
                  id: '40000000-0000-0000-0000-000000000001',
                  name: 'Aero AI Lab',
                  type: 'company',
                  slug: 'aero-ai-lab',
                  users: 12,
                  tokens_30d: '4.8M',
                },
                {
                  id: '40000000-0000-0000-0000-000000000002',
                  name: 'Satellite Ops',
                  type: 'company',
                  slug: 'sat-ops',
                  users: 8,
                  tokens_30d: '2.1M',
                },
              ],
            },
            {
              id: '30000000-0000-0000-0000-000000000002',
              name: 'ACME Logistics',
              type: 'enterprise',
              slug: 'acme-logistics',
              users: 13,
              tokens_30d: '3.7M',
            },
          ],
        },
      ],
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      name: 'State Health Authority',
      type: 'government',
      slug: 'state-health',
      users: 15,
      tokens_30d: '5.4M',
      children: [
        {
          id: '20000000-0000-0000-0000-000000000002',
          name: 'Public Health Group',
          type: 'group',
          slug: 'pub-health',
          users: 15,
          tokens_30d: '5.4M',
        },
      ],
    },
  ],
}

/* ── Tree node component ───────────────────────────────────────────────── */
function TreeNode({ node, depth = 0 }: { node: TenantNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0
  const c = TENANT_COLORS[node.type] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' }

  return (
    <div>
      <div
        onClick={() => hasChildren && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          marginLeft: depth * 28,
          borderRadius: 10,
          cursor: hasChildren ? 'pointer' : 'default',
          transition: 'background 0.15s',
          background: 'transparent',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {/* Expand/collapse arrow */}
        <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
          {hasChildren ? (
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={c.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          )}
        </div>

        {/* Tenant type connector line visual */}
        <div style={{
          width: 4,
          height: 24,
          borderRadius: 2,
          background: c.text,
          opacity: 0.4,
          flexShrink: 0,
        }} />

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
              {node.name}
            </span>
            <TenantTypePill type={node.type} />
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: "'SF Mono', monospace" }}>
            {node.slug}
          </span>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {node.users}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Users
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#ffd60a', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {node.tokens_30d}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Tokens (30d)
            </p>
          </div>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div style={{ borderLeft: `1px solid rgba(255,255,255,0.04)`, marginLeft: depth * 28 + 22 }}>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TenantsPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'rgba(255,255,255,0.92)', margin: '0 0 4px' }}>
            Tenant Hierarchy
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Multi-tenant isolation tree — Country, Government, Group, Enterprise, Company
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
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Tenant
        </button>
      </div>

      {/* Hierarchy legend */}
      <div style={{ ...glassCard, marginBottom: 20, padding: 14, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Hierarchy
        </span>
        {['country', 'government', 'group', 'enterprise', 'company', 'individual'].map((t) => (
          <TenantTypePill key={t} type={t} />
        ))}
      </div>

      {/* Tenant tree */}
      <div style={glassCard}>
        <TreeNode node={DEMO_HIERARCHY} depth={0} />
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 20 }}>
        <div style={{ ...glassCard, borderLeftColor: 'rgba(255,214,10,0.3)', borderLeftWidth: 2 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Bespoke Deployment
          </h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
            Single root tenant with full hierarchy beneath it. All data stays on-premises.
            The tenant tree defines organizational boundaries for token governance and cost attribution.
          </p>
        </div>
        <div style={{ ...glassCard, borderLeftColor: 'rgba(0,122,255,0.3)', borderLeftWidth: 2 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            SaaS Deployment
          </h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
            Multiple root tenants share infrastructure with strict data isolation.
            Each tenant tree is invisible to others. Super admins manage the platform-level view.
          </p>
        </div>
      </div>
    </div>
  )
}
