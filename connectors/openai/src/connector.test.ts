import { describe, expect, it, vi } from 'vitest'
import { TTPCollector, InMemorySink } from '@hive/connector'
import { defaultUAEGovernance } from '@hive/shared'
import { OpenAIConnector } from './connector.js'

function makeSink() {
  return new InMemorySink()
}

function makeCollector(sink: InMemorySink) {
  return new TTPCollector({
    sink,
    governance: defaultUAEGovernance(),
    deployment: 'solo',
    emitterId: 'test-scout',
    emitterType: 'scout',
    flushIntervalMs: 0,
  })
}

describe('OpenAIConnector', () => {
  it('intercepts calls to api.openai.com', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"choices":[{"message":{"content":"hello"}}]}', {
        status: 200,
        headers: {
          'content-length': '48',
          'openai-model': 'gpt-4o',
        },
      }),
    )

    const wrapped = connector.wrap(mockFetch)
    const body = JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
    })

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body,
    })

    await collector.flush()
    expect(sink.events.length).toBe(2)
    expect(sink.events[0]?.provider).toBe('openai')
    expect(sink.events[0]?.direction).toBe('request')
    expect(sink.events[1]?.direction).toBe('response')
    expect(sink.events[1]?.model_hint).toBe('gpt-4o')
    expect(sink.events[1]?.status_code).toBe(200)
    expect(sink.events[1]?.latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('ignores non-OpenAI URLs', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{}' })

    await collector.flush()
    expect(sink.events.length).toBe(0)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('extracts model from openai-model header', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'openai-model': 'gpt-4-turbo' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{"model":"gpt-4o"}',
    })

    await collector.flush()
    expect(sink.events[1]?.model_hint).toBe('gpt-4-turbo')
  })

  it('uses default model hint when header not present', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({
      collector,
      defaultModelHint: 'gpt-3.5-turbo',
    })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-length': '2' } }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[1]?.model_hint).toBe('gpt-3.5-turbo')
  })

  it('records error event on fetch failure', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('network error'))
    const wrapped = connector.wrap(mockFetch)

    await expect(
      wrapped('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        body: '{"model":"gpt-4o"}',
      }),
    ).rejects.toThrow('network error')

    await collector.flush()
    expect(sink.events.length).toBe(2)
    expect(sink.events[1]?.direction).toBe('error')
    expect(sink.events[1]?.status_code).toBe(0)
  })

  it('handles Azure OpenAI URLs', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'openai-model': 'gpt-4' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://myorg.openai.azure.com/openai/deployments/gpt-4/chat/completions', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events.length).toBe(2)
    expect(sink.events[0]?.provider).toBe('openai')
  })

  it('extracts endpoint correctly', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[0]?.endpoint).toBe('/v1/embeddings')
    expect(sink.events[1]?.endpoint).toBe('/v1/embeddings')
  })

  it('includes use_case_tag when provided in options', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2' },
      }),
    )

    const wrapped = connector.wrap(mockFetch, { useCaseTag: 'customer-support' })

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[1]?.use_case_tag).toBe('customer-support')
  })

  it('includes model_hint override when provided', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2' },
      }),
    )

    const wrapped = connector.wrap(mockFetch, { modelHint: 'gpt-4o-override' })

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[0]?.model_hint).toBe('gpt-4o-override')
    expect(sink.events[1]?.model_hint).toBe('gpt-4o-override')
  })

  it('handles streaming responses', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('data: [DONE]', {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'content-length': '13',
        },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{"stream":true}',
    })

    await collector.flush()
    expect(sink.events.length).toBe(2)
    expect(sink.events[1]?.status_code).toBe(200)
  })

  it('handles missing content-length header', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'openai-model': 'gpt-4o' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[1]?.payload_bytes).toBe(0)
  })

  it('allows emit() for manual events', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    connector.emit({
      timestamp: Date.now(),
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      model_hint: 'gpt-4o',
      direction: 'request',
      payload_bytes: 512,
      status_code: 0,
      session_hash: 'session-123',
    })

    await collector.flush()
    expect(sink.events.length).toBe(1)
  })

  it('preserves session hash across request/response pair', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OpenAIConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    const reqSessionHash = sink.events[0]?.session_hash
    const resSessionHash = sink.events[1]?.session_hash
    expect(reqSessionHash).toBe(resSessionHash)
  })
})

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
