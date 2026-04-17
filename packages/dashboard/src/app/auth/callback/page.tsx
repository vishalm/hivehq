'use client'

/**
 * OIDC Callback Page
 *
 * Keycloak redirects here after authentication with ?code=...&state=...
 * The AuthProvider handles the token exchange automatically.
 * This page just shows a loading state.
 */

export default function AuthCallbackPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0f1923 40%, #16213e 100%)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        {/* Spinner */}
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: '#ffd60a',
          borderRadius: '50%',
          margin: '0 auto 24px',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{
          fontSize: 15,
          color: 'rgba(255,255,255,0.55)',
          margin: 0,
        }}>
          Authenticating...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
