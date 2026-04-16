'use client'

import { usePathname } from 'next/navigation'
import ChatWidget from './chat-widget'
import { NotificationBell } from './notifications'

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
        {/* Golden gradient for primary hexagon */}
        <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="50%" stopColor="#ffd60a" />
          <stop offset="100%" stopColor="#e6b800" />
        </linearGradient>
        {/* Subtle glow filter */}
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Inner shadow for depth */}
        <filter id={`${id}-inner`}>
          <feFlood floodColor="#000000" floodOpacity="0.25" result="flood" />
          <feComposite in="flood" in2="SourceAlpha" operator="in" result="shadow" />
          <feOffset dx="0" dy="1" result="offset" />
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow ring — ambient light */}
      <polygon
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        fill="none"
        stroke="rgba(255,214,10,0.12)"
        strokeWidth="1"
        filter={`url(#${id}-glow)`}
      />

      {/* Main hexagon — golden gradient fill */}
      <polygon
        points="32,6 54,19 54,45 32,58 10,45 10,19"
        fill={`url(#${id}-gold)`}
        opacity="0.95"
        filter={`url(#${id}-inner)`}
      />

      {/* Inner honeycomb cut — three hexagonal cells */}
      {/* Center cell */}
      <polygon
        points="32,22 39,26 39,34 32,38 25,34 25,26"
        fill="#0a0a0f"
        opacity="0.85"
      />
      {/* Top-right cell */}
      <polygon
        points="41,14 48,18 48,26 41,30 34,26 34,18"
        fill="#0a0a0f"
        opacity="0.6"
      />
      {/* Bottom-left cell */}
      <polygon
        points="23,34 30,38 30,46 23,50 16,46 16,38"
        fill="#0a0a0f"
        opacity="0.6"
      />

      {/* Light refraction lines — glassmorphic depth */}
      <line x1="10" y1="19" x2="32" y2="6" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      <line x1="32" y1="6" x2="54" y2="19" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <line x1="10" y1="19" x2="10" y2="45" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
    </svg>
  )
}

/* ── SVG Icons for nav ─────────────────────────────────────────────────── */
const navItems = [
  {
    href: '/',
    label: 'Dashboard',
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
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" /><path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    href: '/graphs',
    label: 'Graphs',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m7 16 4-8 4 5 5-6" />
      </svg>
    ),
  },
  {
    href: '/setup',
    label: 'Setup',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
]

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      <header className="site-header" role="banner">
        <div className="container">
          <a href="/" className="brand" aria-label="HIVE Home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <HiveLogo size={28} />
            <span>HIVE</span>
          </a>
          <nav className="nav" role="navigation" aria-label="Main navigation">
            {navItems.map((item) => (
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
          <NotificationBell />
          <span className="tag" aria-label="Version">pre-alpha · Phase 2</span>
        </div>
      </header>
      <main className="container" role="main" style={{ paddingBottom: 80 }}>
        {children}
      </main>
      <ChatWidget />
    </>
  )
}
