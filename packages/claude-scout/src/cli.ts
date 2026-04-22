#!/usr/bin/env node
/**
 * HIVE Claude Scout CLI — per-account telemetry from local Claude transcripts.
 *
 * Commands:
 *   claude-scout start              — daemon: tail transcripts + ship events
 *   claude-scout stop               — graceful SIGTERM via PID file
 *   claude-scout scan [--since]     — one-shot sweep (new lines since last offset)
 *   claude-scout backfill           — re-emit every transcript from the start
 *   claude-scout accounts           — list configured accounts
 *   claude-scout doctor             — sanity checks
 *   claude-scout status             — identity + counters
 *   claude-scout metrics            — print Prometheus metrics
 *
 * Environment:
 *   TTP_ENDPOINT                    — Node hub URL (omit for solo)
 *   TTP_TOKEN                       — ingest bearer token
 *   CLAUDE_SCOUT_CONFIG             — path to config.json (default ~/.claude-scout/config.json)
 *   HIVE_LOG_LEVEL                  — pino level
 */
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { createLogger, renderProm } from '@hive/scout'
import {
  loadConfig,
  resolveClaudeHome,
  resolveStateDir,
  type ClaudeScoutConfig,
} from './config.js'
import { ClaudeScout } from './claude-scout.js'
import { AccountResolver } from './account-resolver.js'

const args = process.argv.slice(2)
const command = args[0] ?? 'start'

async function main(): Promise<void> {
  switch (command) {
    case 'start':
      return cmdStart()
    case 'stop':
      return cmdStop()
    case 'scan':
      return cmdScan()
    case 'backfill':
      return cmdBackfill()
    case 'accounts':
      return cmdAccounts()
    case 'doctor':
      return cmdDoctor()
    case 'status':
      return cmdStatus()
    case 'metrics':
      return cmdMetrics()
    default:
      console.error(`Unknown command: ${command}`)
      console.error(
        `Usage: claude-scout <start|stop|scan|backfill|accounts|doctor|status|metrics>`,
      )
      process.exit(1)
  }
}

async function cmdStart(): Promise<void> {
  const config = await loadConfig()
  const log = createLogger({ component: 'claude-scout-cli' })
  const pidFile = join(resolveStateDir(config), 'claude-scout.pid')
  await claimPidFile(pidFile, log)

  const scout = new ClaudeScout({
    config,
    ...(process.env.TTP_ENDPOINT && { ttpEndpoint: process.env.TTP_ENDPOINT }),
    ...(process.env.TTP_TOKEN && { ttpToken: process.env.TTP_TOKEN }),
    logger: log,
  })
  await scout.start()

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    log.info({ signal }, 'received shutdown signal')
    try {
      await scout.shutdown()
    } finally {
      await fs.unlink(pidFile).catch(() => undefined)
      process.exit(0)
    }
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

async function cmdStop(): Promise<void> {
  const config = await loadConfig()
  const pidFile = join(resolveStateDir(config), 'claude-scout.pid')
  const pid = await readPidFile(pidFile)
  if (pid === null) {
    console.error('No running claude-scout (PID file not found)')
    process.exit(1)
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
    console.log(`Sent SIGTERM to claude-scout pid=${pid}`)
  } catch (err) {
    console.error(
      `Could not signal pid ${pid}: ${err instanceof Error ? err.message : String(err)}`,
    )
    await fs.unlink(pidFile).catch(() => undefined)
    process.exit(1)
  }
}

async function cmdScan(): Promise<void> {
  const config = await loadConfig()
  const log = createLogger({ component: 'claude-scout-cli' })
  const scout = new ClaudeScout({
    config,
    ...(process.env.TTP_ENDPOINT && { ttpEndpoint: process.env.TTP_ENDPOINT }),
    ...(process.env.TTP_TOKEN && { ttpToken: process.env.TTP_TOKEN }),
    logger: log,
    disableAdminServer: true,
  })
  await scout.scanner.init()
  await scout.sessionIndex.refresh()
  if (scout.persistentSink) {
    await scout.persistentSink.init()
    await scout.persistentSink.replayAll()
  }
  const result = await scout.runSweep()
  await scout.collector.flush()
  if (scout.persistentSink) await scout.persistentSink.stop()
  await scout.shutdown().catch(() => undefined)
  console.log(
    `scanned files=${result.filesScanned} lines=${result.linesSeen} events=${result.eventsEmitted}`,
  )
}

async function cmdBackfill(): Promise<void> {
  const config = await loadConfig()
  const log = createLogger({ component: 'claude-scout-cli' })
  const scout = new ClaudeScout({
    config,
    ...(process.env.TTP_ENDPOINT && { ttpEndpoint: process.env.TTP_ENDPOINT }),
    ...(process.env.TTP_TOKEN && { ttpToken: process.env.TTP_TOKEN }),
    logger: log,
    disableAdminServer: true,
  })
  await scout.scanner.init()
  await scout.sessionIndex.refresh()
  if (scout.persistentSink) {
    await scout.persistentSink.init()
    await scout.persistentSink.replayAll()
  }
  const result = await scout.backfill()
  await scout.collector.flush()
  if (scout.persistentSink) await scout.persistentSink.stop()
  await scout.shutdown().catch(() => undefined)
  console.log(
    `backfill files=${result.filesScanned} lines=${result.linesSeen} events=${result.eventsEmitted}`,
  )
}

async function cmdAccounts(): Promise<void> {
  const config = await loadConfig()
  const resolver = new AccountResolver(config)
  console.log('Claude Scout accounts:')
  for (const acc of resolver.all()) {
    const parts: string[] = []
    parts.push(`name=${acc.name}`)
    parts.push(`account_id=${acc.account_id}`)
    if (acc.cwd_prefix) parts.push(`cwd_prefix=${acc.cwd_prefix}`)
    if (acc.dept_tag) parts.push(`dept=${acc.dept_tag}`)
    if (acc.project_tag) parts.push(`project=${acc.project_tag}`)
    const marker = acc.name === config.default_account ? ' (default)' : ''
    console.log(`  - ${parts.join(' ')}${marker}`)
  }
}

async function cmdStatus(): Promise<void> {
  const config = await loadConfig()
  const log = createLogger({ component: 'claude-scout-cli', level: 'error' })
  const scout = new ClaudeScout({
    config,
    logger: log,
    disableAdminServer: true,
    disablePersistence: true,
  })
  const status = scout.status()
  console.log(JSON.stringify(status, null, 2))
}

function cmdMetrics(): void {
  process.stdout.write(renderProm())
}

async function cmdDoctor(): Promise<void> {
  const checks: Array<{ name: string; ok: boolean; detail: string }> = []
  let config: ClaudeScoutConfig
  try {
    config = await loadConfig()
    checks.push({ name: 'config', ok: true, detail: 'loaded' })
  } catch (err) {
    checks.push({
      name: 'config',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    })
    printDoctor(checks)
    process.exit(1)
    return
  }

  const claudeHome = resolveClaudeHome(config)
  try {
    await fs.access(claudeHome)
    checks.push({ name: 'claude_home', ok: true, detail: claudeHome })
  } catch {
    checks.push({ name: 'claude_home', ok: false, detail: `not found: ${claudeHome}` })
  }

  try {
    await fs.access(join(claudeHome, 'projects'))
    checks.push({ name: 'projects', ok: true, detail: 'readable' })
  } catch {
    checks.push({
      name: 'projects',
      ok: false,
      detail: `${claudeHome}/projects missing — no transcripts to scan`,
    })
  }

  const stateDir = resolveStateDir(config)
  try {
    await fs.mkdir(stateDir, { recursive: true })
    const test = join(stateDir, `.doctor-${Date.now()}`)
    await fs.writeFile(test, 'ok')
    await fs.unlink(test)
    checks.push({ name: 'state_dir', ok: true, detail: `${stateDir} writable` })
  } catch (err) {
    checks.push({
      name: 'state_dir',
      ok: false,
      detail: `${stateDir}: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  const resolver = new AccountResolver(config)
  checks.push({
    name: 'accounts',
    ok: true,
    detail: `${resolver.all().length} configured, default=${config.default_account}`,
  })

  if (process.env.TTP_ENDPOINT) {
    const healthUrl = new URL('/health', process.env.TTP_ENDPOINT).toString()
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 5_000)
      const res = await fetch(healthUrl, { signal: ctrl.signal })
      clearTimeout(timer)
      checks.push({
        name: 'ttp_endpoint',
        ok: res.ok,
        detail: `${healthUrl} -> ${res.status}`,
      })
    } catch (err) {
      checks.push({
        name: 'ttp_endpoint',
        ok: false,
        detail: `${healthUrl}: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  } else {
    checks.push({
      name: 'ttp_endpoint',
      ok: true,
      detail: 'TTP_ENDPOINT unset — running solo (local buffer only)',
    })
  }

  printDoctor(checks)
  if (checks.some((c) => !c.ok)) process.exit(1)
}

function printDoctor(checks: Array<{ name: string; ok: boolean; detail: string }>): void {
  console.log('HIVE Claude Scout doctor')
  for (const c of checks) {
    const mark = c.ok ? '[ok]  ' : '[fail]'
    console.log(`  ${mark} ${c.name.padEnd(14)} ${c.detail}`)
  }
  const failures = checks.filter((c) => !c.ok).length
  console.log('')
  console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`)
}

async function claimPidFile(
  pidFile: string,
  log: ReturnType<typeof createLogger>,
): Promise<void> {
  await fs.mkdir(dirname(pidFile), { recursive: true })
  const existing = await readPidFile(pidFile)
  if (existing !== null) {
    try {
      process.kill(existing, 0)
      log.error({ pid: existing }, 'another claude-scout is already running')
      process.exit(1)
    } catch {
      log.warn({ pid: existing }, 'found stale PID file; taking over')
    }
  }
  await fs.writeFile(pidFile, String(process.pid))
}

async function readPidFile(pidFile: string): Promise<number | null> {
  try {
    const raw = await fs.readFile(pidFile, 'utf8')
    const pid = parseInt(raw.trim(), 10)
    return Number.isFinite(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
