import { describe, expect, it } from 'vitest'
import { createLogger } from './logger.js'

describe('createLogger', () => {
  it('returns a pino logger with expected methods', () => {
    const log = createLogger({ component: 'test' })
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.child).toBe('function')
  })

  it('respects explicit level override', () => {
    const log = createLogger({ component: 'test', level: 'warn' })
    expect(log.level).toBe('warn')
  })

  it('attaches component and scoutId as base context', () => {
    const log = createLogger({ component: 'scout', scoutId: 'abc123' })
    // Access pino's bindings snapshot
    const bindings = log.bindings()
    expect(bindings.component).toBe('scout')
    expect(bindings.scout_id).toBe('abc123')
  })
})
