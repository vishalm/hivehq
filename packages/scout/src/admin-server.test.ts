import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AdminServer, computeReadiness } from './admin-server.js'
import { createLogger } from './logger.js'
import { _resetForTest, counterInc, scoutMetrics } from './metrics.js'

const silentLogger = createLogger({ component: 'test', level: 'fatal' })

function defaultStatus() {
  return {
    scout_id: 'abc',
    fingerprint: 'fp',
    deployment: 'solo',
    endpoint: null,
    residency: 'AE',
    retention_days: 90,
    regulation_tags: ['UAE_AI_LAW'],
    connectors: ['openai'],
    version: '0.1.0',
    uptime_s: 1,
    wal: { files: 0, bytes: 0 },
    last_ship_timestamp_s: null,
    node_reachable: true,
  }
}

describe('AdminServer', () => {
  let server: AdminServer
  let port: number

  beforeEach(async () => {
    _resetForTest()
    server = new AdminServer({
      logger: silentLogger,
      bind: '127.0.0.1',
      port: 0,
      getStatus: () => defaultStatus(),
      getReadiness: () => ({ ready: true, reasons: [] }),
    })
    const addr = await server.start()
    port = addr.port
  })

  afterEach(async () => {
    await server.stop()
  })

  it('serves /health', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('serves /ready with 200 when ready', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/ready`)
    expect(res.status).toBe(200)
  })

  it('serves /ready with 503 when not ready', async () => {
    const unready = new AdminServer({
      logger: silentLogger,
      bind: '127.0.0.1',
      port: 0,
      getStatus: () => defaultStatus(),
      getReadiness: () => ({ ready: false, reasons: ['fetch_hook_not_installed'] }),
    })
    const addr = await unready.start()
    try {
      const res = await fetch(`http://127.0.0.1:${addr.port}/ready`)
      expect(res.status).toBe(503)
      const body = (await res.json()) as { ready: boolean; reasons: string[] }
      expect(body.ready).toBe(false)
      expect(body.reasons).toContain('fetch_hook_not_installed')
    } finally {
      await unready.stop()
    }
  })

  it('serves /metrics in Prometheus text format', async () => {
    counterInc(scoutMetrics.eventsShipped, {}, 5)
    const res = await fetch(`http://127.0.0.1:${port}/metrics`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/plain/)
    const body = await res.text()
    expect(body).toContain('# TYPE scout_up gauge')
    expect(body).toContain('scout_events_shipped_total 5')
  })

  it('serves /status as JSON', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/status`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { scout_id: string }
    expect(body.scout_id).toBe('abc')
  })

  it('returns 404 for unknown paths', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/no-such-path`)
    expect(res.status).toBe(404)
  })

  it('rejects non-GET methods', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { method: 'POST' })
    expect(res.status).toBe(405)
  })
})

describe('computeReadiness', () => {
  it('not ready when fetch hook is not installed', () => {
    const r = computeReadiness({
      fetchInstalled: false,
      deployment: 'node',
      nodeReachable: true,
      lastShipMs: Date.now(),
      flushIntervalMs: 60_000,
    })
    expect(r.ready).toBe(false)
    expect(r.reasons).toContain('fetch_hook_not_installed')
  })

  it('solo deployment never needs node reachability', () => {
    const r = computeReadiness({
      fetchInstalled: true,
      deployment: 'solo',
      nodeReachable: false,
      lastShipMs: null,
      flushIntervalMs: 60_000,
    })
    expect(r.ready).toBe(true)
  })

  it('ready in node mode after a recent ship even if currently unreachable', () => {
    const r = computeReadiness({
      fetchInstalled: true,
      deployment: 'node',
      nodeReachable: false,
      lastShipMs: Date.now() - 10_000,
      flushIntervalMs: 60_000,
    })
    expect(r.ready).toBe(true)
  })

  it('not ready in node mode if never shipped and node not reachable', () => {
    const r = computeReadiness({
      fetchInstalled: true,
      deployment: 'node',
      nodeReachable: false,
      lastShipMs: null,
      flushIntervalMs: 60_000,
    })
    expect(r.ready).toBe(false)
    expect(r.reasons).toContain('never_shipped_to_node')
  })

  it('not ready in node mode when ship is stale', () => {
    const r = computeReadiness({
      fetchInstalled: true,
      deployment: 'node',
      nodeReachable: false,
      lastShipMs: Date.now() - 10 * 60_000,
      flushIntervalMs: 60_000,
    })
    expect(r.ready).toBe(false)
    expect(r.reasons).toContain('ship_stale')
  })
})
