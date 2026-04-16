import type { HATPEvent } from '@hive/shared'
import { CORE_PROVIDERS } from '@hive/shared'
import { CallsOverTime, ProviderBar, DeptPie } from './charts'

interface Rollup {
  provider: string
  dept_tag: string | null
  call_count: number
  total_tokens: number
  total_bytes: number
  avg_latency_ms: number | null
}

const SANCTIONED: ReadonlySet<string> = new Set(CORE_PROVIDERS)

async function fetchData(): Promise<{ events: HATPEvent[]; rows: Rollup[] }> {
  const base = process.env.DASHBOARD_NODE_URL ?? 'http://localhost:3000'
  try {
    const [eventsRes, rollupRes] = await Promise.all([
      fetch(`${base}/api/v1/events/recent?limit=200`, { cache: 'no-store' }),
      fetch(`${base}/api/v1/rollups/aggregate`, { cache: 'no-store' }),
    ])
    if (!eventsRes.ok || !rollupRes.ok) throw new Error('node-server unreachable')
    const events = (await eventsRes.json()).events as HATPEvent[]
    const rows = (await rollupRes.json()).rows as Rollup[]
    return { events, rows }
  } catch {
    return { events: [], rows: [] }
  }
}

// ── Aggregations ─────────────────────────────────────────────────────────────

function bucketize(events: HATPEvent[], bucketMs = 60_000) {
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
      bucket: new Date(b).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      calls: v.calls,
      tokens: v.tokens,
    }))
}

function providerBar(rows: Rollup[]) {
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

function shadowAI(events: HATPEvent[]) {
  const shadow = events.filter((e) => {
    if (e.provider.startsWith('custom:')) return true
    return !SANCTIONED.has(e.provider)
  })
  const byProvider = new Map<string, number>()
  for (const e of shadow) byProvider.set(e.provider, (byProvider.get(e.provider) ?? 0) + 1)
  return [...byProvider.entries()]
    .map(([provider, calls]) => ({ provider, calls }))
    .sort((a, b) => b.calls - a.calls)
}

function regulationTags(events: HATPEvent[]) {
  const map = new Map<string, number>()
  for (const e of events) {
    for (const tag of e.governance.regulation_tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + 1)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { events, rows } = await fetchData()

  const totalCalls = rows.reduce((s, r) => s + r.call_count, 0)
  const totalTokens = rows.reduce((s, r) => s + r.total_tokens, 0)
  const totalBytes = rows.reduce((s, r) => s + r.total_bytes, 0)
  const providers = new Set(rows.map((r) => r.provider)).size

  const series = bucketize(events)
  const topProviders = providerBar(rows)
  const deptSplit = deptPie(rows)
  const shadow = shadowAI(events)
  const tags = regulationTags(events)

  const latencySamples = events.map((e) => e.latency_ms).filter((x): x is number => x !== undefined)
  const p50 = percentile(latencySamples, 0.5)
  const p95 = percentile(latencySamples, 0.95)

  return (
    <>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>HIVE · Node Dashboard</h1>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          Scout → Node → Hive. Zero content. Governance-native. Signed provenance.
        </p>
        <div className="kpi" style={{ marginTop: 16 }}>
          <KPI label="Calls (observed)" value={totalCalls.toLocaleString()} />
          <KPI label="Est. tokens" value={compact(totalTokens)} />
          <KPI label="Payload bytes" value={compact(totalBytes)} />
          <KPI label="Providers seen" value={String(providers)} />
          <KPI label="p50 latency" value={p50 !== null ? `${Math.round(p50)} ms` : '—'} />
          <KPI label="p95 latency" value={p95 !== null ? `${Math.round(p95)} ms` : '—'} />
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Activity</h2>
        <p className="tag">Calls and estimated tokens per minute, from the most recent window.</p>
        <CallsOverTime data={series} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }} className="two-col">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Top Providers</h2>
          <ProviderBar data={topProviders} />
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Dept / Project split</h2>
          <DeptPie data={deptSplit} />
        </section>
      </div>

      <section className="card" style={{ border: shadow.length > 0 ? '1px solid #ff3b30' : undefined }}>
        <h2 style={{ marginTop: 0, color: shadow.length > 0 ? '#ff3b30' : undefined }}>
          Shadow AI
        </h2>
        {shadow.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            No unsanctioned providers detected. Every observed provider is in <code>CORE_PROVIDERS</code>.
          </p>
        ) : (
          <>
            <p className="tag">
              Calls observed against providers outside your sanctioned list. Raise a policy rule in
              <code> @hive/policy</code> to auto-route these to security review.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Calls (recent)</th>
                </tr>
              </thead>
              <tbody>
                {shadow.map((s) => (
                  <tr key={s.provider}>
                    <td><code>{s.provider}</code></td>
                    <td>{s.calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="two-col">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Governance</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.8, fontSize: 14, color: 'var(--muted)' }}>
            <li>HATP pii_asserted / content_asserted: <strong style={{ color: '#34c759' }}>structurally false</strong></li>
            <li>Covenant enforced at ingest — see <code>/metrics</code></li>
            <li>Batch signatures: <strong>Ed25519</strong> · Tamper-evident audit chain</li>
            <li>Canonical JSON hashing · Daily Merkle anchors</li>
          </ul>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Regulation Tags</h2>
          {tags.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No regulation tags observed.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {tags.map(([tag, count]) => (
                  <tr key={tag}>
                    <td><code>{tag}</code></td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Recent Events</h2>
        {events.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            No events yet. Install <code>@hive/connector-openai</code> (or anthropic / google /
            azure-openai / bedrock / mistral) and make a call.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider</th>
                <th>Endpoint</th>
                <th>Model</th>
                <th>Bytes</th>
                <th>Tokens</th>
                <th>Latency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 25).map((e) => (
                <tr key={e.event_id}>
                  <td>{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td>
                    <code>{e.provider}</code>
                    {!SANCTIONED.has(e.provider) && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: '#ff3b30',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        SHADOW
                      </span>
                    )}
                  </td>
                  <td>{e.endpoint}</td>
                  <td>{e.model_hint}</td>
                  <td>{e.payload_bytes.toLocaleString()}</td>
                  <td>{e.estimated_tokens.toLocaleString()}</td>
                  <td>{e.latency_ms !== undefined ? `${Math.round(e.latency_ms)} ms` : '—'}</td>
                  <td>{e.status_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

// ── Utils ────────────────────────────────────────────────────────────────────

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-item">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
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
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx] ?? null
}
