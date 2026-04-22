import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CollectorSink } from '@hive/connector'
import type { TTPEvent } from '@hive/shared'
import { createLogger } from './logger.js'
import { _resetForTest, scoutMetrics } from './metrics.js'
import { PersistentSink } from './persistent-sink.js'

function makeEvent(overrides: Partial<TTPEvent> = {}): TTPEvent {
  return {
    TTP_version: '0.1' as TTPEvent['TTP_version'],
    event_id: Math.random().toString(36).slice(2),
    schema_hash: 'x',
    timestamp: Date.now(),
    observed_at: Date.now(),
    emitter_id: 'scout-test',
    emitter_type: 'scout',
    session_hash: 'sess',
    provider: 'openai',
    endpoint: '/v1/chat/completions',
    model_hint: 'gpt-4o',
    direction: 'request',
    payload_bytes: 100,
    status_code: 200,
    estimated_tokens: 25,
    deployment: 'node',
    governance: {
      pii_asserted: false,
      content_asserted: false,
      data_residency: 'AE',
      retention_days: 90,
      regulation_tags: ['UAE_AI_LAW'],
    },
    ...overrides,
  } as TTPEvent
}

class FlakyUpstream implements CollectorSink {
  shipped: TTPEvent[][] = []
  constructor(private failUntil = 0) {}
  get attempts(): number {
    return this._attempts
  }
  private _attempts = 0
  async emit(events: TTPEvent[]): Promise<void> {
    this._attempts += 1
    if (this._attempts <= this.failUntil) {
      throw new Error(`transient failure ${this._attempts}`)
    }
    this.shipped.push(events)
  }
}

describe('PersistentSink', () => {
  const silentLogger = createLogger({ component: 'test', level: 'fatal' })
  let dir: string

  beforeEach(async () => {
    _resetForTest()
    dir = await mkdtemp(join(tmpdir(), 'scout-wal-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('ships batches on the happy path and cleans up the WAL', async () => {
    const upstream = new FlakyUpstream()
    const sink = new PersistentSink({ upstream, dir, logger: silentLogger })
    await sink.init()
    await sink.emit([makeEvent(), makeEvent()])
    expect(upstream.shipped).toHaveLength(1)
    expect(upstream.shipped[0]).toHaveLength(2)
    const files = await readdir(dir)
    expect(files.filter((f) => f.endsWith('.ndjson'))).toHaveLength(0)
    expect(scoutMetrics.eventsShipped.values.get('')).toBe(2)
  })

  it('retains batches on upstream failure and replays them on demand', async () => {
    const upstream = new FlakyUpstream(2)
    const sink = new PersistentSink({ upstream, dir, logger: silentLogger })
    await sink.init()

    await sink.emit([makeEvent(), makeEvent()])
    expect(upstream.shipped).toHaveLength(0)

    let files = (await readdir(dir)).filter((f) => f.endsWith('.ndjson'))
    expect(files).toHaveLength(1)

    await sink.replayAll()
    files = (await readdir(dir)).filter((f) => f.endsWith('.ndjson'))
    expect(files).toHaveLength(1)

    await sink.replayAll()
    files = (await readdir(dir)).filter((f) => f.endsWith('.ndjson'))
    expect(files).toHaveLength(0)
    expect(upstream.shipped).toHaveLength(1)
  })

  it('replays pending batches discovered at startup', async () => {
    const upstream1 = new FlakyUpstream(99)
    const sink1 = new PersistentSink({ upstream: upstream1, dir, logger: silentLogger })
    await sink1.init()
    await sink1.emit([makeEvent()])
    const pending = (await readdir(dir)).filter((f) => f.endsWith('.ndjson'))
    expect(pending).toHaveLength(1)

    const upstream2 = new FlakyUpstream(0)
    const sink2 = new PersistentSink({ upstream: upstream2, dir, logger: silentLogger })
    await sink2.init()
    await sink2.replayAll()
    expect(upstream2.shipped).toHaveLength(1)
    const post = (await readdir(dir)).filter((f) => f.endsWith('.ndjson'))
    expect(post).toHaveLength(0)
  })

  it('evicts oldest batches when over maxBytes', async () => {
    const upstream = new FlakyUpstream(99)
    const sink = new PersistentSink({
      upstream,
      dir,
      maxBytes: 1024,
      logger: silentLogger,
    })
    await sink.init()
    const bigEvent = () => makeEvent({ payload_bytes: 9_999 })

    for (let i = 0; i < 6; i++) {
      await sink.emit([bigEvent(), bigEvent(), bigEvent()])
    }
    const files = (await readdir(dir)).filter((f) => f.endsWith('.ndjson'))
    expect(files.length).toBeLessThanOrEqual(2)
    expect(scoutMetrics.eventsDropped.values.get('reason="wal_full"') ?? 0).toBeGreaterThan(0)
  })

  it('stop() drains pending batches', async () => {
    const upstream = new FlakyUpstream(1)
    const sink = new PersistentSink({ upstream, dir, logger: silentLogger })
    await sink.init()
    await sink.emit([makeEvent()])
    expect(upstream.shipped).toHaveLength(0)

    await sink.stop()
    expect(upstream.shipped).toHaveLength(1)
  })
})
