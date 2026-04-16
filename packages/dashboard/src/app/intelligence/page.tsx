import IntelligenceClient from './intelligence-client'

const NODE_URL = process.env['DASHBOARD_NODE_URL'] ?? 'http://localhost:3000'

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${NODE_URL}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default async function IntelligencePage() {
  const [cost, anomalies, forecast, clusters, fingerprints] = await Promise.all([
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/cost?limit=2000'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/anomalies?limit=2000'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/forecast?limit=2000&horizon=90'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/clusters?limit=2000'),
    fetchJSON<Record<string, unknown>>('/api/v1/intelligence/fingerprints?limit=2000&groupBy=dept'),
  ])

  return (
    <IntelligenceClient
      cost={cost}
      anomalies={anomalies}
      forecast={forecast}
      clusters={clusters}
      fingerprints={fingerprints}
    />
  )
}
