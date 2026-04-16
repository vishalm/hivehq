import { describe, expect, it, vi } from 'vitest'
import { TTPCollector, InMemorySink } from '@hive/connector'
import { defaultUAEGovernance } from '@hive/shared'
import { AnthropicConnector } from './connector.js'

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

describe('AnthropicConnector', () => {
  it('intercepts calls to api.anthropic.com', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"content":[{"type":"text","text":"hello"}]}', {
        status: 200,
        headers: {
          'content-length': '46',
          'anthropic-model': 'claude-3-opus-20250219',
        },
      }),
    )

    const wrapped = connector.wrap(mockFetch)
    const body = JSON.stringify({
      model: 'claude-3-opus-20250219',
      messages: [{ role: 'user', content: 'hello' }],
    })

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body,
    })

    await collector.flush()
    expect(sink.events.length).toBe(2)
    expect(sink.events[0]?.provider).toBe('anthropic')
    expect(sink.events[0]?.direction).toBe('request')
    expect(sink.events[1]?.direction).toBe('response')
    expect(sink.events[1]?.model_hint).toBe('claude-3-opus-20250219')
    expect(sink.events[1]?.status_code).toBe(200)
  })

  it('ignores non-Anthropic URLs', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/chat/completions', { method: 'POST', body: '{}' })

    await collector.flush()
    expect(sink.events.length).toBe(0)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('extracts model from anthropic-model header', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'anthropic-model': 'claude-3-sonnet-20250229' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[1]?.model_hint).toBe('claude-3-sonnet-20250229')
  })

  it('uses default model hint when header not present', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({
      collector,
      defaultModelHint: 'claude-3-haiku',
    })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-length': '2' } }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[1]?.model_hint).toBe('claude-3-haiku')
  })

  it('records error event on fetch failure', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('connection refused'))
    const wrapped = connector.wrap(mockFetch)

    await expect(
      wrapped('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        body: '{}',
      }),
    ).rejects.toThrow('connection refused')

    await collector.flush()
    expect(sink.events.length).toBe(2)
    expect(sink.events[1]?.direction).toBe('error')
  })

  it('preserves session hash across request/response pair', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    const reqSessionHash = sink.events[0]?.session_hash
    const resSessionHash = sink.events[1]?.session_hash
    expect(reqSessionHash).toBe(resSessionHash)
  })

  it('includes use_case_tag when provided in options', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-length': '2' } }),
    )

    const wrapped = connector.wrap(mockFetch, { useCaseTag: 'content-generation' })

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[1]?.use_case_tag).toBe('content-generation')
  })

  it('allows emit() for manual events', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    connector.emit({
      timestamp: Date.now(),
      provider: 'anthropic',
      endpoint: '/v1/messages',
      model_hint: 'claude-3-opus',
      direction: 'request',
      payload_bytes: 512,
      status_code: 0,
      session_hash: 'session-abc',
    })

    await collector.flush()
    expect(sink.events.length).toBe(1)
  })

  it('handles missing content-length header', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'anthropic-model': 'claude-3-opus' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[1]?.payload_bytes).toBe(0)
  })

  it('extracts endpoint path correctly', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-length': '2' } }),
    )

    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[0]?.endpoint).toBe('/v1/messages')
    expect(sink.events[1]?.endpoint).toBe('/v1/messages')
  })

  it('handles model_hint override in options', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new AnthropicConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-length': '2' } }),
    )

    const wrapped = connector.wrap(mockFetch, { modelHint: 'claude-custom' })

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await collector.flush()
    expect(sink.events[0]?.model_hint).toBe('claude-custom')
    expect(sink.events[1]?.model_hint).toBe('claude-custom')
  })
})
