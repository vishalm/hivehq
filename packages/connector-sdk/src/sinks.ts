import type { TTPEvent, TTPIngestResponse } from '@hive/shared'
import type { CollectorSink } from './collector.js'

export interface SinkResult {
  attempted: number
  succeeded: number
}

/** In-memory sink — for Solo-mode dashboards and tests. */
export class InMemorySink implements CollectorSink {
  readonly events: TTPEvent[] = []

  async emit(events: TTPEvent[]): Promise<void> {
    this.events.push(...events)
  }

  drain(): TTPEvent[] {
    return this.events.splice(0, this.events.length)
  }
}

/** Console sink — for local development. */
export class ConsoleSink implements CollectorSink {
  async emit(events: TTPEvent[]): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`[hive] emitting ${events.length} event(s)`)
  }
}

export interface HttpSinkOptions {
  endpoint: string
  token?: string
  /** Retry attempts on transient failure (429, 5xx, network). */
  maxRetries?: number
  /** Fetch implementation override (for tests). */
  fetchImpl?: typeof fetch
}

/**
 * HTTP sink — POSTs batches to a TTP-compatible ingest endpoint.
 * Implements exponential backoff for transient failures.
 */
export class HttpSink implements CollectorSink {
  constructor(private readonly opts: HttpSinkOptions) {}

  async emit(events: TTPEvent[]): Promise<void> {
    const fetchImpl = this.opts.fetchImpl ?? globalThis.fetch
    if (!fetchImpl) {
      throw new Error('No fetch implementation available. Provide opts.fetchImpl.')
    }
    const batch = {
      batch_id: crypto.randomUUID(),
      sent_at: Date.now(),
      events,
    }
    const maxRetries = this.opts.maxRetries ?? 3
    let lastErr: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetchImpl(this.opts.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-TTP-Version': '0.1',
            'X-TTP-Batch-ID': batch.batch_id,
            ...(this.opts.token && { Authorization: `Bearer ${this.opts.token}` }),
          },
          body: JSON.stringify(batch),
        })
        if (res.ok) {
          // Response shape is informational — caller may log rejections.
          const _body = (await res.json().catch(() => ({}))) as Partial<TTPIngestResponse>
          void _body
          return
        }
        if (res.status >= 500 || res.status === 429) {
          lastErr = new Error(`TTP ingest transient ${res.status}`)
        } else {
          throw new Error(`TTP ingest failed ${res.status}`)
        }
      } catch (err) {
        lastErr = err
      }
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt))
      }
    }
    throw lastErr ?? new Error('TTP ingest failed after retries')
  }
}

function backoffMs(attempt: number): number {
  return Math.min(30_000, 250 * 2 ** attempt) + Math.floor(Math.random() * 100)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
