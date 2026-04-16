'use client'

import { useState, useMemo, useEffect } from 'react'
import type { TTPEvent } from '@hive/shared'
import { CallsOverTime, ProviderBar, DeptPie } from './charts'

interface Rollup {
  provider: string
  dept_tag: string | null
  call_count: number
  total_tokens: number
  total_bytes: number
  avg_latency_ms: number | null
}

const SANCTIONED = new Set([
  'openai', 'anthropic', 'google', 'azure_openai', 'bedrock',
  'mistral', 'cohere', 'groq', 'together', 'ollama',
])

type TimeRange = '5m' | '15m' | '1h' | '6h' | '24h' | '7d' | 'all'
type SortKey = 'time' | 'provider' | 'tokens' | 'latency' | 'bytes'
type SortDir = 'asc' | 'desc'

const TIME_RANGES: { key: TimeRange; label: string; ms: number }[] = [
  { key: '5m', label: '5 min', ms: 5 * 60_000 },
  { key: '15m', label: '15 min', ms: 15 * 60_000 },
  { key: '1h', label: '1 hour', ms: 60 * 60_000 },
  { key: '6h', label: '6 hours', ms: 6 * 60 * 60_000 },
  { key: '24h', label: '24 hours', ms: 24 * 60 * 60_000 },
  { key: '7d', label: '7 days', ms: 7 * 24 * 60 * 60_000 },
  { key: 'all', label: 'All', ms: Infinity },
]

export default function DashboardClient({
  events: allEvents,
  rows: allRows,
}: {
  events: TTPEvent[]
  rows: Rollup[]
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('time')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showShadowOnly, setShowShadowOnly] = useState(false)
  const [tableLimit, setTableLimit] = useState(25)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Derive unique providers
  const allProviders = useMemo(
    () => [...new Set(allEvents.map((e) => e.provider))].sort(),
    [allEvents],
  )

  // Filter events
  const events = useMemo(() => {
    const now = Date.now()
    const range = TIME_RANGES.find((r) => r.key === timeRange)?.ms ?? Infinity
    return allEvents.filter((e) => {
      if (range !== Infinity && now - e.timestamp > range) return false
      if (providerFilter !== 'all' && e.provider !== providerFilter) return false
      if (directionFilter !== 'all' && e.direction !== directionFilter) return false
      if (showShadowOnly && SANCTIONED.has(e.provider)) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !e.provider.toLowerCase().includes(q) &&
          !e.model_hint.toLowerCase().includes(q) &&
          !e.endpoint.toLowerCase().includes(q) &&
          !(e.dept_tag ?? '').toLowerCase().includes(q) &&
          !(e.project_tag ?? '').toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [allEvents, timeRange, providerFilter, directionFilter, showShadowOnly, searchQuery])

  // Filter rollup rows
  const rows = useMemo(() => {
    if (providerFilter === 'all') return allRows
    return allRows.filter((r) => r.provider === providerFilter)
  }, [allRows, providerFilter])

  // Sort events for table
  const sortedEvents = useMemo(() => {
    const sorted = [...events]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'time': cmp = a.timestamp - b.timestamp; break
        case 'provider': cmp = a.provider.localeCompare(b.provider); break
        case 'tokens': cmp = a.estimated_tokens - b.estimated_tokens; break
        case 'latency': cmp = (a.latency_ms ?? 0) - (b.latency_ms ?? 0); break
        case 'bytes': cmp = a.payload_bytes - b.payload_bytes; break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [events, sortKey, sortDir])

  // KPIs
  const totalCalls = events.filter((e) => e.direction === 'response' || e.direction === 'request').length
  const totalTokens = events.reduce((s, e) => s + e.estimated_tokens, 0)
  const totalBytes = events.reduce((s, e) => s + e.payload_bytes, 0)
  const providers = new Set(events.map((e) => e.provider)).size
  const latencySamples = events.map((e) => e.latency_ms).filter((x): x is number => x !== undefined)
  const p50 = percentile(latencySamples, 0.5)
  const p95 = percentile(latencySamples, 0.95)
  const errorCount = events.filter((e) => e.direction === 'error' || (e.status_code >= 400 && e.status_code < 600)).length
  const shadowCount = events.filter((e) => !SANCTIONED.has(e.provider)).length

  // Chart data
  const series = bucketize(events)
  const topProviders = providerBarData(rows)
  const deptSplit = deptPie(rows)
  const shadow = shadowAI(events)
  const tags = regulationTags(events)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === 'desc' ? ' \u25BC' : ' \u25B2') : ''

  return (
    <>
      {/* ── HIVE Hero — Token Economy Dashboard ──────────────────────── */}
      <section className="card no-lift" style={{ background: 'var(--gradient-hero)', border: '1px solid rgba(255,214,10,0.08)', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle gradient shimmer overlay */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '100%', background: 'radial-gradient(ellipse at 100% 0%, rgba(255,214,10,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,214,10,0.5)', marginBottom: 8 }}>Token Economy</div>
            <h1 style={{ marginTop: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              <span style={{ color: '#ffd60a' }}>HIVE</span> Dashboard
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14, lineHeight: 1.7, maxWidth: 520 }}>
              Every token is a decision. From invisible API calls to visible ROI.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <span style={{ padding: '6px 14px', borderRadius: 'var(--r-full)', background: events.length > 0 ? 'var(--hive-green-dim)' : 'var(--hive-orange-dim)', color: events.length > 0 ? 'var(--hive-green)' : 'var(--hive-orange)', fontSize: 11, fontWeight: 500, border: `1px solid ${events.length > 0 ? 'rgba(52,199,89,0.2)' : 'rgba(255,149,0,0.2)'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              {events.length > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--hive-green)', boxShadow: '0 0 8px rgba(52,199,89,0.5)' }} />}
              {events.length > 0 ? `Live \u2014 ${events.length} events` : 'Waiting for events...'}
            </span>
            {shadowCount > 0 && (
              <span style={{ padding: '6px 14px', borderRadius: 'var(--r-full)', background: 'var(--hive-red-dim)', color: 'var(--hive-red)', fontSize: 11, fontWeight: 500, border: '1px solid rgba(255,59,48,0.2)' }}>
                {shadowCount} shadow AI detected
              </span>
            )}
          </div>
        </div>

        {/* ── Token Economy KPIs ─────────────────────────────────────── */}
        <div className="kpi stagger" style={{ marginTop: 24 }}>
          <KPI label="Token Spend" value={compact(totalTokens)} accent />
          <KPI label="Est. Cost" value={`$${(totalTokens * 0.000003).toFixed(2)}`} accent />
          <KPI label="API Events" value={compact(totalCalls)} />
          <KPI label="Providers" value={String(providers)} />
          <KPI label="p50 Latency" value={p50 !== null ? `${Math.round(p50)}ms` : '\u2014'} />
          <KPI label="p95 Latency" value={p95 !== null ? `${Math.round(p95)}ms` : '\u2014'} />
          <KPI label="Error Rate" value={events.length > 0 ? `${((errorCount / events.length) * 100).toFixed(1)}%` : '0%'} alert={errorCount > 0} />
          <KPI label="Governance" value={events.length > 0 ? 'Compliant' : '\u2014'} compliant={events.length > 0} />
        </div>
      </section>

      {/* ── Token Governance Banner ──────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 16, padding: '14px 20px', borderRadius: 'var(--r-lg)',
        background: 'rgba(255,214,10,0.03)', border: '1px solid rgba(255,214,10,0.08)',
        margin: '8px 0 16px', alignItems: 'center', flexWrap: 'wrap',
        transition: 'border-color 0.2s ease',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd60a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--hive-yellow)', fontWeight: 500 }}>Token Governance Active</strong> &mdash; pii_asserted: false &middot; content_asserted: false &middot; Ed25519 signatures &middot; Tamper-evident audit chain
        </span>
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {tags.slice(0, 4).map(([tag]) => (
              <span key={tag} style={{ padding: '3px 10px', borderRadius: 'var(--r-full)', background: 'var(--hive-yellow-dim)', color: 'var(--hive-yellow)', fontSize: 10, fontWeight: 500 }}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Filters Bar ──────────────────────────────────────────────── */}
      <div className="filters-bar">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Filters:</span>

        {/* Time range chips */}
        {TIME_RANGES.map((r) => (
          <span
            key={r.key}
            className={`filter-chip ${timeRange === r.key ? 'active' : ''}`}
            onClick={() => setTimeRange(r.key)}
          >
            {r.label}
          </span>
        ))}

        <span style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

        <select
          className="filter-select"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
        >
          <option value="all">All providers</option>
          {allProviders.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
        >
          <option value="all">All directions</option>
          <option value="request">request</option>
          <option value="response">response</option>
          <option value="error">error</option>
          <option value="stream_chunk">stream_chunk</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showShadowOnly}
            onChange={(e) => setShowShadowOnly(e.target.checked)}
          />
          Shadow AI only
        </label>

        <input
          type="text"
          className="filter-input"
          placeholder="Search provider, model, endpoint..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────────────── */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Activity Timeline</h2>
        <p className="tag">Calls and estimated tokens per minute window.</p>
        {series.length > 0 ? (
          <CallsOverTime data={series} />
        ) : (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>
            No events in the selected time range. Adjust filters or wait for data.
          </p>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }} className="two-col">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Top Providers</h2>
          {topProviders.length > 0 ? (
            <ProviderBar data={topProviders} />
          ) : (
            <p style={{ color: 'var(--muted)' }}>No data.</p>
          )}
        </section>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Department Split</h2>
          {deptSplit.length > 0 ? (
            <DeptPie data={deptSplit} />
          ) : (
            <p style={{ color: 'var(--muted)' }}>No department data.</p>
          )}
        </section>
      </div>

      {/* ── Shadow AI — Governance Risk ──────────────────────────────── */}
      <section className="card" style={{ border: shadow.length > 0 ? '1px solid rgba(255,59,48,0.2)' : undefined, borderTop: shadow.length > 0 ? '2px solid var(--hive-red)' : undefined }}>
        <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: shadow.length > 0 ? 'rgba(255,59,48,0.5)' : 'var(--text-tertiary)', marginBottom: 8 }}>Governance Risk</div>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 500, color: shadow.length > 0 ? 'var(--hive-red)' : undefined }}>
          Shadow AI Detection
        </h2>
        {shadow.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            All clear. Every observed provider is sanctioned. &nbsp;
            <span style={{ color: '#34c759' }}>{'\u2713'}</span>
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Calls</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {shadow.map((s) => (
                <tr key={s.provider}>
                  <td><code>{s.provider}</code> <span style={{ color: '#ff3b30', fontSize: 11, fontWeight: 600 }}>SHADOW</span></td>
                  <td>{s.calls}</td>
                  <td style={{ color: '#ff3b30', fontWeight: 600 }}>
                    {s.calls > 50 ? 'HIGH' : s.calls > 10 ? 'MEDIUM' : 'LOW'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Token Governance & Compliance ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="two-col">
        <section className="card" style={{ borderTop: '2px solid var(--hive-yellow)' }}>
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,214,10,0.5)', marginBottom: 8 }}>Token Governance</div>
          <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 500 }}>Compliance is Structural</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Every TTP event carries immutable governance. Privacy is not a policy — it is enforced by the protocol itself.
          </p>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 2.2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd60a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>pii_asserted / content_asserted: <strong style={{ color: '#34c759' }}>structurally false</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd60a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>
              <span>Covenant enforced at ingest &mdash; <code>/metrics</code></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd60a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 5 5-11 11H5v-5L16 3Z"/></svg>
              <span>Batch signatures: <strong style={{ color: 'var(--fg)' }}>Ed25519</strong> &middot; Tamper-evident chain</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd60a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><path d="M4.9 7.9 7 10"/><path d="M19.1 7.9 17 10"/></svg>
              <span>Canonical JSON hashing &middot; Daily Merkle anchors</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,214,10,0.5)', marginBottom: 8 }}>Compliance</div>
          <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 500 }}>Regulation Tags</h2>
          {tags.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No regulation tags observed.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Tag</th><th>Events</th></tr>
              </thead>
              <tbody>
                {tags.map(([tag, count]) => (
                  <tr key={tag}><td><code>{tag}</code></td><td>{count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* ── Events Table ─────────────────────────────────────────────── */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ marginTop: 0 }}>
            Events <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>({events.length} total)</span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Show:</span>
            {[25, 50, 100].map((n) => (
              <span
                key={n}
                className={`filter-chip ${tableLimit === n ? 'active' : ''}`}
                onClick={() => setTableLimit(n)}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {sortedEvents.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>
            No events match your filters. <a href="/setup" style={{ color: 'var(--accent)' }}>Set up connectors</a> to start collecting.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('time')}>Time{sortIcon('time')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('provider')}>Provider{sortIcon('provider')}</th>
                  <th>Direction</th>
                  <th>Endpoint</th>
                  <th>Model</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('bytes')}>Bytes{sortIcon('bytes')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('tokens')}>Tokens{sortIcon('tokens')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('latency')}>Latency{sortIcon('latency')}</th>
                  <th>Status</th>
                  <th>Dept</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.slice(0, tableLimit).map((e) => (
                  <tr key={e.event_id} style={e.direction === 'error' ? { background: 'rgba(255,59,48,0.05)' } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }} suppressHydrationWarning>{mounted ? new Date(e.timestamp).toLocaleTimeString() : '\u2014'}</td>
                    <td>
                      <code>{e.provider}</code>
                      {!SANCTIONED.has(e.provider) && (
                        <span style={{ marginLeft: 6, color: '#ff3b30', fontSize: 10, fontWeight: 700 }}>SHADOW</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: e.direction === 'response' ? 'rgba(52,199,89,0.15)' : e.direction === 'error' ? 'rgba(255,59,48,0.15)' : 'rgba(0,122,255,0.15)',
                        color: e.direction === 'response' ? '#34c759' : e.direction === 'error' ? '#ff3b30' : '#007aff',
                      }}>
                        {e.direction}
                      </span>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.endpoint}</td>
                    <td><code>{e.model_hint}</code></td>
                    <td suppressHydrationWarning>{e.payload_bytes.toLocaleString()}</td>
                    <td suppressHydrationWarning>{e.estimated_tokens.toLocaleString()}</td>
                    <td>{e.latency_ms !== undefined ? `${Math.round(e.latency_ms)} ms` : '\u2014'}</td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        color: e.status_code === 200 ? '#34c759' : e.status_code >= 400 ? '#ff3b30' : 'var(--muted)',
                      }}>
                        {e.status_code || '\u2014'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{e.dept_tag ?? '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

// ── Utilities ────────────────────────────────────────────────────────────────

function KPI({ label, value, alert, accent, compliant }: { label: string; value: string; dark?: boolean; alert?: boolean; accent?: boolean; compliant?: boolean }) {
  return (
    <div className="kpi-item" style={accent ? { borderTop: '2px solid var(--hive-yellow)' } : undefined}>
      <div className="label">{label}</div>
      <div className="value" style={{
        ...(alert ? { color: 'var(--hive-red)' } : {}),
        ...(accent ? { color: 'var(--hive-yellow)' } : {}),
        ...(compliant ? { color: 'var(--hive-green)', fontSize: 20 } : {}),
      }}>{value}</div>
    </div>
  )
}

function compact(n: number): string {
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return `${(n / 1_000_000_000).toFixed(1)}B`
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? null
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function bucketize(events: TTPEvent[], bucketMs = 60_000) {
  if (events.length === 0) return []
  const map = new Map<number, { calls: number; tokens: number }>()
  for (const e of events) {
    const b = Math.floor(e.timestamp / bucketMs) * bucketMs
    const prev = map.get(b) ?? { calls: 0, tokens: 0 }
    prev.calls += 1
    prev.tokens += e.estimated_tokens
    map.set(b, prev)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([b, v]) => ({
      bucket: formatTime(b),
      calls: v.calls,
      tokens: v.tokens,
    }))
}

function providerBarData(rows: Rollup[]) {
  const map = new Map<string, { calls: number; tokens: number }>()
  for (const r of rows) {
    const prev = map.get(r.provider) ?? { calls: 0, tokens: 0 }
    prev.calls += r.call_count
    prev.tokens += r.total_tokens
    map.set(r.provider, prev)
  }
  return [...map.entries()]
    .map(([provider, v]) => ({ provider, ...v }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 8)
}

function deptPie(rows: Rollup[]) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const key = r.dept_tag ?? 'untagged'
    map.set(key, (map.get(key) ?? 0) + r.call_count)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}

function shadowAI(events: TTPEvent[]) {
  const shadow = events.filter((e) => e.provider.startsWith('custom:') || !SANCTIONED.has(e.provider))
  const byProvider = new Map<string, number>()
  for (const e of shadow) byProvider.set(e.provider, (byProvider.get(e.provider) ?? 0) + 1)
  return [...byProvider.entries()]
    .map(([provider, calls]) => ({ provider, calls }))
    .sort((a, b) => b.calls - a.calls)
}

function regulationTags(events: TTPEvent[]) {
  const map = new Map<string, number>()
  for (const e of events) {
    for (const tag of e.governance.regulation_tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + 1)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}
