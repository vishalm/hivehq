'use client'

import { useEffect, type ReactNode } from 'react'
import { useAuth } from './auth-context'

/**
 * Client-side auth guard.
 * Redirects to /login if user is not authenticated.
 * Optionally checks for a minimum role.
 */
export function AuthGuard({
  children,
  minRole,
}: {
  children: ReactNode
  minRole?: string
}) {
  const { user, loading, hasRole } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login'
    }
  }, [loading, user])

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '2px solid rgba(255,255,255,0.08)',
          borderTopColor: '#ffd60a',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    return null
  }

  // Role check
  if (minRole && !hasRole(minRole)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
          Access Denied
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          You need the <strong>{minRole}</strong> role to access this page.
        </p>
        <a
          href="/dashboard"
          style={{
            marginTop: 8,
            padding: '10px 20px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Back to Dashboard
        </a>
      </div>
    )
  }

  return <>{children}</>
}
