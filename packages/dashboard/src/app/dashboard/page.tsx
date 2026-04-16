import type { TTPEvent } from '@hive/shared'
import DashboardClient from './dashboard-client'

interface Rollup {
  provider: string
  dept_tag: string | null
  call_count: number
  total_tokens: number
  total_bytes: number
  avg_latency_ms: number | null
}

async function fetchData(): Promise<{ events: TTPEvent[]; rows: Rollup[] }> {
  const base = process.env['DASHBOARD_NODE_URL'] ?? 'http://localhost:3000'
  try {
    const [eventsRes, rollupRes] = await Promise.all([
      fetch(`${base}/api/v1/events/recent?limit=500`, { cache: 'no-store' }),
      fetch(`${base}/api/v1/rollups/aggregate`, { cache: 'no-store' }),
    ])
    if (!eventsRes.ok || !rollupRes.ok) throw new Error('node-server unreachable')
    const events = (await eventsRes.json()).events as TTPEvent[]
    const rows = (await rollupRes.json()).rows as Rollup[]
    return { events, rows }
  } catch {
    return { events: [], rows: [] }
  }
}

export default async function DashboardPage() {
  const { events, rows } = await fetchData()
  return (
    <div style={{ paddingBottom: 40 }}>
      <DashboardClient events={events} rows={rows} />
    </div>
  )
}
