// Auth bypass for tests
process.env['HIVE_AUTH_MODE'] = 'none'

import { describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  defaultUAEGovernance,
  newEventId,
  newSessionHash,
  type TTPEvent,
} from '@hive/shared'
import { buildApp } from './app.js'
import type { NodeEnv } from './env.js'

function buildTestEnv(overrides: Partial<NodeEnv> = {}): NodeEnv {
  return {
    NODE_PORT: 0,
    NODE_REGION: 'AE',
    ...overrides,
  } as NodeEnv
}

function makeEvent(): TTPEvent {
  return {
    TTP_version: TTP_VERSION,
    event_id: newEventId(),
    schema_hash: TTP_SCHEMA_HASH,
    timestamp: Date.now(),
    observed_at: Date.now(),
    emitter_id: 'scout-test',
    emitter_type: 'scout',
    session_hash: newSessionHash(),
    provider: 'openai',
    endpoint: '/v1/chat/completions',
    model_hint: 'gpt-4o',
    direction: 'response',
    payload_bytes: 1024,
    latency_ms: 250,
    status_code: 200,
    estimated_tokens: 270,
    deployment: 'node',
    governance: defaultUAEGovernance(),
  }
}

describe('TTP Ingest Endpoint', () => {
  describe('POST /api/v1/ttp/ingest', () => {
    it('accepts valid batch and returns 200', async () => {
      const { app, store } = buildApp({ env: buildTestEnv() })
      const batch = {
        batch_id: '11111111-1111-4111-9111-111111111111',
        sent_at: Date.now(),
        events: [makeEvent()],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(200)
      expect(res.body.accepted).toBe(1)
      expect(res.body.rejected).toBe(0)
      expect(res.body.batch_id).toBe(batch.batch_id)
      expect(await store.count()).toBe(1)
    })

    it('rejects malformed JSON with 400', async () => {
      const { app } = buildApp({ env: buildTestEnv() })

      const res = await request(app)
        .post('/api/v1/ttp/ingest')
        .send('not json')
        .set('Content-Type', 'application/json')

      expect(res.status).toBe(400)
    })

    it('rejects invalid batch schema with 400', async () => {
      const { app } = buildApp({ env: buildTestEnv() })
      const invalid = {
        batch_id: 'not-uuid',
        sent_at: Date.now(),
        events: [makeEvent()],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(invalid)

      expect(res.status).toBe(400)
      expect(res.body.accepted).toBe(0)
      expect(res.body.rejected).toBe(0)
      expect(res.body.errors.length).toBeGreaterThan(0)
      expect(res.body.errors[0].code).toBe('BATCH_INVALID')
    })

    it('rejects event with invalid governance (pii_asserted=true)', async () => {
      const { app } = buildApp({ env: buildTestEnv() })
      const bad = makeEvent()
      // @ts-expect-error intentional violation
      bad.governance.pii_asserted = true
      const batch = {
        batch_id: '22222222-2222-4222-9222-222222222222',
        sent_at: Date.now(),
        events: [bad],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(400)
      expect(res.body.rejected).toBe(1)
      expect(res.body.errors[0].code).toBe('SCHEMA_INVALID')
    })

    it('rejects event with invalid governance (content_asserted=true)', async () => {
      const { app } = buildApp({ env: buildTestEnv() })
      const bad = makeEvent()
      // @ts-expect-error intentional violation
      bad.governance.content_asserted = true
      const batch = {
        batch_id: '33333333-3333-4333-9333-333333333333',
        sent_at: Date.now(),
        events: [bad],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(400)
      expect(res.body.rejected).toBe(1)
    })

    it('enforces node_region for federated deployments', async () => {
      const { app } = buildApp({ env: buildTestEnv({ NODE_REGION: 'AE' }) })
      const ev = makeEvent()
      ev.deployment = 'federated'
      ev.node_region = 'US' as any
      const batch = {
        batch_id: '44444444-4444-4444-9444-444444444444',
        sent_at: Date.now(),
        events: [ev],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.body.errors[0].code).toBe('RESIDENCY_VIOLATION')
    })

    it('enforces node_region for open deployments', async () => {
      const { app } = buildApp({ env: buildTestEnv({ NODE_REGION: 'US' }) })
      const ev = makeEvent()
      ev.deployment = 'open'
      ev.node_region = 'AE' as any
      const batch = {
        batch_id: '55555555-5555-4555-9555-555555555555',
        sent_at: Date.now(),
        events: [ev],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.body.errors[0].code).toBe('RESIDENCY_VIOLATION')
    })

    it('accepts matching node_region for federated deployment', async () => {
      const { app, store } = buildApp({ env: buildTestEnv({ NODE_REGION: 'AE' }) })
      const ev = makeEvent()
      ev.deployment = 'federated'
      ev.node_region = 'AE' as any
      const batch = {
        batch_id: '66666666-6666-4666-9666-666666666666',
        sent_at: Date.now(),
        events: [ev],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(200)
      expect(res.body.accepted).toBe(1)
      expect(await store.count()).toBe(1)
    })

    it('allows solo deployments without node_region check', async () => {
      const { app, store } = buildApp({ env: buildTestEnv({ NODE_REGION: 'AE' }) })
      const ev = makeEvent()
      ev.deployment = 'solo'
      ev.node_region = 'US' as any // Different region is OK for solo
      const batch = {
        batch_id: '77777777-7777-4777-9777-777777777777',
        sent_at: Date.now(),
        events: [ev],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(200)
      expect(res.body.accepted).toBe(1)
      expect(await store.count()).toBe(1)
    })

    it('mixes accepted and rejected events', async () => {
      const { app, store } = buildApp({ env: buildTestEnv() })
      const good = makeEvent()
      const bad = makeEvent()
      bad.deployment = 'federated'
      bad.node_region = 'US' as any
      const batch = {
        batch_id: '88888888-8888-4888-9888-888888888888',
        sent_at: Date.now(),
        events: [good, bad],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(200)
      expect(res.body.accepted).toBe(1)
      expect(res.body.rejected).toBe(1)
      expect(await store.count()).toBe(1)
    })

    it('returns empty errors array when all events rejected', async () => {
      const { app } = buildApp({ env: buildTestEnv() })
      const bad = makeEvent()
      bad.deployment = 'federated'
      bad.node_region = 'US' as any
      const batch = {
        batch_id: '99999999-9999-4999-9999-999999999999',
        sent_at: Date.now(),
        events: [bad],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(400)
      expect(res.body.rejected).toBe(1)
      expect(res.body.errors.length).toBeGreaterThan(0)
    })

    it('returns ingested_at timestamp', async () => {
      const { app } = buildApp({ env: buildTestEnv() })
      const batch = {
        batch_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        sent_at: Date.now(),
        events: [makeEvent()],
      }

      const before = Date.now()
      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)
      const after = Date.now()

      expect(res.body.ingested_at).toBeGreaterThanOrEqual(before)
      expect(res.body.ingested_at).toBeLessThanOrEqual(after + 100)
    })

    it('rejects all events when batch_id is invalid', async () => {
      const { app } = buildApp({ env: buildTestEnv() })
      const batch = {
        batch_id: 'invalid',
        sent_at: Date.now(),
        events: [makeEvent()],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(400)
      expect(res.body.rejected).toBe(0)
    })

    it('accepts batch with multiple valid events', async () => {
      const { app, store } = buildApp({ env: buildTestEnv() })
      const batch = {
        batch_id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        sent_at: Date.now(),
        events: [makeEvent(), makeEvent(), makeEvent()],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(200)
      expect(res.body.accepted).toBe(3)
      expect(res.body.rejected).toBe(0)
      expect(await store.count()).toBe(3)
    })

    it('returns 200 even with all events rejected if they are valid schema', async () => {
      const { app } = buildApp({ env: buildTestEnv({ NODE_REGION: 'AE' }) })
      const ev = makeEvent()
      ev.deployment = 'federated'
      ev.node_region = 'US' as any
      const batch = {
        batch_id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
        sent_at: Date.now(),
        events: [ev],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(400) // 400 when all rejected
      expect(res.body.rejected).toBe(1)
    })
  })

  describe('GET /health', () => {
    it('returns health status', async () => {
      const { app } = buildApp({ env: buildTestEnv() })

      const res = await request(app).get('/health')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.region).toBe('AE')
      expect(res.body.uptime_ms).toBeGreaterThanOrEqual(0)
    })

    it('includes events_ingested count', async () => {
      const { app, store } = buildApp({ env: buildTestEnv() })

      // Ingest an event first
      const batch = {
        batch_id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
        sent_at: Date.now(),
        events: [makeEvent()],
      }
      await request(app).post('/api/v1/ttp/ingest').send(batch)

      const res = await request(app).get('/health')

      expect(res.status).toBe(200)
      expect(res.body.events_ingested).toBe(1)
    })
  })

  describe('GET /version', () => {
    it('returns version info', async () => {
      const { app } = buildApp({ env: buildTestEnv() })

      const res = await request(app).get('/version')

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('@hive/node-server')
      expect(res.body.version).toBe('0.1.0')
      expect(res.body.TTP).toBe('0.1')
    })
  })

  describe('GET /metrics', () => {
    it('returns Prometheus metrics', async () => {
      const { app } = buildApp({ env: buildTestEnv() })

      const res = await request(app).get('/metrics')

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/plain')
      expect(res.text).toContain('# HELP')
    })
  })

  describe('Authentication', () => {
    it('accepts request with valid token', async () => {
      const { app } = buildApp({ env: buildTestEnv({ NODE_INGEST_TOKEN: 'secret-abc' }) })
      const batch = {
        batch_id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
        sent_at: Date.now(),
        events: [makeEvent()],
      }

      const res = await request(app)
        .post('/api/v1/ttp/ingest')
        .set('Authorization', 'Bearer secret-abc')
        .send(batch)

      expect(res.status).toBe(200)
      expect(res.body.accepted).toBe(1)
    })

    it('rejects request without token when required', async () => {
      const prev = process.env['HIVE_AUTH_MODE']
      process.env['HIVE_AUTH_MODE'] = 'keycloak'
      const { app } = buildApp({ env: buildTestEnv({ NODE_INGEST_TOKEN: 'secret-xyz-1234567890' }) })
      const batch = {
        batch_id: 'ffffffff-ffff-4fff-ffff-ffffffffffff',
        sent_at: Date.now(),
        events: [makeEvent()],
      }

      const res = await request(app).post('/api/v1/ttp/ingest').send(batch)

      expect(res.status).toBe(401)
      process.env['HIVE_AUTH_MODE'] = prev
    })

    it('rejects request with wrong token', async () => {
      const prev = process.env['HIVE_AUTH_MODE']
      process.env['HIVE_AUTH_MODE'] = 'keycloak'
      const { app } = buildApp({ env: buildTestEnv({ NODE_INGEST_TOKEN: 'secret-correct-1234567890' }) })
      const batch = {
        batch_id: '00000000-0000-4000-0000-000000000000',
        sent_at: Date.now(),
        events: [makeEvent()],
      }

      const res = await request(app)
        .post('/api/v1/ttp/ingest')
        .set('Authorization', 'Bearer secret-wrong')
        .send(batch)

      expect(res.status).toBe(401)
      process.env['HIVE_AUTH_MODE'] = prev
    })
  })
})
