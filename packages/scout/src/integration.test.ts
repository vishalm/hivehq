import { describe, expect, it, vi } from 'vitest'
import { InMemorySink } from '@hive/connector'
import { Scout } from './scout.js'
import type { ScoutEnv } from './env.js'
import { createLogger } from './logger.js'

const silentLogger = createLogger({ component: 'test', level: 'fatal' })

function buildEnv(overrides: Partial<ScoutEnv> = {}): ScoutEnv {
  return {
    HIVE_DEPLOYMENT: 'solo',
    HIVE_DATA_RESIDENCY: 'AE',
    HIVE_RETENTION_DAYS: 90,
    HIVE_REGULATION_TAGS: 'UAE_AI_LAW,GDPR',
    HIVE_FLUSH_INTERVAL_MS: 0,
    regulationTags: ['UAE_AI_LAW', 'GDPR'],
    ...overrides,
  } as ScoutEnv
}

describe('Scout Integration', () => {
  it('initializes with solo mode and local sink', () => {
    const scout = new Scout({ env: buildEnv(), logger: silentLogger })

    expect(scout.localSink).toBeDefined()
    expect(scout.collector).toBeDefined()
    expect(scout.openai).toBeDefined()
    expect(scout.anthropic).toBeDefined()
    expect(scout.ollama).toBeDefined()
  })

  it('initializes OpenAI connector', () => {
    const scout = new Scout({ env: buildEnv(), logger: silentLogger })

    expect(scout.openai).toBeDefined()
  })

  it('initializes Anthropic connector', () => {
    const scout = new Scout({ env: buildEnv(), logger: silentLogger })

    expect(scout.anthropic).toBeDefined()
  })

  it('initializes Ollama connector', () => {
    const scout = new Scout({ env: buildEnv(), logger: silentLogger })

    expect(scout.ollama).toBeDefined()
  })

  it('wraps fetch for OpenAI calls', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: sink })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'openai-model': 'gpt-4o' },
      }),
    )

    const wrapped = scout.openai!.wrap(mockFetch)

    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })

    await scout.shutdown()
    expect(sink.events.length).toBe(2)
    expect(sink.events[0]?.provider).toBe('openai')
  })

  it('wraps fetch for Anthropic calls', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: sink })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'anthropic-model': 'claude-3-opus' },
      }),
    )

    const wrapped = scout.anthropic!.wrap(mockFetch)

    await wrapped('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await scout.shutdown()
    expect(sink.events.length).toBe(2)
    expect(sink.events[0]?.provider).toBe('anthropic')
  })

  it('wraps fetch for Ollama calls', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: sink })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"model":"llama3","message":{"content":"hi"}}', {
        status: 200,
        headers: { 'content-length': '46' },
      }),
    )

    const wrapped = scout.ollama!.wrap(mockFetch)

    await wrapped('http://localhost:11434/api/chat', {
      method: 'POST',
      body: '{"model":"llama3"}',
    })

    await scout.shutdown()
    expect(sink.events.length).toBe(2)
    expect(sink.events[0]?.provider).toBe('ollama')
  })

  it('passes through non-matching URLs', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: sink })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))

    const wrapped = scout.openai!.wrap(mockFetch)

    await wrapped('https://example.com/api', { method: 'GET' })

    await scout.shutdown()
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(sink.events.length).toBe(0)
  })

  it('chains multiple connectors', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: sink })

    const mockOpenAIFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'openai-model': 'gpt-4o' },
      }),
    )

    const mockAnthropicFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'anthropic-model': 'claude-3-opus' },
      }),
    )

    const wrappedOpenAI = scout.openai!.wrap(mockOpenAIFetch)
    const wrappedAnthropic = scout.anthropic!.wrap(mockAnthropicFetch)

    await wrappedOpenAI('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })

    await wrappedAnthropic('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: '{}',
    })

    await scout.shutdown()
    expect(sink.events.length).toBe(4)
    expect(sink.events.filter((e) => e.provider === 'openai').length).toBe(2)
    expect(sink.events.filter((e) => e.provider === 'anthropic').length).toBe(2)
  })

  it('flushes events to sink on shutdown', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: sink })

    scout.collector.record({
      timestamp: Date.now(),
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      model_hint: 'gpt-4o',
      direction: 'request',
      payload_bytes: 512,
      status_code: 0,
      session_hash: 'test-session',
    })

    expect(sink.events.length).toBe(0)

    await scout.shutdown()

    expect(sink.events.length).toBe(1)
  })

  it('respects custom sink override', async () => {
    const customSink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: customSink })

    scout.collector.record({
      timestamp: Date.now(),
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      model_hint: 'gpt-4o',
      direction: 'request',
      payload_bytes: 512,
      status_code: 0,
      session_hash: 'test-session',
    })

    await scout.shutdown()

    expect(customSink.events.length).toBe(1)
  })

  it('includes governance in all events', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: sink })

    scout.collector.record({
      timestamp: Date.now(),
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      model_hint: 'gpt-4o',
      direction: 'request',
      payload_bytes: 512,
      status_code: 0,
      session_hash: 'test-session',
    })

    await scout.shutdown()

    expect(sink.events[0]?.governance).toBeDefined()
    expect(sink.events[0]?.governance.pii_asserted).toBe(false)
    expect(sink.events[0]?.governance.content_asserted).toBe(false)
    expect(sink.events[0]?.governance.data_residency).toBe('AE')
  })

  it('respects HIVE_DEPLOYMENT configuration', () => {
    const scout = new Scout({ env: buildEnv({ HIVE_DEPLOYMENT: "node" }), logger: silentLogger })

    expect(scout.collector).toBeDefined()
  })

  it('respects data residency configuration', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({
      env: buildEnv({ HIVE_DATA_RESIDENCY: 'US' }),
      sinkOverride: sink,
    })

    scout.collector.record({
      timestamp: Date.now(),
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      model_hint: 'gpt-4o',
      direction: 'request',
      payload_bytes: 512,
      status_code: 0,
      session_hash: 'test-session',
    })

    await scout.shutdown()

    expect(sink.events[0]?.governance.data_residency).toBe('US')
  })

  it('respects retention_days configuration', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({
      env: buildEnv({ HIVE_RETENTION_DAYS: 365 }),
      sinkOverride: sink,
    })

    scout.collector.record({
      timestamp: Date.now(),
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      model_hint: 'gpt-4o',
      direction: 'request',
      payload_bytes: 512,
      status_code: 0,
      session_hash: 'test-session',
    })

    await scout.shutdown()

    expect(sink.events[0]?.governance.retention_days).toBe(365)
  })

  it('disables connectors based on HIVE_CONNECTORS env', () => {
    const scout = new Scout({
      env: buildEnv({
        enabledConnectors: ['openai'],
      }),
    })

    expect(scout.openai).toBeDefined()
  })

  it('handles multiple events from different providers', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), logger: silentLogger, sinkOverride: sink })

    const mockOpenAI = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'openai-model': 'gpt-4o' },
      }),
    )

    const mockAnthropic = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'anthropic-model': 'claude-opus' },
      }),
    )

    const mockOllama = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2' },
      }),
    )

    const wrappedOAI = scout.openai!.wrap(mockOpenAI)
    const wrappedAnt = scout.anthropic!.wrap(mockAnthropic)
    const wrappedOll = scout.ollama!.wrap(mockOllama)

    await wrappedOAI('https://api.openai.com/v1/chat/completions', { method: 'POST', body: '{}' })
    await wrappedAnt('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{}' })
    await wrappedOll('http://localhost:11434/api/chat', { method: 'POST', body: '{}' })

    await scout.shutdown()

    expect(sink.events.length).toBe(6)
    expect(sink.events.filter((e) => e.provider === 'openai').length).toBe(2)
    expect(sink.events.filter((e) => e.provider === 'anthropic').length).toBe(2)
    expect(sink.events.filter((e) => e.provider === 'ollama').length).toBe(2)
  })
})
