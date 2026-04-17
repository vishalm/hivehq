// Auth bypass for tests — must be set before any imports that read process.env
process.env['HIVE_AUTH_MODE'] = 'none'

import { describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  TTP_VERSION,
  TTP_SCHEMA_HASH,
  defaultUAEGovernance,
  newEventId,
  newSessionHash,
  generateSigningKeypair,
  signBatch,
  type TTPEvent,
} from '@hive/shared'
import { PolicyEngine, buildRetentionPolicy } from '@hive/policy'
import { buildApp } from './app.js'
import type { NodeEnv } from './env.js'

function buildTestEnv(overrides: Partial<NodeEnv> = {}): NodeEnv {
  return {
    NODE_PORT: 0,
    NODE_REGION: 'AE',
    ...overrides,
  } as NodeEnv
}

function makeEvent() {
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

describe('Node server', () => {
  it('responds on /health', async () => {
    const { app } = buildApp({ env: buildTestEnv() })
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.region).toBe('AE')
  })

  it('accepts a valid TTP batch', async () => {
    const { app, store } = buildApp({ env: buildTestEnv() })
    const batch = {
      batch_id: '11111111-1111-4111-9111-111111111111',
      sent_at: Date.now(),
      events: [makeEvent()],
    }
    const res = await request(app).post('/api/v1/ttp/ingest').send(batch)
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBe(1)
    expect(await store.count()).toBe(1)
  })

  it('rejects events with invalid governance', async () => {
    const { app } = buildApp({ env: buildTestEnv() })
    const bad = makeEvent()
    // @ts-expect-error intentional violation of the pii_asserted literal
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

  it('enforces node_region for federated deployments', async () => {
    const { app } = buildApp({ env: buildTestEnv({ NODE_REGION: 'AE' }) })
    const ev = makeEvent()
    ev.deployment = 'federated'
    ev.node_region = 'US'
    const batch = {
      batch_id: '33333333-3333-4333-9333-333333333333',
      sent_at: Date.now(),
      events: [ev],
    }
    const res = await request(app).post('/api/v1/ttp/ingest').send(batch)
    expect(res.body.errors[0].code).toBe('RESIDENCY_VIOLATION')
  })

  it('requires token when auth mode is keycloak', async () => {
    // Temporarily switch auth mode for this test
    const prev = process.env['HIVE_AUTH_MODE']
    process.env['HIVE_AUTH_MODE'] = 'keycloak'
    // No KEYCLOAK_URL — will still require Bearer token
    const { app } = buildApp({
      env: buildTestEnv({ NODE_INGEST_TOKEN: 'super-secret-token-12345' }),
    })
    const res = await request(app).post('/api/v1/ttp/ingest').send({})
    expect(res.status).toBe(401)
    process.env['HIVE_AUTH_MODE'] = prev
  })

  it('serves Prometheus metrics at /metrics', async () => {
    const { app } = buildApp({ env: buildTestEnv() })
    // Prime the counters first.
    const batch = {
      batch_id: '44444444-4444-4444-9444-444444444444',
      sent_at: Date.now(),
      events: [makeEvent()],
    }
    await request(app).post('/api/v1/ttp/ingest').send(batch)
    const res = await request(app).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.text).toContain('# TYPE TTP_ingest_events_total counter')
    expect(res.text).toContain('TTP_node_up 1')
    expect(res.text).toContain('provider="openai"')
  })

  it('rejects batches missing signatures when trust store is set', async () => {
    const kp = generateSigningKeypair()
    const trustStore = new Map([[kp.kid, kp.publicKey]])
    const { app } = buildApp({ env: buildTestEnv(), trustStore })
    const res = await request(app)
      .post('/api/v1/ttp/ingest')
      .send({
        batch_id: '55555555-5555-4555-9555-555555555555',
        sent_at: Date.now(),
        events: [makeEvent()],
      })
    expect(res.status).toBe(401)
    expect(res.body.errors[0].code).toBe('SIGNATURE_MISSING')
  })

  it('accepts signed batches with a trusted kid', async () => {
    const kp = generateSigningKeypair()
    const trustStore = new Map([[kp.kid, kp.publicKey]])
    const { app, store } = buildApp({ env: buildTestEnv(), trustStore })
    const ev = makeEvent() as TTPEvent
    const envelope = signBatch([ev], kp)
    const res = await request(app)
      .post('/api/v1/ttp/ingest')
      .send({
        batch_id: '66666666-6666-4666-9666-666666666666',
        sent_at: Date.now(),
        events: [ev],
        signature: envelope,
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBe(1)
    expect(await store.count()).toBe(1)
  })

  it('rejects batches with tampered signatures', async () => {
    const kp = generateSigningKeypair()
    const trustStore = new Map([[kp.kid, kp.publicKey]])
    const { app } = buildApp({ env: buildTestEnv(), trustStore })
    const ev = makeEvent() as TTPEvent
    const envelope = signBatch([ev], kp)
    const tampered = { ...ev, payload_bytes: ev.payload_bytes + 1 }
    const res = await request(app)
      .post('/api/v1/ttp/ingest')
      .send({
        batch_id: '77777777-7777-4777-9777-777777777777',
        sent_at: Date.now(),
        events: [tampered],
        signature: envelope,
      })
    expect(res.status).toBe(401)
    expect(res.body.errors[0].code).toBe('SIGNATURE_INVALID')
  })

  it('enforces policy engine admission control', async () => {
    // Default governance requests 90d retention; cap at 30d → deny.
    const policy = new PolicyEngine(buildRetentionPolicy(30))
    const { app } = buildApp({ env: buildTestEnv(), policy })
    const res = await request(app)
      .post('/api/v1/ttp/ingest')
      .send({
        batch_id: '88888888-8888-4888-9888-888888888888',
        sent_at: Date.now(),
        events: [makeEvent()],
      })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('POLICY_DENY')
  })
})
