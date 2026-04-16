'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'shadow'
  title: string
  message: string
  timestamp: number
  read: boolean
  action?: { label: string; href: string }
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  add: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  dismiss: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}

/* ── Notification Provider ─────────────────────────────────────────────────── */

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [seenTitles, setSeenTitles] = useState<Set<string>>(new Set())

  const NODE_URL = typeof window !== 'undefined'
    ? (process.env['NEXT_PUBLIC_NODE_URL'] ?? (window.location.port === '3001' ? 'http://localhost:3000' : window.location.origin))
    : 'http://localhost:3000'

  const add = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const key = `${notification.title}|${notification.message}`
    const now = Date.now()

    // Deduplicate: don't re-add if same title+message was added in last 60 seconds
    if (seenTitles.has(key)) {
      return
    }

    setNotifications((prev) => [
      {
        ...notification,
        id: crypto.randomUUID(),
        timestamp: now,
        read: false,
      },
      ...prev,
    ])

    setSeenTitles((prev) => new Set([...prev, key]))
    setTimeout(() => {
      setSeenTitles((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, 60000)
  }, [seenTitles])

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  // Polling effect for auto-notifications
  useEffect(() => {
    let isRunning = true

    const pollEvents = async () => {
      if (!isRunning) return

      try {
        // Fetch recent events
        const eventsRes = await fetch(`${NODE_URL}/api/v1/events/recent?limit=50`, {
          signal: AbortSignal.timeout(5000),
        })
        const events = eventsRes.ok ? (await eventsRes.json()).events ?? [] : []

        // Fetch anomalies
        const anomaliesRes = await fetch(`${NODE_URL}/api/v1/intelligence/anomalies?limit=50`, {
          signal: AbortSignal.timeout(5000),
        })
        const anomalies = anomaliesRes.ok ? (await anomaliesRes.json()).anomalies ?? [] : []

        // Known sanctioned providers
        const sanctionedProviders = new Set([
          'openai',
          'anthropic',
          'google',
          'azure_openai',
          'bedrock',
          'mistral',
          'cohere',
          'groq',
          'together',
          'ollama',
        ])

        // Check for shadow AI
        const shadowProviders = [...new Set(
          events
            .map((e: any) => e.provider)
            .filter((p: string) => p && !sanctionedProviders.has(p.toLowerCase()))
        )]

        if (shadowProviders.length > 0) {
          add({
            type: 'shadow',
            title: 'Shadow AI Detected',
            message: `Unsanctioned providers found: ${shadowProviders.join(', ')}`,
          })
        }

        // Check for high error rate
        const errorCount = events.filter((e: any) => e.direction === 'error').length
        const errorRate = events.length > 0 ? (errorCount / events.length) * 100 : 0
        if (errorRate > 5) {
          add({
            type: 'error',
            title: 'High Error Rate',
            message: `Error rate is ${errorRate.toFixed(1)}% (${errorCount} errors)`,
            action: { label: 'View Details', href: '/intelligence' },
          })
        }

        // Check for anomalies
        if (anomalies.length > 0) {
          const highSeverity = anomalies.filter((a: any) => a.severity === 'high').length
          const mediumSeverity = anomalies.filter((a: any) => a.severity === 'medium').length
          add({
            type: 'warning',
            title: 'Anomalies Detected',
            message: `${highSeverity} high, ${mediumSeverity} medium severity anomalies found`,
            action: { label: 'Review', href: '/intelligence' },
          })
        }

        // Check for governance compliance
        if (shadowProviders.length === 0 && errorRate <= 5 && anomalies.length === 0) {
          // Periodically reassure that everything is compliant
          if (Math.random() < 0.2) { // 20% chance per poll
            add({
              type: 'success',
              title: 'Governance Compliant',
              message: 'All providers sanctioned, error rate normal, no anomalies detected',
            })
          }
        }
      } catch (err) {
        // Polling errors are non-fatal
      }

      // Poll every 30 seconds
      if (isRunning) {
        setTimeout(() => {
          void pollEvents()
        }, 30000)
      }
    }

    void pollEvents()

    return () => {
      isRunning = false
    }
  }, [add, NODE_URL])

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    add,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationToast />
    </NotificationContext.Provider>
  )
}

/* ── Bell Icon SVG ─────────────────────────────────────────────────────────── */

function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

/* ── Icon Selector ─────────────────────────────────────────────────────────── */

function NotificationIcon({ type }: { type: Notification['type'] }) {
  const baseSvgStyle: React.CSSProperties = { display: 'block' }

  switch (type) {
    case 'warning':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={baseSvgStyle}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'error':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={baseSvgStyle}>
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="15" y1="9" x2="9" y2="15" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="9" y1="9" x2="15" y2="15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'success':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={baseSvgStyle}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'shadow':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={baseSvgStyle}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'info':
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={baseSvgStyle}>
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

/* ── Notification Bell Component ────────────────────────────────────────────── */

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'error':
      case 'shadow':
        return 'var(--hive-red)'
      case 'warning':
        return 'var(--hive-orange)'
      case 'success':
        return 'var(--hive-green)'
      case 'info':
      default:
        return 'var(--hive-blue)'
    }
  }

  const relativeTime = (timestamp: number) => {
    const now = Date.now()
    const diffMs = now - timestamp
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: 'var(--r-md)',
          color: 'var(--text-secondary)',
          minHeight: 44,
          minWidth: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'all var(--dur-base) var(--ease-out)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.background = 'var(--glass-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.background = 'none'
        }}
        title={unreadCount > 0 ? `${unreadCount} new notification${unreadCount !== 1 ? 's' : ''}` : 'Notifications'}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 'var(--r-full)',
              background: 'var(--hive-yellow)',
              color: '#0a0a0f',
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(255,214,10,0.3)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 380,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 120px)',
            borderRadius: 'var(--r-xl)',
            background: 'var(--gradient-card)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--glass-border)',
              background: 'linear-gradient(135deg, rgba(255,214,10,0.04), rgba(0,0,0,0.2))',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BellIcon size={16} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
                  ({unreadCount} unread)
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  markAllRead()
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--hive-blue)',
                  padding: '4px 8px',
                  transition: 'color var(--dur-base) var(--ease-out)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--hive-blue)'
                  e.currentTarget.style.opacity = '0.8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--hive-blue)'
                  e.currentTarget.style.opacity = '1'
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 20px',
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: 12, opacity: 0.5 }}
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <div style={{ fontSize: 13, fontWeight: 500 }}>No notifications</div>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background var(--dur-fast) var(--ease-out)',
                    cursor: 'pointer',
                    background: notif.read ? 'transparent' : 'rgba(255,255,255,0.02)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(255,255,255,0.02)'
                  }}
                  onClick={() => {
                    if (!notif.read) {
                      const { markRead } = useNotifications()
                      markRead(notif.id)
                    }
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: getTypeColor(notif.type),
                        marginTop: 8,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: getTypeColor(notif.type),
                            flexShrink: 0,
                          }}
                        >
                          <NotificationIcon type={notif.type} />
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'var(--hive-blue)',
                              boxShadow: '0 0 4px var(--hive-blue)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          marginBottom: notif.action ? 8 : 0,
                        }}
                      >
                        {notif.message}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        {notif.action && (
                          <a
                            href={notif.action.href}
                            onClick={(e) => {
                              e.stopPropagation()
                              setIsOpen(false)
                            }}
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: 'var(--hive-blue)',
                              textDecoration: 'none',
                              padding: '4px 8px',
                              borderRadius: 'var(--r-sm)',
                              transition: 'background var(--dur-fast) var(--ease-out)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(0,122,255,0.1)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            {notif.action.label}
                          </a>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {relativeTime(notif.timestamp)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const { dismiss } = useNotifications()
                        dismiss(notif.id)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 24,
                        minHeight: 24,
                        transition: 'color var(--dur-fast) var(--ease-out)',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-tertiary)'
                      }}
                      title="Dismiss"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6l-12 12M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

/* ── Toast Container ───────────────────────────────────────────────────────── */

function NotificationToast() {
  const { notifications } = useNotifications()
  const visibleToasts = notifications.slice(0, 3)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 100,
        right: 24,
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      {visibleToasts.map((notif) => (
        <div
          key={notif.id}
          style={{
            background: 'var(--gradient-card)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--r-lg)',
            padding: '12px 16px',
            boxShadow: 'var(--glass-shadow)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            maxWidth: 360,
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s var(--ease-out)',
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: getToastColor(notif.type),
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <NotificationIcon type={notif.type} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
              {notif.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {notif.message}
            </div>
          </div>
          <button
            onClick={() => {
              const { dismiss } = useNotifications()
              dismiss(notif.id)
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 24,
              minHeight: 24,
              transition: 'color var(--dur-fast) var(--ease-out)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-tertiary)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6l-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

function getToastColor(type: Notification['type']) {
  switch (type) {
    case 'error':
    case 'shadow':
      return 'var(--hive-red)'
    case 'warning':
      return 'var(--hive-orange)'
    case 'success':
      return 'var(--hive-green)'
    case 'info':
    default:
      return 'var(--hive-blue)'
  }
}
