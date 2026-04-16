'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface ChatState {
  open: boolean
  minimized: boolean
  messages: Message[]
  loading: boolean
  error: string | null
}

const NODE_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_NODE_URL'] ?? (window.location.port === '3001' ? 'http://localhost:3000' : window.location.origin))
  : 'http://localhost:3000'

// ── Data fetching (grounded context) ─────────────────────────────────────

async function fetchHiveContext(): Promise<string> {
  const base = NODE_URL
  try {
    const [eventsRes, rollupRes, healthRes] = await Promise.all([
      fetch(`${base}/api/v1/events/recent?limit=200`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${base}/api/v1/rollups/aggregate`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) }),
    ])

    const events = eventsRes.ok ? (await eventsRes.json()).events ?? [] : []
    const rollups = rollupRes.ok ? (await rollupRes.json()).rows ?? [] : []
    const health = healthRes.ok ? await healthRes.json() : {}

    // Build grounding summary — metadata only, zero content
    const providers = [...new Set(events.map((e: any) => e.provider))].filter(Boolean)
    const totalTokens = events.reduce((s: number, e: any) => s + (e.estimated_tokens ?? 0), 0)
    const totalBytes = events.reduce((s: number, e: any) => s + (e.payload_bytes ?? 0), 0)
    const totalEvents = events.length
    const directions = events.reduce((m: Record<string, number>, e: any) => {
      m[e.direction] = (m[e.direction] ?? 0) + 1; return m
    }, {} as Record<string, number>)

    const models = [...new Set(events.map((e: any) => e.model_hint))].filter(Boolean)
    const depts = [...new Set(events.map((e: any) => e.dept_tag).filter(Boolean))]

    // Latency stats
    const latencies = events.map((e: any) => e.latency_ms).filter((n: any) => typeof n === 'number' && n > 0)
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((s: number, n: number) => s + n, 0) / latencies.length) : 0
    const sortedLat = [...latencies].sort((a: number, b: number) => a - b)
    const p95 = sortedLat.length > 0 ? sortedLat[Math.floor(sortedLat.length * 0.95)] : 0

    // Errors
    const errors = events.filter((e: any) => e.direction === 'error').length
    const errorRate = totalEvents > 0 ? ((errors / totalEvents) * 100).toFixed(1) : '0'

    // Time range
    const timestamps = events.map((e: any) => e.timestamp).filter(Boolean)
    const earliest = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : 'N/A'
    const latest = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : 'N/A'

    // Rollup summary
    const rollupLines = rollups.slice(0, 15).map((r: any) =>
      `  ${r.provider}${r.dept_tag ? ` [${r.dept_tag}]` : ''}: ${r.call_count} calls, ${r.total_tokens} tokens, avg ${Math.round(r.avg_latency_ms ?? 0)}ms`
    ).join('\n')

    // Try intelligence endpoints
    let costSummary = ''
    let anomalySummary = ''
    let forecastSummary = ''

    try {
      const costRes = await fetch(`${base}/api/v1/intelligence/cost?limit=500`, { signal: AbortSignal.timeout(5000) })
      if (costRes.ok) {
        const cost = await costRes.json()
        if (cost.byProvider) {
          const lines = Object.entries(cost.byProvider).map(
            ([p, v]: [string, any]) => `  ${p}: $${v.totalCost?.toFixed(4) ?? '0'} (${v.callCount ?? 0} calls)`
          ).join('\n')
          costSummary = `\nCost by provider:\n${lines}`
        }
      }
    } catch { /* skip */ }

    try {
      const anomalyRes = await fetch(`${base}/api/v1/intelligence/anomalies?limit=500`, { signal: AbortSignal.timeout(5000) })
      if (anomalyRes.ok) {
        const anom = await anomalyRes.json()
        const anomalies = anom.anomalies ?? []
        if (anomalies.length > 0) {
          const bySeverity = anomalies.reduce((m: Record<string, number>, a: any) => {
            m[a.severity] = (m[a.severity] ?? 0) + 1; return m
          }, {} as Record<string, number>)
          anomalySummary = `\nAnomalies detected: ${anomalies.length} (${Object.entries(bySeverity).map(([k, v]) => `${v} ${k}`).join(', ')})`
        }
      }
    } catch { /* skip */ }

    try {
      const fcRes = await fetch(`${base}/api/v1/intelligence/forecast?limit=500&horizon=30`, { signal: AbortSignal.timeout(5000) })
      if (fcRes.ok) {
        const fc = await fcRes.json()
        if (fc.projectedMonthlySpend !== undefined) {
          forecastSummary = `\n30-day spend forecast: $${fc.projectedMonthlySpend?.toFixed(2) ?? 'N/A'} (growth: ${fc.dailyGrowthRate ? (fc.dailyGrowthRate * 100).toFixed(2) + '%/day' : 'N/A'})`
        }
      }
    } catch { /* skip */ }

    return [
      `HIVE Telemetry Context (metadata only, zero content):`,
      `Node: ${health.nodeId ?? 'unknown'} | Region: ${health.region ?? 'unknown'} | Events ingested: ${health.events_ingested ?? totalEvents}`,
      `Time range: ${earliest} to ${latest}`,
      ``,
      `Summary:`,
      `  Total events: ${totalEvents}`,
      `  Total tokens: ${totalTokens.toLocaleString()}`,
      `  Total bytes: ${totalBytes.toLocaleString()}`,
      `  Providers: ${providers.join(', ') || 'none'}`,
      `  Models: ${models.join(', ') || 'none'}`,
      `  Departments: ${depts.join(', ') || 'none tagged'}`,
      `  Directions: ${Object.entries(directions).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
      `  Avg latency: ${avgLatency}ms | P95: ${p95}ms`,
      `  Error rate: ${errorRate}% (${errors} errors)`,
      ``,
      `Rollups (aggregated):`,
      rollupLines || '  No rollup data',
      costSummary,
      anomalySummary,
      forecastSummary,
    ].filter(Boolean).join('\n')
  } catch {
    return 'HIVE telemetry data unavailable — Node server may be offline.'
  }
}

// ── LLM config loader ───────────────────────────────────────────────────

interface LLMProviderConfig {
  endpoint: string
  apiKey: string
  model: string
}

async function loadLLMConfig(): Promise<{ provider: string; config: LLMProviderConfig }> {
  const defaults = { provider: 'ollama', config: { endpoint: 'http://localhost:11434', apiKey: '', model: 'gemma4:latest' } }
  try {
    const res = await fetch(`${NODE_URL}/api/v1/config`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return defaults
    const data = await res.json()
    if (!data?.llm?.activeProvider) return defaults
    const active = data.llm.activeProvider
    const p = data.llm.providers?.[active]
    if (!p) return defaults
    return { provider: active, config: { endpoint: p.endpoint ?? defaults.config.endpoint, apiKey: p.apiKey ?? '', model: p.model ?? defaults.config.model } }
  } catch {
    return defaults
  }
}

// ── Chat with LLM ──────────────────────────────────────────────────────

async function chatWithLLM(messages: { role: string; content: string }[]): Promise<string> {
  const { provider, config } = await loadLLMConfig()

  if (provider === 'ollama') {
    const res = await fetch(`${config.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
      }),
    })
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
    const data = await res.json()
    return data.message?.content ?? 'No response'
  }

  if (provider === 'openai' || provider === 'custom') {
    const res = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
      }),
    })
    if (!res.ok) throw new Error(`OpenAI-compatible API returned ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? 'No response'
  }

  if (provider === 'anthropic') {
    const system = messages.find((m) => m.role === 'system')?.content ?? ''
    const chat = messages.filter((m) => m.role !== 'system')
    const res = await fetch(`${config.endpoint}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        system,
        messages: chat,
      }),
    })
    if (!res.ok) throw new Error(`Anthropic returned ${res.status}`)
    const data = await res.json()
    return data.content?.[0]?.text ?? 'No response'
  }

  if (provider === 'google') {
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    const system = messages.find((m) => m.role === 'system')?.content
    const res = await fetch(
      `${config.endpoint}/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(system && { systemInstruction: { parts: [{ text: system }] } }),
        }),
      },
    )
    if (!res.ok) throw new Error(`Google returned ${res.status}`)
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response'
  }

  throw new Error(`Unsupported provider: ${provider}`)
}

// ── Component ───────────────────────────────────────────────────────────

export default function ChatWidget() {
  const [state, setState] = useState<ChatState>({
    open: false,
    minimized: false,
    messages: [],
    loading: false,
    error: null,
  })
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [state.messages, scrollToBottom])

  useEffect(() => {
    if (state.open && !state.minimized) {
      inputRef.current?.focus()
    }
  }, [state.open, state.minimized])

  const toggleOpen = () => {
    setState((s) => ({
      ...s,
      open: !s.open,
      minimized: false,
    }))
  }

  const toggleMinimize = () => {
    setState((s) => ({ ...s, minimized: !s.minimized }))
  }

  const closeChat = () => {
    setState((s) => ({ ...s, open: false }))
  }

  const clearChat = () => {
    setState((s) => ({ ...s, messages: [], error: null }))
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || state.loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setState((s) => ({
      ...s,
      messages: [...s.messages, userMsg],
      loading: true,
      error: null,
    }))
    setInput('')

    try {
      // Fetch fresh grounded context
      const context = await fetchHiveContext()

      const systemPrompt = [
        'You are the HIVE Chat assistant — a data analyst for AI consumption telemetry.',
        'You answer questions ONLY based on the HIVE telemetry data provided below.',
        'If the data does not contain enough information to answer, say so clearly.',
        'Never fabricate numbers. Never reference data you do not have.',
        'Keep answers concise and actionable. Use specific numbers from the data.',
        'Format: plain text, no markdown headers. Short paragraphs.',
        '',
        '--- HIVE DATA ---',
        context,
        '--- END DATA ---',
      ].join('\n')

      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...state.messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ]

      const reply = await chatWithLLM(chatMessages)

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      }

      setState((s) => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        loading: false,
      }))
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err?.message ?? 'Failed to get response. Check Settings for LLM configuration.',
      }))
    }
  }

  // ── Styles (inline to keep it self-contained) ──────────────────────

  const fabStyle: React.CSSProperties = {
    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
    width: 56, height: 56, borderRadius: '50%',
    background: '#ffd60a', color: '#1d1d1f',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
    width: 400, maxWidth: 'calc(100vw - 48px)',
    borderRadius: 16,
    background: '#ffffff',
    boxShadow: '0 8px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    ...(state.minimized ? { height: 52 } : { height: 520, maxHeight: 'calc(100vh - 120px)' }),
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #1d1d1f, #2c2c2e)',
    color: '#ffffff',
    cursor: 'pointer',
    userSelect: 'none',
    flexShrink: 0,
  }

  const controlBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.7)', padding: 4, display: 'flex',
    borderRadius: 4, transition: 'color 0.15s',
  }

  if (!state.open) {
    return (
      <button
        onClick={toggleOpen}
        style={fabStyle}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)' }}
        title="Talk to your data"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    )
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle} onClick={toggleMinimize}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffd60a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: 0.3 }}>HIVE Chat</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Talk to your data</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Clear */}
          <button
            onClick={(e) => { e.stopPropagation(); clearChat() }}
            style={controlBtnStyle}
            title="Clear chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          {/* Minimize */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleMinimize() }}
            style={controlBtnStyle}
            title={state.minimized ? 'Expand' : 'Minimize'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {state.minimized
                ? <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                : <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              }
            </svg>
          </button>
          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); closeChat() }}
            style={controlBtnStyle}
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      {!state.minimized && (
        <>
          <div style={{
            flex: 1, overflowY: 'auto', padding: 16,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {state.messages.length === 0 && !state.loading && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffd60a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>
                  Talk to your data. Define your value.
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Ask about your AI consumption — tokens, costs, providers,
                  latency, anomalies, trends. Grounded in your HIVE telemetry.
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    'Which provider has the highest latency?',
                    'How many tokens did we use today?',
                    'Are there any anomalies?',
                    'Break down usage by model.',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus() }}
                      style={{
                        background: 'var(--card)', border: '1px solid #e5e5ea',
                        borderRadius: 8, padding: '8px 12px', fontSize: 12,
                        cursor: 'pointer', textAlign: 'left', color: 'var(--fg)',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e5ea' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? '#007aff' : 'var(--card)',
                  color: msg.role === 'user' ? '#ffffff' : 'var(--fg)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {state.loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                  background: 'var(--card)', fontSize: 13, color: 'var(--muted)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ animation: 'pulse 1.5s infinite' }}>Thinking</span>
                  <span style={{ animation: 'pulse 1.5s infinite 0.2s' }}>.</span>
                  <span style={{ animation: 'pulse 1.5s infinite 0.4s' }}>.</span>
                  <span style={{ animation: 'pulse 1.5s infinite 0.6s' }}>.</span>
                </div>
              </div>
            )}

            {state.error && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: '#fef2f2', color: '#b91c1c', fontSize: 12, lineHeight: 1.5,
              }}>
                {state.error}
                <div style={{ marginTop: 6 }}>
                  <a href="/settings" style={{ color: '#007aff', fontSize: 12 }}>Check LLM Settings</a>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid #e5e5ea',
            display: 'flex', gap: 8, flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
              placeholder="Ask about your data..."
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                border: '1px solid #e5e5ea', fontSize: 13,
                fontFamily: 'inherit', outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e5ea' }}
              disabled={state.loading}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || state.loading}
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: input.trim() && !state.loading ? '#ffd60a' : '#e5e5ea',
                border: 'none', cursor: input.trim() && !state.loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !state.loading ? '#1d1d1f' : '#86868b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
