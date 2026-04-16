import { hostname } from 'node:os'
import {
  HATPCollector,
  HttpSink,
  InMemorySink,
  type CollectorSink,
} from '@hive/connector'
import { AnthropicConnector } from '@hive/connector-anthropic'
import { OpenAIConnector } from '@hive/connector-openai'
import {
  type HATPEvent,
  type GovernanceBlock,
  type RegulationTag,
  defaultUAEGovernance,
  deriveScoutId,
  sha256Hex,
} from '@hive/shared'
import type { ScoutEnv } from './env.js'

export interface ScoutConfig {
  env: ScoutEnv
  /** Override the sink (useful for tests and local-only mode). */
  sinkOverride?: CollectorSink
  /** Fetch implementation for HTTP sink (useful for tests). */
  fetchImpl?: typeof fetch
}

/**
 * The Scout — wires together the collector, connectors, and transport.
 *
 * In Solo mode, events stay in an in-memory sink so the local dashboard
 * can display them. In Node/Federated/Open modes, events flush over HTTP
 * to the configured HATP endpoint.
 */
export class Scout {
  readonly collector: HATPCollector
  readonly openai: OpenAIConnector
  readonly anthropic: AnthropicConnector
  readonly localSink?: InMemorySink

  private readonly scoutId: string

  readonly config: ScoutConfig

  constructor(config: ScoutConfig) {
    this.config = config
    const { env } = config

    // Derive a rotating scout_id from device fingerprint + salt.
    // If no fingerprint is provided, fall back to hostname.
    const fingerprint = env.HIVE_DEVICE_FINGERPRINT ?? hostname()
    this.scoutId = deriveScoutId(fingerprint, 'hive-scout-salt-v1')

    const governance: GovernanceBlock = {
      ...defaultUAEGovernance(),
      data_residency: env.HIVE_DATA_RESIDENCY,
      retention_days: env.HIVE_RETENTION_DAYS,
      regulation_tags: env.regulationTags as RegulationTag[],
    }

    let sink: CollectorSink
    if (config.sinkOverride) {
      sink = config.sinkOverride
    } else if (env.HIVE_DEPLOYMENT === 'solo' || !env.HATP_ENDPOINT) {
      const memSink = new InMemorySink()
      this.localSink = memSink
      sink = memSink
    } else {
      sink = new HttpSink({
        endpoint: env.HATP_ENDPOINT,
        ...(env.HATP_TOKEN && { token: env.HATP_TOKEN }),
        ...(config.fetchImpl && { fetchImpl: config.fetchImpl }),
      })
    }

    this.collector = new HATPCollector({
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

    this.openai = new OpenAIConnector({ collector: this.collector })
    this.anthropic = new AnthropicConnector({ collector: this.collector })
  }

  /**
   * Install the Scout globally — hijacks globalThis.fetch so any module
   * that calls fetch() to a known provider emits telemetry automatically.
   */
  installGlobalFetch(): void {
    const original = globalThis.fetch
    // Chain openai and anthropic hooks — both no-op for non-matching hosts.
    let wrapped = this.openai.wrap(original)
    wrapped = this.anthropic.wrap(wrapped)
    globalThis.fetch = wrapped
  }

  /** The rotating scout_id used by this instance (hashed, monthly). */
  get id(): string {
    return this.scoutId
  }

  /** Fingerprint of the Scout's identity for diagnostics (hashed). */
  get identityFingerprint(): string {
    return sha256Hex(this.scoutId).slice(0, 12)
  }

  /** Stop timers and drain pending events. */
  async shutdown(): Promise<void> {
    await this.collector.shutdown()
  }

  /** Snapshot of local events in solo mode (for the personal dashboard). */
  localEvents(): HATPEvent[] {
    return this.localSink ? [...this.localSink.events] : []
  }
}
