import { describe, expect, it } from 'vitest'
import { InMemorySink } from '@hive/connector'
import { Scout } from './scout.js'
import type { ScoutEnv } from './env.js'

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

describe('Scout', () => {
  it('initialises in solo mode with a local sink', () => {
    const scout = new Scout({ env: buildEnv() })
    expect(scout.localSink).toBeDefined()
    expect(scout.id).toMatch(/^[a-f0-9]{64}$/)
  })

  it('records telemetry via OpenAI connector into the local sink', async () => {
    const sink = new InMemorySink()
    const scout = new Scout({ env: buildEnv(), sinkOverride: sink })
    const mockFetch = async () =>
      new Response('{}', {
        status: 200,
        headers: { 'content-length': '2', 'openai-model': 'gpt-4o' },
      })
    const wrapped = scout.openai.wrap(mockFetch as unknown as typeof fetch)
    await wrapped('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: '{"x":1}',
    })
    await scout.shutdown()
    expect(sink.events.length).toBe(2)
    expect(sink.events[1]?.model_hint).toBe('gpt-4o')
  })
})
