import { hostname } from 'node:os'
import { join } from 'node:path'
import {
  type CollectorSink,
  HttpSink,
  InMemorySink,
  TTPCollector,
} from '@hive/connector'
import {
  AdminServer,
  computeReadiness,
  createLogger,
  PersistentSink,
  type Logger,
  type ReadinessReport,
  type StatusReport,
  scoutMetrics,
  counterInc,
  gaugeSet,
} from '@hive/scout'
import {
  type GovernanceBlock,
  type TTPEvent,
  defaultUAEGovernance,
  deriveScoutId,
  sha256Hex,
} from '@hive/shared'
import {
  type ClaudeScoutConfig,
  resolveClaudeHome,
  resolveStateDir,
} from './config.js'
import { AccountResolver } from './account-resolver.js'
import { SessionIndex } from './session-index.js'
import {
  TranscriptScanner,
  type ScanResult,
  type TranscriptSink,
} from './transcript-scanner.js'
import { totalTokens, type TranscriptMessageEvent } from './transcript-parser.js'

export const CLAUDE_SCOUT_VERSION = '0.1.0'
export const CLAUDE_CODE_PROVIDER = 'custom:claude_code' as const

export interface ClaudeScoutOptions {
  config: ClaudeScoutConfig
  /** TTP endpoint to ship to; omit to buffer locally (solo mode). */
  ttpEndpoint?: string
  /** Bearer token for the TTP endpoint. */
  ttpToken?: string
  /** Data residency (country code). Default inherits UAE default. */
  dataResidency?: string
  /** Days to retain events. Default 90. */
  retentionDays?: number
  /** Override the outbound sink (tests). */
  sinkOverride?: CollectorSink
  /** Custom fetch for HttpSink (tests). */
  fetchImpl?: typeof fetch
  logger?: Logger
  /** Disable the admin HTTP server (tests, cli scan). */
  disableAdminServer?: boolean
  /** Disable the WAL (tests). */
  disablePersistence?: boolean
  /** Admin HTTP port. Default 9478 — one above plain Scout. */
  adminPort?: number
  adminBind?: string
  /** Override device fingerprint for deterministic scout_id. */
  deviceFingerprint?: string
}

/**
 * Claude Scout — wires the transcript scanner to TTP emission.
 *
 * One Claude Scout instance can ship telemetry for many Claude accounts; each
 * session's cwd is mapped to one of the configured accounts via AccountResolver
 * and the resolved account's dept/project tags are stamped onto every event.
 */
export class ClaudeScout {
  readonly logger: Logger
  readonly collector: TTPCollector
  readonly accountResolver: AccountResolver
  readonly sessionIndex: SessionIndex
  readonly scanner: TranscriptScanner
  readonly persistentSink?: PersistentSink
  readonly localSink?: InMemorySink
  private adminServer: AdminServer | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private started = false
  private readonly scoutId: string
  private readonly startedAt = Date.now()
  private readonly opts: ClaudeScoutOptions

  constructor(opts: ClaudeScoutOptions) {
    this.opts = opts
    const fingerprint = opts.deviceFingerprint ?? hostname()
    this.scoutId = deriveScoutId(fingerprint, 'hive-claude-scout-salt-v1')
    this.logger =
      opts.logger ?? createLogger({ component: 'claude-scout', scoutId: this.scoutId })

    this.accountResolver = new AccountResolver(opts.config)
    this.sessionIndex = new SessionIndex(resolveClaudeHome(opts.config))
    this.scanner = new TranscriptScanner({
      claudeHome: resolveClaudeHome(opts.config),
      offsetsPath: join(resolveStateDir(opts.config), 'offsets.json'),
      logger: this.logger.child({ component: 'claude-scout-scanner' }),
    })

    const governance: GovernanceBlock = defaultUAEGovernance({
      ...(opts.dataResidency && { data_residency: opts.dataResidency }),
      ...(opts.retentionDays !== undefined && { retention_days: opts.retentionDays }),
    })

    let sink: CollectorSink
    if (opts.sinkOverride) {
      sink = opts.sinkOverride
    } else if (!opts.ttpEndpoint) {
      const mem = new InMemorySink()
      this.localSink = mem
      sink = mem
    } else {
      const httpSink = new HttpSink({
        endpoint: opts.ttpEndpoint,
        ...(opts.ttpToken && { token: opts.ttpToken }),
        ...(opts.fetchImpl && { fetchImpl: opts.fetchImpl }),
      })
      if (opts.disablePersistence) {
        sink = httpSink
      } else {
        this.persistentSink = new PersistentSink({
          upstream: httpSink,
          dir: join(resolveStateDir(opts.config), 'queue'),
          logger: this.logger.child({ component: 'claude-scout-wal' }),
        })
        sink = this.persistentSink
      }
    }

    this.collector = new TTPCollector({
      sink,
      governance,
      deployment: opts.ttpEndpoint ? 'node' : 'solo',
      emitterId: this.scoutId,
      emitterType: 'scout',
      flushIntervalMs: 10_000,
    })
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.scanner.init()
    await this.sessionIndex.refresh()
    if (this.persistentSink) {
      await this.persistentSink.init()
      await this.persistentSink.replayAll()
      this.persistentSink.start()
    }
    await this.runSweep()
    this.pollTimer = setInterval(() => {
      void this.runSweep().catch((err) =>
        this.logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'claude-scout sweep failed',
        ),
      )
    }, this.opts.config.poll_interval_ms)
    if (typeof this.pollTimer.unref === 'function') this.pollTimer.unref()

    if (!this.opts.disableAdminServer && (this.opts.adminPort ?? 9478) > 0) {
      this.adminServer = new AdminServer({
        logger: this.logger.child({ component: 'claude-scout-admin' }),
        bind: this.opts.adminBind ?? '127.0.0.1',
        port: this.opts.adminPort ?? 9478,
        getStatus: () => this.status(),
        getReadiness: () => this.readiness(),
      })
      await this.adminServer.start()
    }
    this.logger.info(
      {
        scout_id: this.scoutId,
        accounts: this.accountResolver.all().map((a) => a.name),
        endpoint: this.opts.ttpEndpoint ?? null,
      },
      'claude-scout started',
    )
  }

  async shutdown(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    await this.collector.shutdown()
    if (this.persistentSink) await this.persistentSink.stop()
    if (this.adminServer) await this.adminServer.stop()
    this.logger.info('claude-scout shutdown complete')
  }

  /** One-shot sweep (new lines since last offset). */
  async runSweep(): Promise<ScanResult> {
    return this.scanner.sweep(this.sinkFn())
  }

  /** Backfill all transcripts from the beginning. */
  async backfill(): Promise<ScanResult> {
    return this.scanner.fullScan(this.sinkFn())
  }

  status(): StatusReport {
    const uptime_s = Math.floor((Date.now() - this.startedAt) / 1000)
    const walFiles = scoutMetrics.walFiles.values.get('') ?? 0
    const walBytes = scoutMetrics.walBytes.values.get('') ?? 0
    const lastShip = scoutMetrics.lastShipTimestamp.values.get('') ?? null
    return {
      scout_id: this.scoutId,
      fingerprint: sha256Hex(this.scoutId).slice(0, 12),
      deployment: this.opts.ttpEndpoint ? 'node' : 'solo',
      endpoint: this.opts.ttpEndpoint ?? null,
      residency: this.opts.dataResidency ?? 'AE',
      retention_days: this.opts.retentionDays ?? 90,
      regulation_tags: ['UAE_AI_LAW', 'GDPR'],
      connectors: ['claude_code'],
      version: CLAUDE_SCOUT_VERSION,
      uptime_s,
      wal: { files: walFiles, bytes: walBytes },
      last_ship_timestamp_s: typeof lastShip === 'number' ? lastShip : null,
      node_reachable: (scoutMetrics.nodeReachable.values.get('') ?? 0) === 1,
    }
  }

  readiness(): ReadinessReport {
    const lastShipS = scoutMetrics.lastShipTimestamp.values.get('')
    const lastShipMs = typeof lastShipS === 'number' ? lastShipS * 1000 : null
    const nodeReachable = (scoutMetrics.nodeReachable.values.get('') ?? 0) === 1
    return computeReadiness({
      fetchInstalled: true,
      deployment: this.opts.ttpEndpoint ? 'node' : 'solo',
      nodeReachable,
      lastShipMs,
      flushIntervalMs: 10_000,
    })
  }

  private sinkFn(): TranscriptSink {
    return async (event) => {
      await this.recordTranscriptEvent(event)
    }
  }

  private async recordTranscriptEvent(event: TranscriptMessageEvent): Promise<void> {
    const session = await this.sessionIndex.lookup(event.sessionId)
    const account = this.accountResolver.resolve(session?.cwd)
    const total = totalTokens(event)
    counterInc(scoutMetrics.eventsRecorded, { provider: CLAUDE_CODE_PROVIDER })
    const ttpEvent: TTPEvent = this.collector.record(
      {
        timestamp: event.timestamp ?? session?.startedAt ?? Date.now(),
        provider: CLAUDE_CODE_PROVIDER,
        endpoint: '/v1/messages',
        model_hint: event.model,
        direction: 'response',
        payload_bytes: 0,
        status_code: 200,
        session_hash: sha256Hex(event.sessionId).slice(0, 32),
      },
      {
        estimated_tokens: total,
        token_breakdown: {
          prompt_tokens: event.inputTokens,
          completion_tokens: event.outputTokens,
          cached_tokens: event.cacheReadTokens + event.cacheCreationTokens,
          ...(event.reasoningTokens > 0 && { reasoning_tokens: event.reasoningTokens }),
        },
        ...(account.dept_tag && { dept_tag: account.dept_tag }),
        ...(account.project_tag && { project_tag: account.project_tag }),
        ...(account.env_tag && { env_tag: account.env_tag }),
        use_case_tag: `claude_code:${account.account_id}`,
      },
    )
    gaugeSet(scoutMetrics.queueDepth, this.collector.pendingCount())
    void ttpEvent
  }
}
