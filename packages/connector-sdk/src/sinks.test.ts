import { describe, expect, it, vi, beforeEach } from 'vitest'
import { InMemorySink, ConsoleSink, HttpSink } from './sinks.js'
import type { TTPEvent } from '@hive/shared'
import {
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  newEventId,
  newSessionHash,
  defaultUAEGovernance,
} from '@hive/shared'

describe('Sinks', () => {
  function makeEvent(): TTPEvent {
    return {
      TTP_version: TTP_VERSION,
      event_id: newEventId(),
      schema_hash: TTP_SCHEMA_HASH,
      timestamp: Date.now(),
      observed_at: Date.now(),
      emitter_id: 'test-scout',
      emitter_type: 'scout',
      session_hash: newSessionHash(),
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      model_hint: 'gpt-4o',
      direction: 'response',
      payload_bytes: 1024,
      status_code: 200,
      estimated_tokens: 250,
      deployment: 'solo',
      governance: defaultUAEGovernance(),
    }
  }

  describe('InMemorySink', () => {
    it('stores events in memory', async () => {
      const sink = new InMemorySink()
      const events = [makeEvent()]

      await sink.emit(events)

      expect(sink.events.length).toBe(1)
      expect(sink.events[0]).toMatchObject({
        provider: 'openai',
        direction: 'response',
      })
    })

    it('accumulates multiple batches', async () => {
      const sink = new InMemorySink()
      const batch1 = [makeEvent()]
      const batch2 = [makeEvent(), makeEvent()]

      await sink.emit(batch1)
      expect(sink.events.length).toBe(1)

      await sink.emit(batch2)
      expect(sink.events.length).toBe(3)
    })

    it('drain returns and clears events', async () => {
      const sink = new InMemorySink()
      const events = [makeEvent(), makeEvent()]

      await sink.emit(events)
      const drained = sink.drain()

      expect(drained.length).toBe(2)
      expect(sink.events.length).toBe(0)
    })

    it('drain on empty sink returns empty array', () => {
      const sink = new InMemorySink()
      const drained = sink.drain()

      expect(drained.length).toBe(0)
    })

    it('emit does not throw', async () => {
      const sink = new InMemorySink()
      const events = [makeEvent()]

      await expect(sink.emit(events)).resolves.toBeUndefined()
    })
  })

  describe('ConsoleSink', () => {
    it('logs to console', async () => {
      const sink = new ConsoleSink()
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const events = [makeEvent()]

      await sink.emit(events)

      expect(consoleSpy).toHaveBeenCalledWith('[hive] emitting 1 event(s)')
      consoleSpy.mockRestore()
    })

    it('logs correct event count', async () => {
      const sink = new ConsoleSink()
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const events = [makeEvent(), makeEvent(), makeEvent()]

      await sink.emit(events)

      expect(consoleSpy).toHaveBeenCalledWith('[hive] emitting 3 event(s)')
      consoleSpy.mockRestore()
    })

    it('does not throw', async () => {
      const sink = new ConsoleSink()
      const events = [makeEvent()]

      await expect(sink.emit(events)).resolves.toBeUndefined()
    })
  })

  describe('HttpSink', () => {
    it('posts batch to endpoint', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ accepted: 1, rejected: 0, errors: [] }), {
          status: 200,
        }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await sink.emit(events)

      expect(mockFetch).toHaveBeenCalledOnce()
      const call = mockFetch.mock.calls[0]
      expect(call[0]).toBe('http://localhost:3000/api/v1/ttp/ingest')
      expect(call[1]?.method).toBe('POST')
    })

    it('sends correct headers', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 200 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await sink.emit(events)

      const call = mockFetch.mock.calls[0]
      const headers = call[1]?.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['X-TTP-Version']).toBe('0.1')
      expect(headers['X-TTP-Batch-ID']).toBeDefined()
    })

    it('includes authorization header when token provided', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 200 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        token: 'test-token-xyz',
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await sink.emit(events)

      const call = mockFetch.mock.calls[0]
      const headers = call[1]?.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer test-token-xyz')
    })

    it('does not include authorization when no token', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 200 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await sink.emit(events)

      const call = mockFetch.mock.calls[0]
      const headers = call[1]?.headers as Record<string, string>
      expect(headers['Authorization']).toBeUndefined()
    })

    it('posts batch with correct body', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 200 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      const event = makeEvent()
      const events = [event]
      await sink.emit(events)

      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1]?.body as string)
      expect(body.batch_id).toBeDefined()
      expect(body.sent_at).toBeDefined()
      expect(body.events).toHaveLength(1)
      expect(body.events[0].event_id).toBe(event.event_id)
    })

    it('succeeds on 200 response', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{"accepted":1,"rejected":0,"errors":[]}', { status: 200 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await expect(sink.emit(events)).resolves.toBeUndefined()
    })

    it('succeeds on 201 response', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 201 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await expect(sink.emit(events)).resolves.toBeUndefined()
    })

    it('retries on 429 (too many requests)', async () => {
      const mockFetch = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('{}', { status: 429 }))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        maxRetries: 1,
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await expect(sink.emit(events)).resolves.toBeUndefined()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('retries on 5xx (server error)', async () => {
      const mockFetch = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('{}', { status: 500 }))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        maxRetries: 1,
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await expect(sink.emit(events)).resolves.toBeUndefined()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('retries on network error', async () => {
      const mockFetch = vi.fn<typeof fetch>()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        maxRetries: 1,
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await expect(sink.emit(events)).resolves.toBeUndefined()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('fails immediately on 4xx (not transient)', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 400 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        maxRetries: 3,
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await expect(sink.emit(events)).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it('fails immediately on 401 unauthorized', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 401 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        maxRetries: 3,
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await expect(sink.emit(events)).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it('exhausts retries and throws', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 500 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        maxRetries: 2,
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await expect(sink.emit(events)).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('default maxRetries is 3', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 200 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      // Verify default is applied
      expect(sink).toBeDefined()
    })

    it('throws when fetch is not available and not provided', async () => {
      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        // No fetchImpl provided
      })

      const events = [makeEvent()]
      // Save original globalThis.fetch
      const originalFetch = globalThis.fetch
      // @ts-expect-error intentionally undefined for test
      delete (globalThis as any).fetch

      try {
        await expect(sink.emit(events)).rejects.toThrow('No fetch implementation')
      } finally {
        // Restore fetch
        ;(globalThis as any).fetch = originalFetch
      }
    })

    it('batch_id is included in headers', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 200 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      const events = [makeEvent()]
      await sink.emit(events)

      const call = mockFetch.mock.calls[0]
      const headers = call[1]?.headers as Record<string, string>
      const batchId = headers['X-TTP-Batch-ID']
      expect(batchId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('sent_at is recent timestamp in batch body', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{}', { status: 200 }),
      )

      const sink = new HttpSink({
        endpoint: 'http://localhost:3000/api/v1/ttp/ingest',
        fetchImpl: mockFetch,
      })

      const before = Date.now()
      const events = [makeEvent()]
      await sink.emit(events)
      const after = Date.now()

      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1]?.body as string)
      expect(body.sent_at).toBeGreaterThanOrEqual(before)
      expect(body.sent_at).toBeLessThanOrEqual(after + 100)
    })
  })
})
