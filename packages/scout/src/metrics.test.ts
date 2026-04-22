import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetForTest,
  counterInc,
  gaugeSet,
  renderProm,
  scoutMetrics,
  setInfo,
} from './metrics.js'

describe('scout metrics', () => {
  beforeEach(() => {
    _resetForTest()
  })

  it('renders a zero-line for metrics with no labels', () => {
    const out = renderProm()
    expect(out).toContain('# HELP scout_up')
    expect(out).toContain('# TYPE scout_up gauge')
    expect(out).toContain('scout_up 1')
  })

  it('counters increment by label', () => {
    counterInc(scoutMetrics.eventsRecorded, { provider: 'openai' })
    counterInc(scoutMetrics.eventsRecorded, { provider: 'openai' })
    counterInc(scoutMetrics.eventsRecorded, { provider: 'anthropic' })
    const out = renderProm()
    expect(out).toContain('scout_events_recorded_total{provider="openai"} 2')
    expect(out).toContain('scout_events_recorded_total{provider="anthropic"} 1')
  })

  it('gauges replace the value rather than accumulating', () => {
    gaugeSet(scoutMetrics.queueDepth, 42)
    gaugeSet(scoutMetrics.queueDepth, 7)
    expect(renderProm()).toContain('scout_queue_depth 7')
  })

  it('setInfo replaces prior info labels', () => {
    setInfo({ version: '0.1.0', deployment: 'node', residency: 'AE', scout_id: 'abc' })
    setInfo({ version: '0.2.0', deployment: 'solo', residency: 'US', scout_id: 'xyz' })
    const out = renderProm()
    expect(out).toContain('version="0.2.0"')
    expect(out).not.toContain('version="0.1.0"')
  })

  it('escapes label values safely', () => {
    counterInc(scoutMetrics.eventsDropped, { reason: 'bad"string\n' })
    const out = renderProm()
    expect(out).toContain('reason="bad\\"string\\n"')
  })
})
