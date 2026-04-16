import { describe, expect, it } from 'vitest'
import { TTPCollector, InMemorySink } from '@hive/connector'
import { defaultUAEGovernance } from '@hive/shared'
import { OpenAIConnector } from './connector.js'

function mockFetchResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  const h = new Headers({
    'content-length': String(new TextEncoder().encode(body).byteLength),
    ...headers,
  })
  return new Response(body, { status, headers: h })
}

describe('OpenAIConnector', () => {
  it('records request + response events around api.openai.com calls', async () => {
    const sink = new InMemorySink()
    const collector = new TTPCollector({
      sink,
      governance: defaultUAEGovernance(),
      deployment: 'solo',
      emitterId: 'test-scout',
      flushIntervalMs: 0,
    })
    const connector = new OpenAIConnector({ collector })

    const mockFetch = async () =>
      mockFetchResponse('{"choices":[{}]}', 200, { 'openai-model': 'gpt-4o-2024-08-06' })

    const wrappedFetch = connector.wrap(mockFetch as unknown as typeof fetch)
    await wrappedFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    await collector.flush()

    const events = sink.events
    expect(events.length).toBe(2)
    expect(events[0]?.direction).toBe('request')
    expect(events[1]?.direction).toBe('response')
    expect(events[1]?.model_hint).toBe('gpt-4o-2024-08-06')
    expect(events[1]?.status_code).toBe(200)
  })

  it('passes through calls to non-openai hosts untouched', async () => {
    const sink = new InMemorySink()
    const collector = new TTPCollector({
      sink,
      governance: defaultUAEGovernance(),
      deployment: 'solo',
      emitterId: 'test-scout',
      flushIntervalMs: 0,
    })
    const connector = new OpenAIConnector({ collector })
    const mockFetch = async () => mockFetchResponse('{}', 200)
    const wrapped = connector.wrap(mockFetch as unknown as typeof fetch)
    await wrapped('https://example.com/other', { method: 'GET' })
    await collector.flush()
    expect(sink.events).toHaveLength(0)
  })

  it('records error direction when upstream throws', async () => {
    const sink = new InMemorySink()
    const collector = new TTPCollector({
      sink,
      governance: defaultUAEGovernance(),
      deployment: 'solo',
      emitterId: 'test-scout',
      flushIntervalMs: 0,
    })
    const connector = new OpenAIConnector({ collector })
    const mockFetch = async () => {
      throw new Error('boom')
    }
    const wrapped = connector.wrap(mockFetch as unknown as typeof fetch)
    await expect(
      wrapped('https://api.openai.com/v1/chat/completions', { method: 'POST', body: 'x' }),
    ).rejects.toThrow('boom')
    await collector.flush()
    const events = sink.events
    expect(events.some((e) => e.direction === 'error')).toBe(true)
  })
})
