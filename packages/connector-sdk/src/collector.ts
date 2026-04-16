/**
 * HATPCollector — the SDK entry point.
 *
 * Usage:
 *   const collector = new HATPCollector({ sink, governance, deployment })
 *   collector.record({ provider, endpoint, payload_bytes, ... })
 *   await collector.flush()
 */

import {
  type HATPEvent,
  type HiveConnectorEvent,
  HATP_SCHEMA_HASH,
  HATP_VERSION,
  type GovernanceBlock,
  newEventId,
} from '@hive/shared'

export interface CollectorSink {
  /** Persist or forward a batch of HATPEvents. Must not throw synchronously. */
  emit(events: HATPEvent[]): Promise<void>
}

export interface CollectorConfig {
  sink: CollectorSink
  governance: GovernanceBlock
  /** 'solo' | 'node' | 'federated' | 'open' */
  deployment: HATPEvent['deployment']
  /** Scout/SDK id — hashed, rotating. */
  emitterId: string
  emitterType?: HATPEvent['emitter_type']
  orgNodeId?: string
  /** Optional default classification. */
  deptTag?: string
  projectTag?: string
  envTag?: HATPEvent['env_tag']
  nodeRegion?: string
  /** Auto-flush cadence in ms. 0 disables the timer. */
  flushIntervalMs?: number
  /** Soft batch size. Flush early when exceeded. */
  maxBatchSize?: number
}

export class HATPCollector {
  private readonly queue: HATPEvent[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private flushing: Promise<void> | null = null

  constructor(private readonly config: CollectorConfig) {
    const interval = config.flushIntervalMs ?? 60_000
    if (interval > 0) {
      this.timer = setInterval(() => {
        void this.flush()
      }, interval)
      // In Node, let the process exit even if the timer is pending.
      if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) {
        ;(this.timer as { unref?: () => void }).unref?.()
      }
    }
  }

  /** Record a HiveConnectorEvent. The collector upgrades it to HATPEvent. */
  record(event: HiveConnectorEvent, overrides: Partial<HATPEvent> = {}): HATPEvent {
    const hatp: HATPEvent = {
      hatp_version: HATP_VERSION,
      event_id: newEventId(),
      schema_hash: HATP_SCHEMA_HASH,
      timestamp: event.timestamp,
      observed_at: Date.now(),
      emitter_id: this.config.emitterId,
      emitter_type: this.config.emitterType ?? 'sdk',
      session_hash: event.session_hash,
      provider: event.provider,
      endpoint: event.endpoint,
      model_hint: event.model_hint,
      direction: event.direction,
      payload_bytes: event.payload_bytes,
      status_code: event.status_code,
      estimated_tokens: 0, // caller should supply via overrides; we do not peek at content
      deployment: this.config.deployment,
      governance: this.config.governance,
      ...(event.latency_ms !== undefined && { latency_ms: event.latency_ms }),
      ...(event.ttfb_ms !== undefined && { ttfb_ms: event.ttfb_ms }),
      ...(this.config.orgNodeId && { org_node_id: this.config.orgNodeId }),
      ...(this.config.deptTag && { dept_tag: this.config.deptTag }),
      ...(this.config.projectTag && { project_tag: this.config.projectTag }),
      ...(this.config.envTag && { env_tag: this.config.envTag }),
      ...(this.config.nodeRegion && { node_region: this.config.nodeRegion }),
      ...overrides,
    }
    this.queue.push(hatp)
    if (this.queue.length >= (this.config.maxBatchSize ?? 500)) {
      void this.flush()
    }
    return hatp
  }

  /** Force a flush. Safe to call concurrently. */
  async flush(): Promise<void> {
    if (this.flushing) return this.flushing
    if (this.queue.length === 0) return
    const batch = this.queue.splice(0, this.queue.length)
    this.flushing = this.config.sink.emit(batch).finally(() => {
      this.flushing = null
    })
    return this.flushing
  }

  /** Stop the flush timer and drain remaining events. */
  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    await this.flush()
  }

  /** Testing / inspection hook. */
  pendingCount(): number {
    return this.queue.length
  }
}
