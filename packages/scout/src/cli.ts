#!/usr/bin/env node
/**
 * HIVE Scout CLI — intercepts LLM traffic and ships TTP events.
 *
 * Commands:
 *   scout start              — start Scout (fetch hook, WAL, admin server)
 *   scout stop               — graceful SIGTERM to a running Scout (via PID file)
 *   scout status             — show identity + config
 *   scout events [--limit N] — dump recent local events (solo mode)
 *   scout doctor             — diagnose config, ports, WAL, endpoint reachability
 */
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { Scout } from './scout.js'
import { loadScoutEnv } from './env.js'
import { createLogger } from './logger.js'
import { renderProm } from './metrics.js'

const PID_FILE = '.hive/scout/scout.pid'

const args = process.argv.slice(2)
const command = args[0] ?? 'start'

async function main(): Promise<void> {
  switch (command) {
    case 'start':
      return cmdStart()
    case 'stop':
      return cmdStop()
    case 'status':
      return cmdStatus()
    case 'events':
      return cmdEvents()
    case 'doctor':
      return cmdDoctor()
    case 'metrics':
      return cmdMetrics()
    default:
      console.error(`Unknown command: ${command}`)
      console.error(`Usage: scout <start|stop|status|events|doctor|metrics>`)
      process.exit(1)
  }
}

async function cmdStart(): Promise<void> {
  const env = loadScoutEnv()
  const log = createLogger({ component: 'scout-cli', level: env.HIVE_LOG_LEVEL })

  await claimPidFile(log)

  const scout = new Scout({ env, logger: log })
  await scout.start()
  scout.installGlobalFetch()

  log.info(
    {
      scout_id: scout.id,
      deployment: env.HIVE_DEPLOYMENT,
      endpoint: env.TTP_ENDPOINT ?? null,
      admin: `${env.HIVE_ADMIN_BIND}:${env.HIVE_ADMIN_PORT}`,
      connectors: env.enabledConnectors,
    },
    'scout ready',
  )

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    log.info({ signal }, 'received shutdown signal')
    try {
      await scout.shutdown()
    } finally {
      await releasePidFile().catch(() => undefined)
      process.exit(0)
    }
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  const heartbeat = setInterval(() => {
    log.debug(
      {
        queue_depth: scout.collector.pendingCount(),
        events_recorded_total: scout.localEvents().length,
      },
      'heartbeat',
    )
  }, 60_000)
  if (typeof heartbeat.unref === 'function') heartbeat.unref()
}

async function cmdStop(): Promise<void> {
  const pid = await readPidFile()
  if (pid === null) {
    console.error('No running Scout (PID file not found)')
    process.exit(1)
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
    console.log(`Sent SIGTERM to scout pid=${pid}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Could not signal pid ${pid}: ${msg}`)
    await releasePidFile().catch(() => undefined)
    process.exit(1)
  }
}

function cmdStatus(): void {
  const env = loadScoutEnv()
  const scout = new Scout({ env, disableAdminServer: true, disablePersistence: true })
  const s = scout.status()
  const lines = [
    `HIVE Scout ${s.version}`,
    `  id:            ${s.scout_id}`,
    `  fingerprint:   ${s.fingerprint}`,
    `  deployment:    ${s.deployment}`,
    `  endpoint:      ${s.endpoint ?? '(solo)'}`,
    `  residency:     ${s.residency}`,
    `  retention:     ${s.retention_days}d`,
    `  regulation:    ${s.regulation_tags.join(', ')}`,
    `  connectors:    ${s.connectors.join(', ')}`,
  ]
  console.log(lines.join('\n'))
}

async function cmdEvents(): Promise<void> {
  const env = loadScoutEnv()
  const scout = new Scout({ env, disableAdminServer: true, disablePersistence: true })
  const limit = parseInt(args[1] ?? '20', 10)
  const events = scout.localEvents().slice(-limit)
  if (events.length === 0) {
    console.log('No local events.')
    return
  }
  for (const e of events) {
    const t = new Date(e.timestamp).toISOString()
    console.log(
      `  ${t} | ${e.provider.padEnd(12)} | ${e.model_hint.padEnd(24)} | ${e.direction.padEnd(8)} | ${e.estimated_tokens} tok | ${e.latency_ms ?? '-'}ms`,
    )
  }
}

function cmdMetrics(): void {
  process.stdout.write(renderProm())
}

async function cmdDoctor(): Promise<void> {
  const checks: DoctorCheck[] = []

  let env
  try {
    env = loadScoutEnv()
    checks.push({ name: 'env', ok: true, detail: 'Environment parses' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    checks.push({ name: 'env', ok: false, detail: msg })
    printDoctor(checks)
    process.exit(1)
    return
  }

  checks.push({
    name: 'deployment',
    ok: true,
    detail: `${env.HIVE_DEPLOYMENT}${env.TTP_ENDPOINT ? ` -> ${env.TTP_ENDPOINT}` : ''}`,
  })

  await checkWalDir(env.HIVE_WAL_DIR, checks)
  await checkPidFile(checks)
  await checkAdminPort(env.HIVE_ADMIN_BIND, env.HIVE_ADMIN_PORT, checks)
  if (env.TTP_ENDPOINT) await checkEndpoint(env.TTP_ENDPOINT, checks)

  printDoctor(checks)
  if (checks.some((c) => !c.ok)) process.exit(1)
}

interface DoctorCheck {
  name: string
  ok: boolean
  detail: string
}

async function checkWalDir(dir: string, checks: DoctorCheck[]): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true })
    const test = join(dir, `.doctor-${Date.now()}`)
    await fs.writeFile(test, 'ok')
    await fs.unlink(test)
    checks.push({ name: 'wal_dir', ok: true, detail: `${dir} writable` })
  } catch (err) {
    checks.push({
      name: 'wal_dir',
      ok: false,
      detail: `${dir}: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}

async function checkPidFile(checks: DoctorCheck[]): Promise<void> {
  const pid = await readPidFile()
  if (pid === null) {
    checks.push({ name: 'pid_file', ok: true, detail: 'no running scout' })
    return
  }
  try {
    process.kill(pid, 0)
    checks.push({ name: 'pid_file', ok: true, detail: `scout running pid=${pid}` })
  } catch {
    checks.push({
      name: 'pid_file',
      ok: false,
      detail: `stale PID file points at dead pid=${pid} (remove ${PID_FILE})`,
    })
  }
}

async function checkAdminPort(
  bind: string,
  port: number,
  checks: DoctorCheck[],
): Promise<void> {
  if (port === 0) {
    checks.push({ name: 'admin_port', ok: true, detail: 'disabled' })
    return
  }
  const net = await import('node:net')
  const inUse = await new Promise<boolean>((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(true))
    s.once('listening', () => {
      s.close(() => resolve(false))
    })
    s.listen(port, bind)
  })
  if (inUse) {
    checks.push({
      name: 'admin_port',
      ok: false,
      detail: `${bind}:${port} already in use (another Scout? set HIVE_ADMIN_PORT)`,
    })
  } else {
    checks.push({ name: 'admin_port', ok: true, detail: `${bind}:${port} free` })
  }
}

async function checkEndpoint(url: string, checks: DoctorCheck[]): Promise<void> {
  const healthUrl = new URL('/health', url).toString()
  const started = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5_000)
    const res = await fetch(healthUrl, { signal: ctrl.signal })
    clearTimeout(timer)
    const elapsed = Date.now() - started
    if (res.ok) {
      checks.push({ name: 'endpoint', ok: true, detail: `${healthUrl} ${res.status} in ${elapsed}ms` })
    } else {
      checks.push({
        name: 'endpoint',
        ok: false,
        detail: `${healthUrl} returned ${res.status}`,
      })
    }
  } catch (err) {
    checks.push({
      name: 'endpoint',
      ok: false,
      detail: `${healthUrl}: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}

function printDoctor(checks: DoctorCheck[]): void {
  console.log('HIVE Scout doctor')
  for (const c of checks) {
    const mark = c.ok ? '[ok]  ' : '[fail]'
    console.log(`  ${mark} ${c.name.padEnd(12)} ${c.detail}`)
  }
  const failures = checks.filter((c) => !c.ok).length
  console.log('')
  console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`)
}

async function claimPidFile(log: ReturnType<typeof createLogger>): Promise<void> {
  await fs.mkdir(dirname(PID_FILE), { recursive: true })
  const existing = await readPidFile()
  if (existing !== null) {
    try {
      process.kill(existing, 0)
      log.error({ pid: existing }, 'another scout is already running')
      process.exit(1)
    } catch {
      log.warn({ pid: existing }, 'found stale PID file; taking over')
    }
  }
  await fs.writeFile(PID_FILE, String(process.pid))
}

async function readPidFile(): Promise<number | null> {
  try {
    const raw = await fs.readFile(PID_FILE, 'utf8')
    const pid = parseInt(raw.trim(), 10)
    return Number.isFinite(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

async function releasePidFile(): Promise<void> {
  await fs.unlink(PID_FILE).catch(() => undefined)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
