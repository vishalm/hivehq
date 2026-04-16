import { describe, expect, it } from 'vitest'
import { HATPCollector } from './collector.js'
import { InMemorySink } from './sinks.js'
import { defaultUAEGovernance } from '@hive/shared'

function buildCollector() {
  const sink = new InMemorySink()
  const collector = new HATPCollector({
    sink,
    governance: defaultUAEGovernance(),
    deployment: 'solo',
    emitterId: 'test-scout-abc',
    flushIntervalMs: 0,
  })
  return { sink, collector }
}

describe('HATPCollector', () => {
  it('records events and flushes to sink', async () => {
    const { sink, collector } = buildCollector()
    collector.record({
      timestamp: Date.now(),
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      model_hint: 'gpt-4o',
      direction: 'response',
      payload_bytes: 1024,
      latency_ms: 120,
      status_code: 200,
      session_hash: 'abc123',
    })
    await collector.flush()
    expect(sink.events).toHaveLength(1)
    expect(sink.events[0]?.provider).toBe('openai')
    expect(sink.events[0]?.governance.pii_asserted).toBe(false)
  })

  it('auto-flushes when maxBatchSize is hit', async () => {
    const sink = new InMemorySink()
    const collector = new HATPCollector({
      sink,
      governance: defaultUAEGovernance(),
      deployment: 'solo',
      emitterId: 'test-scout',
      flushIntervalMs: 0,
      maxBatchSize: 2,
    })
    for (let i = 0; i < 2; i++) {
      collector.record({
        timestamp: Date.now(),
        provider: 'anthropic',
        endpoint: '/v1/messages',
        model_hint: 'claude-3-5-sonnet',
        direction: 'response',
        payload_bytes: 512,
        status_code: 200,
        session_hash: `s-${i}`,
      })
    }
    // Give the microtask queue a turn.
    await new Promise((r) => setImmediate(r))
    expect(sink.events.length).toBe(2)
  })
})
