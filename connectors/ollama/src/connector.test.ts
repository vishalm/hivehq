import { describe, expect, it, vi } from 'vitest'
import { TTPCollector, InMemorySink } from '@hive/connector'
import { defaultUAEGovernance } from '@hive/shared'
import { OllamaConnector } from './connector.js'

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

describe('OllamaConnector', () => {
  it('intercepts calls to localhost:11434/api/chat', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OllamaConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"model":"llama3.1","message":{"role":"assistant","content":"hi"}}', {
        status: 200,
        headers: { 'content-length': '68' },
      }),
    )

    const wrapped = connector.wrap(mockFetch)
    const body = JSON.stringify({ model: 'llama3.1', messages: [{ role: 'user', content: 'hello' }] })

    await wrapped('http://localhost:11434/api/chat', {
      method: 'POST',
      body,
    })

    await collector.flush()
    expect(sink.events.length).toBe(2) // request + response
    expect(sink.events[0].provider).toBe('ollama')
    expect(sink.events[0].model_hint).toBe('llama3.1')
    expect(sink.events[0].direction).toBe('request')
    expect(sink.events[1].direction).toBe('response')
    expect(sink.events[1].status_code).toBe(200)
    expect(sink.events[1].latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('ignores non-Ollama URLs', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OllamaConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
    const wrapped = connector.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/chat/completions', { method: 'POST', body: '{}' })

    await collector.flush()
    expect(sink.events.length).toBe(0)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('ignores non-tracked endpoints like /api/pull', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OllamaConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
    const wrapped = connector.wrap(mockFetch)

    await wrapped('http://localhost:11434/api/pull', { method: 'POST', body: '{"name":"llama3.1"}' })

    await collector.flush()
    expect(sink.events.length).toBe(0)
  })

  it('supports custom Ollama hosts', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OllamaConnector({
      collector,
      hosts: ['ollama.internal:11434'],
    })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-length': '2' } }),
    )
    const wrapped = connector.wrap(mockFetch)

    await wrapped('http://ollama.internal:11434/api/generate', {
      method: 'POST',
      body: '{"model":"codellama","prompt":"def hello"}',
    })

    await collector.flush()
    expect(sink.events.length).toBe(2)
    expect(sink.events[0].model_hint).toBe('codellama')
    expect(sink.events[0].endpoint).toBe('/api/generate')
  })

  it('records error events when fetch throws', async () => {
    const sink = makeSink()
    const collector = makeCollector(sink)
    const connector = new OllamaConnector({ collector })

    const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('connection refused'))
    const wrapped = connector.wrap(mockFetch)

    await expect(
      wrapped('http://localhost:11434/api/chat', {
        method: 'POST',
        body: '{"model":"llama3.1","messages":[]}',
      }),
    ).rejects.toThrow('connection refused')

    await collector.flush()
    expect(sink.events.length).toBe(2)
    expect(sink.events[1].direction).toBe('error')
  })
})
