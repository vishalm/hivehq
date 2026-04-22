import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Logger } from './logger.js'
import { renderProm, scoutMetrics } from './metrics.js'

export interface AdminServerDeps {
  logger: Logger
  /** 127.0.0.1 unless HIVE_ADMIN_BIND is set. */
  bind: string
  /** 0 picks a free port (used in tests). */
  port: number
  getStatus: () => StatusReport
  getReadiness: () => ReadinessReport
}

export interface StatusReport {
  scout_id: string
  fingerprint: string
  deployment: string
  endpoint: string | null
  residency: string
  retention_days: number
  regulation_tags: string[]
  connectors: string[]
  version: string
  uptime_s: number
  wal: { files: number; bytes: number }
  last_ship_timestamp_s: number | null
  node_reachable: boolean
}

export interface ReadinessReport {
  ready: boolean
  reasons: string[]
}

export class AdminServer {
  private server: Server | null = null
  private readonly deps: AdminServerDeps

  constructor(deps: AdminServerDeps) {
    this.deps = deps
  }

  async start(): Promise<{ address: string; port: number }> {
    if (this.server) throw new Error('AdminServer already started')
    const server = createServer(async (req, res) => {
      try {
        await this.handle(req, res)
      } catch (err) {
        this.deps.logger.error(
          { err: err instanceof Error ? err.message : String(err), url: req.url },
          'admin server handler error',
        )
        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'internal' }))
        }
      }
    })
    server.keepAliveTimeout = 5_000
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.deps.port, this.deps.bind, () => {
        server.off('error', reject)
        resolve()
      })
    })
    this.server = server
    const addr = server.address() as AddressInfo
    this.deps.logger.info(
      { bind: addr.address, port: addr.port },
      'scout admin server listening',
    )
    return { address: addr.address, port: addr.port }
  }

  async stop(): Promise<void> {
    if (!this.server) return
    await new Promise<void>((resolve) => this.server!.close(() => resolve()))
    this.server = null
  }

  private async handle(
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'method_not_allowed' }))
      return
    }

    switch (path) {
      case '/health':
        return this.writeJson(res, 200, { ok: true })
      case '/ready': {
        const report = this.deps.getReadiness()
        return this.writeJson(res, report.ready ? 200 : 503, report)
      }
      case '/metrics': {
        res.statusCode = 200
        res.setHeader('content-type', 'text/plain; version=0.0.4')
        res.end(renderProm())
        return
      }
      case '/status': {
        return this.writeJson(res, 200, this.deps.getStatus())
      }
      default:
        return this.writeJson(res, 404, { error: 'not_found', path })
    }
  }

  private writeJson(
    res: import('node:http').ServerResponse,
    status: number,
    body: unknown,
  ): void {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
}

/** Helper: compute readiness from operational signals. */
export function computeReadiness(args: {
  fetchInstalled: boolean
  deployment: string
  nodeReachable: boolean
  lastShipMs: number | null
  flushIntervalMs: number
}): ReadinessReport {
  const reasons: string[] = []
  if (!args.fetchInstalled) reasons.push('fetch_hook_not_installed')

  if (args.deployment !== 'solo') {
    if (!args.nodeReachable) {
      if (args.lastShipMs === null) {
        reasons.push('never_shipped_to_node')
      } else {
        const stalenessMs = Date.now() - args.lastShipMs
        const threshold = Math.max(args.flushIntervalMs * 5, 60_000)
        if (stalenessMs > threshold) reasons.push('ship_stale')
      }
    }
  }

  return { ready: reasons.length === 0, reasons }
}

export function isNodeReachable(): boolean {
  return (scoutMetrics.nodeReachable.values.get('') ?? 0) === 1
}

export function lastShipMs(): number | null {
  const s = scoutMetrics.lastShipTimestamp.values.get('')
  return s ? s * 1000 : null
}
