import type { TTPEvent } from '@hive/shared'
import GraphsClient from './graphs-client'

const NODE_URL = process.env['DASHBOARD_NODE_URL'] ?? 'http://localhost:3000'

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${NODE_URL}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default async function GraphsPage() {
  const [eventsData, cost, anomalies, forecast, clusters, fingerprints] = await Promise.all([
    fetchJSON<{ events: TTPEvent[] }>('/api/v1/events/recent?limit=500'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/cost?limit=2000'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/anomalies?limit=2000'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/forecast?limit=2000&horizon=90'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/clusters?limit=2000'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/fingerprints?limit=2000&groupBy=dept'),
  ])

  return (
    <div style={{ paddingBottom: 60 }}>
      <GraphsClient
        events={eventsData?.events ?? []}
        cost={cost}
        anomalies={anomalies}
        forecast={forecast}
        clusters={clusters}
        fingerprints={fingerprints}
      />
    </div>
  )
}
