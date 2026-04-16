import { describe, expect, it } from 'vitest'
import {
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  defaultUAEGovernance,
  newEventId,
  newSessionHash,
  type TTPEvent,
} from '@hive/shared'
import { estimateEventCost, estimateBatchCost } from './cost-model.js'
import { detectAnomalies } from './anomaly.js'
import { forecastSpend } from './forecast.js'
import { clusterBehavior, analyzeFlows, fingerprintByDept } from './clustering.js'

function makeEvent(overrides: Partial<TTPEvent> = {}): TTPEvent {
  return {
    TTP_version: TTP_VERSION,
    event_id: newEventId(),
    schema_hash: TTP_SCHEMA_HASH,
    timestamp: Date.now() - Math.random() * 86_400_000,
    observed_at: Date.now(),
    emitter_id: 'test-scout',
    emitter_type: 'scout',
    session_hash: newSessionHash(),
    provider: 'anthropic',
    endpoint: '/v1/messages',
    model_hint: 'claude-sonnet-4-20250514',
    direction: 'response',
    payload_bytes: 4096,
    latency_ms: 250,
    status_code: 200,
    estimated_tokens: 1024,
    deployment: 'solo',
    governance: defaultUAEGovernance(),
    ...overrides,
  }
}

function makeEvents(count: number, overrides: Partial<TTPEvent> = {}): TTPEvent[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent({
      timestamp: Date.now() - (count - i) * 60_000, // 1 min apart
      ...overrides,
    }),
  )
}

describe('Cost Model', () => {
  it('estimates cost for a Claude event', () => {
    const cost = estimateEventCost(makeEvent())
    expect(cost.totalCost).toBeGreaterThan(0)
    expect(cost.currency).toBe('USD')
    expect(cost.confidence).toBe('exact')
  })

  it('returns zero cost for Ollama events', () => {
    const cost = estimateEventCost(makeEvent({ provider: 'ollama', model_hint: 'llama3.1' }))
    expect(cost.totalCost).toBe(0)
  })

  it('computes batch cost with breakdowns', () => {
    const events = [
      makeEvent({ provider: 'anthropic', model_hint: 'claude-sonnet-4-20250514' }),
      makeEvent({ provider: 'openai', model_hint: 'gpt-4o' }),
      makeEvent({ provider: 'ollama', model_hint: 'llama3.1' }),
    ]
    const batch = estimateBatchCost(events)
    expect(batch.total).toBeGreaterThan(0)
    expect(batch.byProvider['ollama']).toBe(0)
    expect(batch.byProvider['anthropic']).toBeGreaterThan(0)
    expect(batch.byProvider['openai']).toBeGreaterThan(0)
    expect(batch.currency).toBe('USD')
  })
})

describe('Anomaly Detection', () => {
  it('detects shadow AI providers', () => {
    const events = makeEvents(10, { provider: 'custom:internal-llama' as any })
    const anomalies = detectAnomalies(events)
    const shadow = anomalies.find((a) => a.category === 'shadow_ai')
    expect(shadow).toBeDefined()
    expect(shadow!.providers).toContain('custom:internal-llama')
  })

  it('returns no anomalies for normal traffic', () => {
    const events = makeEvents(10)
    const anomalies = detectAnomalies(events)
    const shadow = anomalies.find((a) => a.category === 'shadow_ai')
    expect(shadow).toBeUndefined()
  })

  it('detects error bursts', () => {
    const events = makeEvents(20, { direction: 'error', status_code: 500 })
    const anomalies = detectAnomalies(events)
    const burst = anomalies.find((a) => a.category === 'error_burst')
    expect(burst).toBeDefined()
  })
})

describe('Forecast', () => {
  it('returns null with insufficient data', () => {
    const events = makeEvents(2)
    expect(forecastSpend(events)).toBeNull()
  })

  it('generates a forecast with enough data', () => {
    // Spread events across 5 days
    const events: TTPEvent[] = []
    for (let day = 0; day < 5; day++) {
      for (let i = 0; i < 20; i++) {
        events.push(makeEvent({
          timestamp: Date.now() - (5 - day) * 86_400_000 + i * 60_000,
          estimated_tokens: 1000 + day * 200, // growing
        }))
      }
    }
    const forecast = forecastSpend(events)
    expect(forecast).not.toBeNull()
    expect(forecast!.projectedSpend).toBeGreaterThan(0)
    expect(forecast!.monthlyProjections.length).toBeGreaterThan(0)
    expect(forecast!.insight).toBeTruthy()
    expect(forecast!.trend.r2).toBeGreaterThanOrEqual(0)
  })
})

describe('Clustering', () => {
  it('clusters events by behavior', () => {
    const events = [
      ...makeEvents(10, { provider: 'anthropic', emitter_id: 'scout-1' }),
      ...makeEvents(10, { provider: 'ollama', emitter_id: 'scout-2' }),
    ]
    const clusters = clusterBehavior(events)
    expect(clusters.length).toBeGreaterThanOrEqual(1)
    expect(clusters[0]!.actors).toBeGreaterThan(0)
    expect(clusters[0]!.fingerprint).toBeTruthy()
  })

  it('analyzes flows between providers', () => {
    const sessionHash = newSessionHash()
    const events = [
      makeEvent({ provider: 'openai', session_hash: sessionHash, timestamp: Date.now() - 2000 }),
      makeEvent({ provider: 'anthropic', session_hash: sessionHash, timestamp: Date.now() - 1000 }),
    ]
    const flows = analyzeFlows(events)
    expect(flows.totalSessions).toBeGreaterThanOrEqual(1)
  })

  it('fingerprints by department', () => {
    const events = [
      ...makeEvents(5, { dept_tag: 'engineering' }),
      ...makeEvents(5, { dept_tag: 'marketing' }),
    ]
    const fingerprints = fingerprintByDept(events)
    expect(fingerprints.length).toBe(2)
    expect(fingerprints.some((f) => f.entity === 'engineering')).toBe(true)
    expect(fingerprints[0]!.classification).toBeTruthy()
  })
})
