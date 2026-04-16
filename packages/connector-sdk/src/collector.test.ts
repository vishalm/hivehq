import { describe, expect, it, beforeEach } from 'vitest'
import { TTPCollector } from './collector.js'
import { InMemorySink } from './sinks.js'
import type { HiveConnectorEvent } from '@hive/shared'
import {
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  newSessionHash,
  defaultUAEGovernance,
} from '@hive/shared'

describe('TTPCollector', () => {
  let sink: InMemorySink
  let collector: TTPCollector

  beforeEach(() => {
    sink = new InMemorySink()
    collector = new TTPCollector({
      sink,
      governance: defaultUAEGovernance(),
      deployment: 'solo',
      emitterId: 'test-scout',
      emitterType: 'scout',
      flushIntervalMs: 0,
      maxBatchSize: 100,
    })
  })

  describe('Event recording', () => {
    it('records a single event', () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const recorded = collector.record(event)

      expect(recorded).toMatchObject({
        TTP_version: TTP_VERSION,
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
      })
      expect(recorded.event_id).toBeTruthy()
      expect(recorded.schema_hash).toBe(TTP_SCHEMA_HASH)
    })

    it('queues events before flush', () => {
      const event1: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const event2: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'anthropic',
        endpoint: '/v1/messages',
        model_hint: 'claude-3-opus',
        direction: 'response',
        payload_bytes: 1024,
        status_code: 200,
        session_hash: newSessionHash(),
      }

      collector.record(event1)
      expect(collector.pendingCount()).toBe(1)

      collector.record(event2)
      expect(collector.pendingCount()).toBe(2)
    })

    it('enriches event with governance block', () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const recorded = collector.record(event)

      expect(recorded.governance).toBeDefined()
      expect(recorded.governance.pii_asserted).toBe(false)
      expect(recorded.governance.content_asserted).toBe(false)
      expect(recorded.governance.data_residency).toBe('AE')
    })

    it('enriches event with TTP version and schema hash', () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const recorded = collector.record(event)

      expect(recorded.TTP_version).toBe(TTP_VERSION)
      expect(recorded.schema_hash).toBe(TTP_SCHEMA_HASH)
    })

    it('enriches event with emitter metadata', () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const recorded = collector.record(event)

      expect(recorded.emitter_id).toBe('test-scout')
      expect(recorded.emitter_type).toBe('scout')
      expect(recorded.deployment).toBe('solo')
    })

    it('applies overrides to recorded event', () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const recorded = collector.record(event, {
        estimated_tokens: 500,
        dept_tag: 'engineering',
        use_case_tag: 'inference',
      })

      expect(recorded.estimated_tokens).toBe(500)
      expect(recorded.dept_tag).toBe('engineering')
      expect(recorded.use_case_tag).toBe('inference')
    })

    it('includes optional latency_ms from event', () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'response',
        payload_bytes: 1024,
        latency_ms: 250,
        status_code: 200,
        session_hash: newSessionHash(),
      }

      const recorded = collector.record(event)

      expect(recorded.latency_ms).toBe(250)
    })

    it('includes optional ttfb_ms from event', () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'stream_chunk',
        payload_bytes: 256,
        ttfb_ms: 50,
        status_code: 200,
        session_hash: newSessionHash(),
      }

      const recorded = collector.record(event)

      expect(recorded.ttfb_ms).toBe(50)
    })

    it('includes config-level dept_tag if set', async () => {
      const configuredCollector = new TTPCollector({
        sink,
        governance: defaultUAEGovernance(),
        deployment: 'solo',
        emitterId: 'test-scout',
        emitterType: 'scout',
        deptTag: 'sales',
        flushIntervalMs: 0,
      })

      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const recorded = configuredCollector.record(event)

      expect(recorded.dept_tag).toBe('sales')
      await configuredCollector.shutdown()
    })

    it('includes optional orgNodeId if configured', async () => {
      const configuredCollector = new TTPCollector({
        sink,
        governance: defaultUAEGovernance(),
        deployment: 'federated',
        emitterId: 'test-scout',
        orgNodeId: 'node-uae-01',
        flushIntervalMs: 0,
      })

      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const recorded = configuredCollector.record(event)

      expect(recorded.org_node_id).toBe('node-uae-01')
      await configuredCollector.shutdown()
    })

    it('includes optional nodeRegion if configured', async () => {
      const configuredCollector = new TTPCollector({
        sink,
        governance: defaultUAEGovernance(),
        deployment: 'federated',
        emitterId: 'test-scout',
        nodeRegion: 'US',
        flushIntervalMs: 0,
      })

      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      const recorded = configuredCollector.record(event)

      expect(recorded.node_region).toBe('US')
      await configuredCollector.shutdown()
    })
  })

  describe('Batch flushing', () => {
    it('flush sends queued events to sink', async () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      collector.record(event)
      expect(sink.events.length).toBe(0)

      await collector.flush()
      expect(sink.events.length).toBe(1)
      expect(collector.pendingCount()).toBe(0)
    })

    it('flush handles multiple events', async () => {
      for (let i = 0; i < 5; i++) {
        collector.record({
          timestamp: Date.now(),
          provider: 'openai',
          endpoint: '/v1/chat/completions',
          model_hint: 'gpt-4o',
          direction: 'request',
          payload_bytes: 512,
          status_code: 0,
          session_hash: newSessionHash(),
        })
      }

      await collector.flush()
      expect(sink.events.length).toBe(5)
      expect(collector.pendingCount()).toBe(0)
    })

    it('flush is idempotent on empty queue', async () => {
      await collector.flush()
      await collector.flush()
      expect(sink.events.length).toBe(0)
    })

    it('concurrent flushes are serialized', async () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      collector.record(event)
      const promise1 = collector.flush()
      const promise2 = collector.flush()

      await Promise.all([promise1, promise2])
      expect(sink.events.length).toBe(1)
    })

    it('drain removes events from queue after flush', async () => {
      for (let i = 0; i < 3; i++) {
        collector.record({
          timestamp: Date.now(),
          provider: 'openai',
          endpoint: '/v1/chat/completions',
          model_hint: 'gpt-4o',
          direction: 'request',
          payload_bytes: 512,
          status_code: 0,
          session_hash: newSessionHash(),
        })
      }

      await collector.flush()
      const flushed = sink.drain()
      expect(flushed.length).toBe(3)
      expect(sink.events.length).toBe(0)
    })
  })

  describe('Auto-flush threshold', () => {
    it('flushes automatically when batch size exceeded', async () => {
      const smallSink = new InMemorySink()
      const smallCollector = new TTPCollector({
        sink: smallSink,
        governance: defaultUAEGovernance(),
        deployment: 'solo',
        emitterId: 'test-scout',
        emitterType: 'scout',
        flushIntervalMs: 0,
        maxBatchSize: 3,
      })

      smallCollector.record({
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      })
      smallCollector.record({
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      })

      await new Promise((r) => setTimeout(r, 10))
      expect(smallSink.events.length).toBe(0)

      smallCollector.record({
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      })

      await new Promise((r) => setTimeout(r, 50))
      expect(smallSink.events.length).toBe(3)

      await smallCollector.shutdown()
    })
  })

  describe('Shutdown', () => {
    it('flushes remaining events on shutdown', async () => {
      const event: HiveConnectorEvent = {
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      }

      collector.record(event)
      expect(sink.events.length).toBe(0)

      await collector.shutdown()
      expect(sink.events.length).toBe(1)
      expect(collector.pendingCount()).toBe(0)
    })

    it('shutdown handles empty queue', async () => {
      await collector.shutdown()
      expect(sink.events.length).toBe(0)
    })

    it('multiple shutdown calls are safe', async () => {
      collector.record({
        timestamp: Date.now(),
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        model_hint: 'gpt-4o',
        direction: 'request',
        payload_bytes: 512,
        status_code: 0,
        session_hash: newSessionHash(),
      })

      await collector.shutdown()
      await collector.shutdown()
      expect(sink.events.length).toBe(1)
    })
  })
})
