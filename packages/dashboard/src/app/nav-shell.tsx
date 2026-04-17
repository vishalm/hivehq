'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import ChatWidget from './chat-widget'
import { NotificationBell } from './notifications'
import { useAuth } from '../lib/auth-context'

/* ── HIVE Logo — Hexagonal honeycomb mark ─────────────────────────────── */
function HiveLogo({ size = 28 }: { size?: number }) {
  const id = 'hive-logo'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="50%" stopColor="#ffd60a" />
          <stop offset="100%" stopColor="#e6b800" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`${id}-inner`}>
          <feFlood floodColor="#000000" floodOpacity="0.25" result="flood" />
          <feComposite in="flood" in2="SourceAlpha" operator="in" result="shadow" />
          <feOffset dx="0" dy="1" result="offset" />
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="none" stroke="rgba(255,214,10,0.12)" strokeWidth="1" filter={`url(#${id}-glow)`} />
      <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" fill={`url(#${id}-gold)`} opacity="0.95" filter={`url(#${id}-inner)`} />
      <polygon points="32,22 39,26 39,34 32,38 25,34 25,26" fill="#0a0a0f" opacity="0.85" />
      <polygon points="41,14 48,18 48,26 41,30 34,26 34,18" fill="#0a0a0f" opacity="0.6" />
      <polygon points="23,34 30,38 30,46 23,50 16,46 16,38" fill="#0a0a0f" opacity="0.6" />
      <line x1="10" y1="19" x2="32" y2="6" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      <line x1="32" y1="6" x2="54" y2="19" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <line x1="10" y1="19" x2="10" y2="45" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
    </svg>
  )
}

/* ── SVG Icons for nav ─────────────────────────────────────────────────── */
const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    minRole: 'viewer',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/intelligence',
    label: 'Intelligence',
    minRole: 'viewer',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" /><path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    href: '/graphs',
    label: 'Graphs',
    minRole: 'viewer',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m7 16 4-8 4 5 5-6" />
      </svg>
    ),
  },
  {
    href: '/setup',
    label: 'Setup',
    minRole: 'operator',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    minRole: 'admin',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
]

/* ── Role pill colors ────────────────────────────────────────────────────── */
const rolePillColors: Record<string, string> = {
  viewer: 'rgba(0,122,255,0.15)',
  operator: 'rgba(175,82,222,0.15)',
  admin: 'rgba(255,149,0,0.15)',
  super_admin: 'rgba(255,214,10,0.15)',
  gov_auditor: 'rgba(52,199,89,0.15)',
}

const rolePillTextColors: Record<string, string> = {
  viewer: '#007aff',
  operator: '#af52de',
  admin: '#ff9500',
  super_admin: '#ffd60a',
  gov_auditor: '#34c759',
}

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout, hasRole } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)

  /* Landing page and auth pages render their own chrome */
  if (pathname === '/' || pathname === '/landing' || pathname === '/login' || pathname === '/signup' || pathname === '/auth/callback') {
    return <>{children}</>
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const primaryRole = user?.roles?.[0] ?? 'viewer'

  return (
    <>
      <header className="site-header" role="banner">
        <div className="container">
          <a href="/dashboard" className="brand" aria-label="HIVE Home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <HiveLogo size={28} />
            <span>HIVE</span>
          </a>
          <nav className="nav" role="navigation" aria-label="Main navigation">
            {navItems
              .filter((item) => hasRole(item.minRole))
              .map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  data-active={isActive(item.href) ? 'true' : undefined}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {item.icon}
                  {item.label}
                </a>
              ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell />

            {/* User menu */}
            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Avatar circle */}
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: rolePillColors[primaryRole] ?? 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: rolePillTextColors[primaryRole] ?? 'rgba(255,255,255,0.5)',
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name || user.email}
                  </span>
                  {/* Role badge */}
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 6,
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                    background: rolePillColors[primaryRole] ?? 'rgba(255,255,255,0.08)',
                    color: rolePillTextColors[primaryRole] ?? 'rgba(255,255,255,0.5)',
                  }}>
                    {primaryRole.replace('_', ' ')}
                  </span>
                  {/* Chevron */}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown */}
                {showUserMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 6,
                      minWidth: 220,
                      background: '#1a1a28',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14,
                      padding: 8,
                      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                      zIndex: 100,
                    }}
                    onMouseLeave={() => setShowUserMenu(false)}
                  >
                    {/* User info */}
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
                        {user.name || 'User'}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                        {user.email}
                      </p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '4px 0 0', fontFamily: "'SF Mono', monospace" }}>
                        Tenant: {user.tenant_id.slice(0, 8)}...
                      </p>
                    </div>

                    {/* Menu items */}
                    {hasRole('admin') && (
                      <a href="/admin/users" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8,
                        color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        User Management
                      </a>
                    )}

                    {hasRole('admin') && (
                      <a href="/admin/api-keys" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8,
                        color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                        API Keys
                      </a>
                    )}

                    {(hasRole('admin') || hasRole('gov_auditor')) && (
                      <a href="/admin/audit" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8,
                        color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
                        </svg>
                        Audit Log
                      </a>
                    )}

                    {hasRole('super_admin') && (
                      <a href="/admin/tenants" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8,
                        color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Tenants
                      </a>
                    )}

                    {/* Divider */}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

                    {/* Sign out */}
                    <button
                      onClick={logout}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8, width: '100%',
                        border: 'none', background: 'transparent',
                        color: '#ff3b30', fontSize: 13, fontFamily: 'inherit',
                        cursor: 'pointer', transition: 'background 0.15s',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,59,48,0.08)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a
                href="/login"
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: '#ffd60a',
                  color: '#0a0a0f',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'opacity 0.2s',
                }}
              >
                Sign In
              </a>
            )}

            <span className="tag" aria-label="Version">pre-alpha · Phase 4</span>
          </div>
        </div>
      </header>
      <main className="container" role="main" style={{ paddingBottom: 80 }}>
        {children}
      </main>
      <ChatWidget />
    </>
  )
}
