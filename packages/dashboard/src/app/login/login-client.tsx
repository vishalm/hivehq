'use client'

import { useState } from 'react'

/* ── HIVE Login Page — Glassmorphic Auth ─────────────────────────────────── */

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Authentication not yet implemented — placeholder for Phase 4
    setLoading(true)
    setTimeout(() => {
      window.location.href = '/'
    }, 800)
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
            Welcome back
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Sign in to the HIVE dashboard
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
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 6,
              }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,122,255,0.5)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.15)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'rgba(255,255,255,0.5)',
                }}>Password</label>
                <a href="#" style={{ fontSize: 12, color: 'rgba(255,214,10,0.7)', textDecoration: 'none' }}>Forgot?</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,122,255,0.5)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.15)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
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
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s',
                boxShadow: '0 0 20px rgba(255,214,10,0.15)',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* SSO placeholder */}
          <button style={{
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
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Continue with SSO
          </button>
        </div>

        {/* Sign up link */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          No account? <a href="/signup" style={{ color: '#ffd60a', textDecoration: 'none', fontWeight: 500 }}>Create one</a>
        </p>

        {/* Back to landing */}
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          <a href="/landing" style={{ color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>
            Back to home
          </a>
        </p>
      </div>
    </div>
  )
}
