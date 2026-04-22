import { hostname } from 'node:os'
import {
  TTPCollector,
  HttpSink,
  InMemorySink,
  type CollectorSink,
} from '@hive/connector'
import { AnthropicConnector } from '@hive/connector-anthropic'
import { OllamaConnector } from '@hive/connector-ollama'
import { OpenAIConnector } from '@hive/connector-openai'
import {
  type TTPEvent,
  type GovernanceBlock,
  type RegulationTag,
  defaultUAEGovernance,
  deriveScoutId,
  sha256Hex,
} from '@hive/shared'
import type { ScoutEnv } from './env.js'
import { createLogger, type Logger } from './logger.js'
import { PersistentSink } from './persistent-sink.js'
import {
  AdminServer,
  computeReadiness,
  isNodeReachable,
  lastShipMs,
  type ReadinessReport,
  type StatusReport,
} from './admin-server.js'
import { counterInc, gaugeSet, scoutMetrics, setInfo } from './metrics.js'

const SCOUT_VERSION = '0.1.0'

export interface ScoutConfig {
  env: ScoutEnv
  /** Override the sink (useful for tests and local-only mode). */
  sinkOverride?: CollectorSink
  /** Fetch implementation for HTTP sink (useful for tests). */
  fetchImpl?: typeof fetch
  /** Inject a logger (otherwise one is created from env). */
  logger?: Logger
  /** Skip starting the admin server (tests, library mode). */
  disableAdminServer?: boolean
  /** Skip WAL even in node/federated mode (tests). */
  disablePersistence?: boolean
}

/**
 * The Scout — wires together the collector, connectors, and transport.
 *
 * In Solo mode, events stay in an in-memory sink so the local dashboard
 * can display them. In Node/Federated/Open modes, events flush through a
 * write-ahead log to the configured TTP endpoint.
 */
export class Scout {
  readonly collector: TTPCollector
  readonly openai?: OpenAIConnector
  readonly anthropic?: AnthropicConnector
  readonly ollama?: OllamaConnector
  readonly localSink?: InMemorySink
  readonly persistentSink?: PersistentSink
  readonly logger: Logger

  private readonly scoutId: string
  private adminServer: AdminServer | null = null
  private fetchInstalled = false
  private readonly startedAt = Date.now()

  readonly config: ScoutConfig

  constructor(config: ScoutConfig) {
    this.config = config
    const { env } = config

    const fingerprint = env.HIVE_DEVICE_FINGERPRINT ?? hostname()
    this.scoutId = deriveScoutId(fingerprint, 'hive-scout-salt-v1')
    this.logger =
      config.logger ??
      createLogger({
        component: 'scout',
        level: env.HIVE_LOG_LEVEL,
        scoutId: this.scoutId,
      })

    setInfo({
      version: SCOUT_VERSION,
      deployment: env.HIVE_DEPLOYMENT,
      residency: env.HIVE_DATA_RESIDENCY,
      scout_id: this.scoutId,
    })

    const governance: GovernanceBlock = {
      ...defaultUAEGovernance(),
      data_residency: env.HIVE_DATA_RESIDENCY,
      retention_days: env.HIVE_RETENTION_DAYS,
      regulation_tags: env.regulationTags as RegulationTag[],
    }

    let sink: CollectorSink
    if (config.sinkOverride) {
      sink = config.sinkOverride
    } else if (env.HIVE_DEPLOYMENT === 'solo' || !env.TTP_ENDPOINT) {
      const memSink = new InMemorySink()
      this.localSink = memSink
      sink = memSink
    } else {
      const httpSink = new HttpSink({
        endpoint: env.TTP_ENDPOINT,
        ...(env.TTP_TOKEN && { token: env.TTP_TOKEN }),
        ...(config.fetchImpl && { fetchImpl: config.fetchImpl }),
      })
      if (config.disablePersistence) {
        sink = httpSink
      } else {
        this.persistentSink = new PersistentSink({
          upstream: httpSink,
          dir: env.HIVE_WAL_DIR,
          maxBytes: env.HIVE_WAL_MAX_BYTES,
          replayIntervalMs: env.HIVE_REPLAY_INTERVAL_MS,
          logger: this.logger.child({ component: 'scout-wal' }),
        })
        sink = this.persistentSink
      }
    }

    this.collector = new TTPCollector({
      sink,
      governance,
      deployment: env.HIVE_DEPLOYMENT,
      emitterId: this.scoutId,
      emitterType: 'scout',
      flushIntervalMs: env.HIVE_FLUSH_INTERVAL_MS,
      ...(env.HIVE_DEPT_TAG && { deptTag: env.HIVE_DEPT_TAG }),
      ...(env.HIVE_PROJECT_TAG && { projectTag: env.HIVE_PROJECT_TAG }),
      ...(env.HIVE_NODE_REGION && { nodeRegion: env.HIVE_NODE_REGION }),
    })

    const enabled = new Set(env.enabledConnectors ?? ['anthropic', 'openai', 'ollama'])
    const recordingCollector = this.wrapCollectorForMetrics(this.collector)

    if (enabled.has('openai')) {
      this.openai = new OpenAIConnector({ collector: recordingCollector })
    }
    if (enabled.has('anthropic') || enabled.has('claude')) {
      this.anthropic = new AnthropicConnector({ collector: recordingCollector })
    }
    if (enabled.has('ollama')) {
      this.ollama = new OllamaConnector({
        collector: recordingCollector,
        ...(env.HIVE_OLLAMA_HOST && { hosts: [env.HIVE_OLLAMA_HOST] }),
      })
    }
  }

  /**
   * Initialize async resources: open WAL, replay any leftover batches, start
   * replay loop, start admin server. Call before installGlobalFetch().
   */
  async start(): Promise<void> {
    if (this.persistentSink) {
      await this.persistentSink.init()
      await this.persistentSink.replayAll()
      this.persistentSink.start()
    }
    if (!this.config.disableAdminServer && this.config.env.HIVE_ADMIN_PORT > 0) {
      this.adminServer = new AdminServer({
        logger: this.logger.child({ component: 'scout-admin' }),
        bind: this.config.env.HIVE_ADMIN_BIND,
        port: this.config.env.HIVE_ADMIN_PORT,
        getStatus: () => this.status(),
        getReadiness: () => this.readiness(),
      })
      await this.adminServer.start()
    }
    this.logger.info(
      {
        scout_id: this.scoutId,
        deployment: this.config.env.HIVE_DEPLOYMENT,
        endpoint: this.config.env.TTP_ENDPOINT ?? null,
        admin_port: this.adminServer ? this.config.env.HIVE_ADMIN_PORT : null,
        wal_dir: this.persistentSink ? this.config.env.HIVE_WAL_DIR : null,
      },
      'scout started',
    )
  }

  /**
   * Install the Scout globally — hijacks globalThis.fetch so any module
   * that calls fetch() to a known provider emits telemetry automatically.
   */
  installGlobalFetch(): void {
    let wrapped = globalThis.fetch
    if (this.openai) wrapped = this.openai.wrap(wrapped)
    if (this.anthropic) wrapped = this.anthropic.wrap(wrapped)
    if (this.ollama) wrapped = this.ollama.wrap(wrapped)
    globalThis.fetch = wrapped
    this.fetchInstalled = true
  }

  /** The rotating scout_id used by this instance (hashed, monthly). */
  get id(): string {
    return this.scoutId
  }

  /** Fingerprint of the Scout's identity for diagnostics (hashed). */
  get identityFingerprint(): string {
    return sha256Hex(this.scoutId).slice(0, 12)
  }

  /** Stop timers, drain pending events, close admin server. */
  async shutdown(): Promise<void> {
    this.logger.info('scout shutting down')
    await this.collector.shutdown()
    if (this.persistentSink) await this.persistentSink.stop()
    if (this.adminServer) await this.adminServer.stop()
    this.logger.info('scout shutdown complete')
  }

  /** Snapshot of local events in solo mode (for the personal dashboard). */
  localEvents(): TTPEvent[] {
    return this.localSink ? [...this.localSink.events] : []
  }

  status(): StatusReport {
    const uptime_s = Math.floor((Date.now() - this.startedAt) / 1000)
    const walFiles = scoutMetrics.walFiles.values.get('') ?? 0
    const walBytes = scoutMetrics.walBytes.values.get('') ?? 0
    const lastShip = scoutMetrics.lastShipTimestamp.values.get('') ?? null
    return {
      scout_id: this.scoutId,
      fingerprint: this.identityFingerprint,
      deployment: this.config.env.HIVE_DEPLOYMENT,
      endpoint: this.config.env.TTP_ENDPOINT ?? null,
      residency: this.config.env.HIVE_DATA_RESIDENCY,
      retention_days: this.config.env.HIVE_RETENTION_DAYS,
      regulation_tags: this.config.env.regulationTags,
      connectors: this.config.env.enabledConnectors,
      version: SCOUT_VERSION,
      uptime_s,
      wal: { files: walFiles, bytes: walBytes },
      last_ship_timestamp_s: lastShip,
      node_reachable: isNodeReachable(),
    }
  }

  readiness(): ReadinessReport {
    return computeReadiness({
      fetchInstalled: this.fetchInstalled,
      deployment: this.config.env.HIVE_DEPLOYMENT,
      nodeReachable: isNodeReachable(),
      lastShipMs: lastShipMs(),
      flushIntervalMs: this.config.env.HIVE_FLUSH_INTERVAL_MS,
    })
  }

  private wrapCollectorForMetrics(c: TTPCollector): TTPCollector {
    const origRecord = c.record.bind(c)
    c.record = ((event, overrides) => {
      const ttp = origRecord(event, overrides)
      counterInc(scoutMetrics.eventsRecorded, { provider: event.provider })
      gaugeSet(scoutMetrics.queueDepth, c.pendingCount())
      return ttp
    }) as typeof c.record
    return c
  }
}
