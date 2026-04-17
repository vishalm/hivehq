'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'

/* ── HIVE Login Page — Keycloak OIDC Redirect ──────────────────────────── */

function HiveLogoLarge({ size = 48 }: { size?: number }) {
  const id = 'hive-login-logo'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block' }}>
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
      </defs>
      <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="none" stroke="rgba(255,214,10,0.12)" strokeWidth="1" filter={`url(#${id}-glow)`} />
      <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" fill={`url(#${id}-gold)`} opacity="0.95" />
      <polygon points="32,22 39,26 39,34 32,38 25,34 25,26" fill="#0a0a0f" opacity="0.85" />
      <polygon points="41,14 48,18 48,26 41,30 34,26 34,18" fill="#0a0a0f" opacity="0.6" />
      <polygon points="23,34 30,38 30,46 23,50 16,46 16,38" fill="#0a0a0f" opacity="0.6" />
    </svg>
  )
}

export default function LoginClient() {
  const { user, loading, login } = useAuth()
  const [redirecting, setRedirecting] = useState(false)

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!loading && user) {
      window.location.href = '/dashboard'
    }
  }, [loading, user])

  const handleLogin = async () => {
    setRedirecting(true)
    await login('login')
  }

  const handleSSO = async () => {
    setRedirecting(true)
    await login('login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0f1923 40%, #16213e 100%)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,214,10,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 420,
        animation: 'fade-in 0.6s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* Logo & brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', marginBottom: 16 }}>
            <HiveLogoLarge size={48} />
          </div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color: 'rgba(255,255,255,0.92)',
            margin: '0 0 8px',
          }}>
            Welcome to HIVE
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Sign in to the Token Governance dashboard
          </p>
        </div>

        {/* Login card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}>
          {/* Sign in with Keycloak */}
          <button
            onClick={handleLogin}
            disabled={redirecting || loading}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 12,
              border: 'none',
              background: '#ffd60a',
              color: '#0a0a0f',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: redirecting ? 'wait' : 'pointer',
              opacity: redirecting ? 0.7 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 0 20px rgba(255,214,10,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            {redirecting ? 'Redirecting...' : 'Sign In'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* SSO */}
          <button
            onClick={handleSSO}
            disabled={redirecting || loading}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Continue with SSO
          </button>

          {/* Dev credentials hint */}
          <div style={{
            marginTop: 20,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(255,214,10,0.05)',
            border: '1px solid rgba(255,214,10,0.1)',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(255,214,10,0.6)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Dev Credentials
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace", lineHeight: 1.8 }}>
              admin@hive.local / admin<br />
              operator@hive.local / operator<br />
              viewer@hive.local / viewer
            </p>
          </div>
        </div>

        {/* Sign up link */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          No account?{' '}
          <a
            href="#"
            onClick={async (e) => { e.preventDefault(); await login('register') }}
            style={{ color: '#ffd60a', textDecoration: 'none', fontWeight: 500 }}
          >
            Create one
          </a>
        </p>

        {/* Back to landing */}
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          <a href="/" style={{ color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>
            Back to home
          </a>
        </p>
      </div>
    </div>
  )
}
