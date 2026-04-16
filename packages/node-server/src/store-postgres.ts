/**
 * PostgreSQL / TimescaleDB-backed event store.
 *
 * Schema (see `./migrations/001_initial.sql`):
 *
 *   TTP_events         — raw TTP events, hypertable by timestamp
 *   TTP_audit_chain    — hash-chained audit log, one row per event
 *   TTP_rollup_hourly  — continuous aggregate, refreshed every 5m
 *
 * This module gracefully degrades when the `pg` package isn't installed;
 * callers can still pick `InMemoryEventStore` for tests and demos.
 */

import type { TTPEvent } from '@hive/shared'
import { appendChain, type ChainLink } from '@hive/shared'
import { canonicalize } from '@hive/shared'
import type { AggregateRow, EventStore } from './store.js'

// ── Minimal `pg` type surface (we only import lazily) ────────────────────────

interface PgQueryResult<T = unknown> {
  rows: T[]
  rowCount: number | null
}

interface PgPool {
  query<T = unknown>(text: string, values?: unknown[]): Promise<PgQueryResult<T>>
  end(): Promise<void>
}

interface PgModule {
  Pool: new (config: { connectionString: string; max?: number }) => PgPool
}

// ── Connection factory ──────────────────────────────────────────────────────

async function loadPg(): Promise<PgModule> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('pg')
    return mod.default ?? mod
  } catch (err) {
    throw new Error(
      'PostgresEventStore requires the `pg` package. ' +
        'Install it with `npm install pg @types/pg` or use InMemoryEventStore.',
      { cause: err },
    )
  }
}

export interface PostgresStoreConfig {
  connectionString: string
  region: string
  poolSize?: number
}

export class PostgresEventStore implements EventStore {
  private pool?: PgPool

  constructor(private readonly config: PostgresStoreConfig) {}

  private async getPool(): Promise<PgPool> {
    if (this.pool) return this.pool
    const pg = await loadPg()
    this.pool = new pg.Pool({
      connectionString: this.config.connectionString,
      max: this.config.poolSize ?? 10,
    })
    return this.pool
  }

  /**
   * Run the embedded migration(s). Idempotent — creates extensions, tables,
   * and continuous aggregates only if they don't already exist.
   */
  async migrate(): Promise<void> {
    const pool = await this.getPool()
    for (const stmt of MIGRATION_STATEMENTS) {
      await pool.query(stmt)
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = undefined
    }
  }

  async insert(events: TTPEvent[]): Promise<void> {
    if (events.length === 0) return
    const pool = await this.getPool()

    // Fetch the current tail to extend the hash chain atomically.
    const tailRes = await pool.query<{ seq: number; event_hash: string }>(
      'SELECT seq, event_hash FROM TTP_audit_chain WHERE region = $1 ORDER BY seq DESC LIMIT 1',
      [this.config.region],
    )
    let tail: ChainLink | undefined
    if (tailRes.rows[0]) {
      tail = {
        event: events[0]!, // placeholder — only seq/event_hash are read in appendChain
        prev_hash: '',
        event_hash: tailRes.rows[0].event_hash,
        seq: tailRes.rows[0].seq,
      }
    }

    // Transactional insert across both tables.
    await pool.query('BEGIN')
    try {
      for (const event of events) {
        const link = appendChain(tail, event)
        tail = link
        await pool.query(
          `INSERT INTO TTP_events
           (event_id, timestamp, observed_at, emitter_id, emitter_type, session_hash,
            provider, endpoint, model_hint, direction, payload_bytes, latency_ms,
            status_code, estimated_tokens, dept_tag, project_tag, env_tag, use_case_tag,
            deployment, node_region, governance, raw)
           VALUES ($1, to_timestamp($2/1000.0), to_timestamp($3/1000.0), $4, $5, $6, $7,
                   $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
           ON CONFLICT (event_id) DO NOTHING`,
          [
            event.event_id,
            event.timestamp,
            event.observed_at,
            event.emitter_id,
            event.emitter_type,
            event.session_hash,
            event.provider,
            event.endpoint,
            event.model_hint,
            event.direction,
            event.payload_bytes,
            event.latency_ms ?? null,
            event.status_code,
            event.estimated_tokens,
            event.dept_tag ?? null,
            event.project_tag ?? null,
            event.env_tag ?? null,
            event.use_case_tag ?? null,
            event.deployment,
            event.node_region ?? this.config.region,
            JSON.stringify(event.governance),
            canonicalize(event),
          ],
        )
        await pool.query(
          `INSERT INTO TTP_audit_chain (region, seq, event_id, prev_hash, event_hash, inserted_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (region, seq) DO NOTHING`,
          [this.config.region, link.seq, event.event_id, link.prev_hash, link.event_hash],
        )
      }
      await pool.query('COMMIT')
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }
  }

  async count(): Promise<number> {
    const pool = await this.getPool()
    const res = await pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM TTP_events')
    return Number(res.rows[0]?.n ?? 0)
  }

  async recent(limit: number): Promise<TTPEvent[]> {
    const pool = await this.getPool()
    const res = await pool.query<{ raw: string }>(
      'SELECT raw FROM TTP_events ORDER BY timestamp DESC LIMIT $1',
      [Math.max(0, limit)],
    )
    return res.rows.map((r) => JSON.parse(r.raw) as TTPEvent)
  }

  async aggregate(): Promise<AggregateRow[]> {
    const pool = await this.getPool()
    const res = await pool.query<{
      provider: string
      dept_tag: string | null
      call_count: string
      total_tokens: string
      total_bytes: string
      avg_latency_ms: string | null
    }>(
      `SELECT provider,
              dept_tag,
              COUNT(*)::text         AS call_count,
              SUM(estimated_tokens)::text AS total_tokens,
              SUM(payload_bytes)::text    AS total_bytes,
              AVG(latency_ms)::text       AS avg_latency_ms
       FROM TTP_events
       GROUP BY provider, dept_tag`,
    )
    return res.rows.map((r) => ({
      provider: r.provider,
      dept_tag: r.dept_tag,
      call_count: Number(r.call_count),
      total_tokens: Number(r.total_tokens),
      total_bytes: Number(r.total_bytes),
      avg_latency_ms: r.avg_latency_ms === null ? null : Number(r.avg_latency_ms),
    }))
  }

  /**
   * Retention sweep — delete events older than the governance-specified window.
   * Returns the number of rows removed. Respects each event's `retention_days`
   * (not a global TTL), so stricter governance blocks prune sooner.
   */
  async enforceRetention(): Promise<number> {
    const pool = await this.getPool()
    const res = await pool.query(
      `DELETE FROM TTP_events
       WHERE timestamp < now() - (
         COALESCE((governance->>'retention_days')::int, 90) * INTERVAL '1 day'
       )`,
    )
    return res.rowCount ?? 0
  }
}

// ── Embedded migration ───────────────────────────────────────────────────────

const MIGRATION_STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`,
  `CREATE TABLE IF NOT EXISTS TTP_events (
     event_id         uuid         NOT NULL,
     timestamp        timestamptz  NOT NULL,
     observed_at      timestamptz  NOT NULL,
     emitter_id       text         NOT NULL,
     emitter_type     text         NOT NULL,
     session_hash     text         NOT NULL,
     provider         text         NOT NULL,
     endpoint         text         NOT NULL,
     model_hint       text         NOT NULL,
     direction        text         NOT NULL,
     payload_bytes    bigint       NOT NULL,
     latency_ms       double precision,
     status_code      int          NOT NULL,
     estimated_tokens bigint       NOT NULL,
     dept_tag         text,
     project_tag      text,
     env_tag          text,
     use_case_tag     text,
     deployment       text         NOT NULL,
     node_region      text,
     governance       jsonb        NOT NULL,
     raw              text         NOT NULL,
     PRIMARY KEY (event_id, timestamp)
   )`,
  `SELECT create_hypertable('TTP_events', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE)`,
  `CREATE INDEX IF NOT EXISTS TTP_events_provider_time_idx ON TTP_events (provider, timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS TTP_events_dept_time_idx ON TTP_events (dept_tag, timestamp DESC)`,
  `CREATE TABLE IF NOT EXISTS TTP_audit_chain (
     region      text        NOT NULL,
     seq         bigint      NOT NULL,
     event_id    uuid        NOT NULL,
     prev_hash   char(64)    NOT NULL,
     event_hash  char(64)    NOT NULL,
     inserted_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (region, seq)
   )`,
  `CREATE INDEX IF NOT EXISTS TTP_audit_chain_event_idx ON TTP_audit_chain (event_id)`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS TTP_rollup_hourly
   WITH (timescaledb.continuous) AS
   SELECT time_bucket('1 hour', timestamp) AS bucket,
          provider,
          dept_tag,
          COUNT(*)                 AS call_count,
          SUM(estimated_tokens)    AS total_tokens,
          SUM(payload_bytes)       AS total_bytes,
          AVG(latency_ms)          AS avg_latency_ms
     FROM TTP_events
    GROUP BY bucket, provider, dept_tag
   WITH NO DATA`,
  `SELECT add_continuous_aggregate_policy('TTP_rollup_hourly',
     start_offset => INTERVAL '3 days',
     end_offset   => INTERVAL '1 hour',
     schedule_interval => INTERVAL '5 minutes',
     if_not_exists => TRUE)`,
]
