import type { HATPEvent } from '@hive/shared'

/**
 * Storage interface for HATPEvents. Phase 1 ships with an in-memory
 * store; Phase 2 replaces it with TimescaleDB via Drizzle ORM.
 */
export interface EventStore {
  insert(events: HATPEvent[]): Promise<void>
  count(): Promise<number>
  /** Return up to `limit` most recent events, newest first. */
  recent(limit: number): Promise<HATPEvent[]>
  /** Rollup aggregation — grouped by provider + dept_tag. */
  aggregate(): Promise<AggregateRow[]>
}

export interface AggregateRow {
  provider: string
  dept_tag: string | null
  call_count: number
  total_tokens: number
  total_bytes: number
  avg_latency_ms: number | null
}

export class InMemoryEventStore implements EventStore {
  private readonly events: HATPEvent[] = []

  async insert(events: HATPEvent[]): Promise<void> {
    this.events.push(...events)
  }

  async count(): Promise<number> {
    return this.events.length
  }

  async recent(limit: number): Promise<HATPEvent[]> {
    return this.events.slice(-Math.max(0, limit)).reverse()
  }

  async aggregate(): Promise<AggregateRow[]> {
    const buckets = new Map<string, AggregateRow>()
    for (const ev of this.events) {
      const dept = ev.dept_tag ?? null
      const key = `${ev.provider}|${dept ?? ''}`
      const row =
        buckets.get(key) ??
        {
          provider: ev.provider,
          dept_tag: dept,
          call_count: 0,
          total_tokens: 0,
          total_bytes: 0,
          avg_latency_ms: null,
        }
      row.call_count += 1
      row.total_tokens += ev.estimated_tokens
      row.total_bytes += ev.payload_bytes
      if (ev.latency_ms !== undefined) {
        row.avg_latency_ms =
          row.avg_latency_ms === null
            ? ev.latency_ms
            : (row.avg_latency_ms * (row.call_count - 1) + ev.latency_ms) / row.call_count
      }
      buckets.set(key, row)
    }
    return [...buckets.values()]
  }
}
