---
sidebar_position: 4
title: "Data Model & TimescaleDB"
description: "Hypertables, aggregations, event lifecycle, and Prometheus metrics"
---

# Data Model & TimescaleDB

HIVE uses TimescaleDB (Postgres + time-series extension) for storage. The data model is optimized for high-volume event ingestion, fast queries, and automatic rollups.

## Database Schema

### Events Table (Hypertable)

The core table. All TTP events are stored here:

```sql
CREATE TABLE events (
  time TIMESTAMPTZ NOT NULL,        -- Event timestamp (partition key)
  
  -- Identification
  batch_id UUID NOT NULL,
  event_id UUID NOT NULL,
  sequence_number BIGINT,
  
  -- Provider and Model
  provider VARCHAR(32) NOT NULL,    -- openai, anthropic, ollama, etc.
  model VARCHAR(256) NOT NULL,      -- gpt-4, claude-opus, llama2, etc.
  
  -- Tokens
  tokens_prompt INTEGER NOT NULL,
  tokens_completion INTEGER,
  tokens_total INTEGER GENERATED ALWAYS AS (
    COALESCE(tokens_completion, 0) + tokens_prompt
  ) STORED,
  
  -- Cost
  cost_usd NUMERIC(10, 6),          -- USD cost for this event
  cost_prompt_usd NUMERIC(10, 6),
  cost_completion_usd NUMERIC(10, 6),
  
  -- Performance
  latency_ms INTEGER,
  error VARCHAR(256),
  
  -- Metadata
  department VARCHAR(64),
  request_id UUID,
  trace_id VARCHAR(256),
  user_id VARCHAR(256),            -- Hashed, not plaintext
  
  -- Cache
  cache_tokens_read INTEGER,
  cache_hit BOOLEAN,
  
  -- Governance
  regulation VARCHAR(32),           -- hipaa, gdpr, sox, none
  data_residency VARCHAR(32),       -- us-east-1, eu-west-1, etc.
  retention_days INTEGER,
  purge_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted BOOLEAN DEFAULT false     -- Soft delete flag
);

-- Create hypertable (time-partitioned)
SELECT create_hypertable(
  'events',
  'time',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '1 day'
);

-- Indexes
CREATE INDEX ON events (provider, time DESC);
CREATE INDEX ON events (department, time DESC);
CREATE INDEX ON events (model, time DESC);
CREATE INDEX ON events (time DESC, cost_usd DESC);
CREATE INDEX ON events (batch_id);
CREATE INDEX ON events (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX ON events (user_id) WHERE user_id IS NOT NULL;
```

### Costs Table (Materialized View)

Pre-aggregated costs for fast dashboard queries:

```sql
CREATE MATERIALIZED VIEW costs_hourly AS
SELECT
  time_bucket('1 hour'::INTERVAL, time) AS hour,
  provider,
  model,
  department,
  COUNT(*) AS event_count,
  SUM(tokens_prompt) AS total_tokens_prompt,
  SUM(tokens_completion) AS total_tokens_completion,
  SUM(cost_usd) AS total_cost_usd,
  AVG(latency_ms) AS avg_latency_ms,
  MAX(latency_ms) AS max_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
FROM events
WHERE NOT deleted
GROUP BY hour, provider, model, department;

CREATE UNIQUE INDEX costs_hourly_idx
  ON costs_hourly (hour, provider, model, department);

-- Refresh hourly
REFRESH MATERIALIZED VIEW CONCURRENTLY costs_hourly;
```

### Anomalies Table

Detected anomalies (unusual spend, error spikes, shadow AI):

```sql
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time TIMESTAMPTZ NOT NULL,
  
  -- Anomaly type
  type VARCHAR(32) NOT NULL,        -- spend_spike, error_rate, shadow_ai, latency
  
  -- Details
  provider VARCHAR(32),
  department VARCHAR(64),
  severity VARCHAR(16),             -- low, medium, high, critical
  
  -- Metrics
  observed_value NUMERIC,
  baseline_value NUMERIC,
  z_score NUMERIC,                  -- Standard deviations from mean
  
  -- Details
  description TEXT,
  recommendation TEXT,
  
  -- Status
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(256),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON anomalies (time DESC);
CREATE INDEX ON anomalies (type, severity, time DESC);
CREATE INDEX ON anomalies (department, time DESC);
```

### Forecasts Table

Spend forecasts computed by intelligence engine:

```sql
CREATE TABLE forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  computed_at TIMESTAMPTZ NOT NULL,
  forecast_horizon DATE,           -- Forecast date
  
  -- Breakdown
  provider VARCHAR(32),
  model VARCHAR(256),
  department VARCHAR(64),
  
  -- Forecast metrics
  predicted_tokens NUMERIC,
  predicted_cost_usd NUMERIC,
  confidence_interval_lower NUMERIC,
  confidence_interval_upper NUMERIC,
  
  -- Basis
  lookback_days INTEGER,
  trend VARCHAR(16),               -- increasing, decreasing, stable
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON forecasts (forecast_horizon, provider, department);
```

### Audit Logs Table

Immutable governance audit trail:

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  time TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Action
  action VARCHAR(64) NOT NULL,     -- ingest, query, delete, config_change, purge
  status VARCHAR(16),              -- success, failure, pending
  
  -- Actor
  user_id VARCHAR(256),
  service VARCHAR(64),             -- node, scout, dashboard
  
  -- Target
  resource_type VARCHAR(64),       -- batch, event, user, config
  resource_id VARCHAR(256),
  
  -- Details
  details JSONB,
  error VARCHAR(1024),
  
  -- Governance
  regulation VARCHAR(32),
  data_residency VARCHAR(32)
);

CREATE INDEX ON audit_logs (time DESC);
CREATE INDEX ON audit_logs (action, time DESC);
CREATE INDEX ON audit_logs (user_id, time DESC);
CREATE INDEX ON audit_logs (resource_type, resource_id);
```

### Batches Table

Stores TTP batch metadata for audit trail:

```sql
CREATE TABLE batches (
  batch_id UUID PRIMARY KEY,
  
  created_at TIMESTAMPTZ NOT NULL,
  sequence_number BIGINT NOT NULL,
  
  -- Signing
  signature VARCHAR(256) NOT NULL,
  signing_key_id VARCHAR(256),
  
  -- Governance
  pii_asserted BOOLEAN NOT NULL DEFAULT false,
  content_asserted BOOLEAN NOT NULL DEFAULT false,
  regulation VARCHAR(32),
  data_residency VARCHAR(32),
  retention_days INTEGER,
  purge_at TIMESTAMPTZ,
  
  -- Merkle
  merkle_anchor VARCHAR(256),
  merkle_anchor_time TIMESTAMPTZ,
  
  -- Status
  event_count INTEGER,
  ingest_timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON batches (created_at DESC);
CREATE INDEX ON batches (signing_key_id);
```

## Hypertables and Partitioning

TimescaleDB's hypertables automatically partition data by time:

```
┌────────────────────────────────────┐
│ events (hypertable)                │
├────────────────────────────────────┤
│ Chunk: 2026-04-16 00:00 to 23:59   │
│  - 125,432 rows                    │
│  - Size: 45 MB                     │
├────────────────────────────────────┤
│ Chunk: 2026-04-15 00:00 to 23:59   │
│  - 128,120 rows                    │
│  - Size: 48 MB                     │
├────────────────────────────────────┤
│ Chunk: 2026-04-14 00:00 to 23:59   │
│  - 119,845 rows                    │
│  - Size: 42 MB                     │
└────────────────────────────────────┘
```

Benefits:
- Automatic data compression for old chunks
- Queries on recent data are faster (smaller chunks to scan)
- Deletion of old data is O(1) (drop chunk)
- Parallel queries across chunks

## Event Lifecycle

Events flow through several states:

```
Scout                  Node                  Storage
  │
  ├─ Create TTP event
  │  (metadata from API call)
  │
  ├─ Batch (10 events or timeout)
  │
  ├─ Sign (Ed25519)
  │
  ├─ Send HTTPS POST /api/v1/ttp/ingest
  │                     ├─ Validate schema
  │                     ├─ Verify signature
  │                     ├─ Check GovernanceBlock
  │                     └─ Insert into events table
  │                                          ├─ Row inserted
  │                                          ├─ Indexed
  │                                          └─ Visible in queries
  │
  └─ Queue empty
```

**Event states:**

| State | Description | TTL |
|-------|-------------|-----|
| Pending | Awaiting batch | Seconds |
| Ingested | In database | Retention period (90 days) |
| Soft-deleted | Marked deleted (retention expired or user request) | 30 days |
| Hard-deleted | Physically removed from storage | N/A |

## Querying the Data Model

### Recent Events (Dashboard)

```sql
SELECT
  time,
  provider,
  model,
  tokens_prompt,
  tokens_completion,
  cost_usd,
  latency_ms,
  department
FROM events
WHERE time > now() - INTERVAL '24 hours'
  AND NOT deleted
ORDER BY time DESC
LIMIT 100;
```

Response time: < 100ms (indexed on time).

### Cost Breakdown by Provider

```sql
SELECT
  provider,
  SUM(cost_usd) AS total_cost,
  COUNT(*) AS event_count,
  AVG(tokens_total) AS avg_tokens
FROM events
WHERE time > now() - INTERVAL '30 days'
  AND NOT deleted
GROUP BY provider
ORDER BY total_cost DESC;
```

Response time: < 500ms (aggregation on 1M+ events).

### Anomalies

```sql
SELECT
  type,
  severity,
  provider,
  department,
  description,
  z_score
FROM anomalies
WHERE time > now() - INTERVAL '7 days'
  AND NOT acknowledged
ORDER BY severity DESC, time DESC;
```

### Forecasts

```sql
SELECT
  provider,
  department,
  forecast_horizon,
  predicted_cost_usd,
  confidence_interval_lower,
  confidence_interval_upper
FROM forecasts
WHERE forecast_horizon >= CURRENT_DATE
  AND forecast_horizon <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY forecast_horizon, provider;
```

## Continuous Aggregates

TimescaleDB's continuous aggregates automatically maintain materialized views:

```sql
CREATE MATERIALIZED VIEW costs_daily WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day'::INTERVAL, time) AS day,
  provider,
  model,
  department,
  COUNT(*) AS event_count,
  SUM(cost_usd) AS total_cost_usd,
  AVG(latency_ms) AS avg_latency
FROM events
WHERE NOT deleted
GROUP BY day, provider, model, department;

-- Automatically refreshes every hour
SELECT add_continuous_aggregate_policy('costs_daily',
  start_offset => INTERVAL '2 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

## Compression

Old chunks are automatically compressed (reduce storage by 80-90%):

```sql
ALTER TABLE events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'provider, department',
  timescaledb.compress_orderby = 'time DESC'
);

-- Compress chunks older than 7 days
SELECT add_compression_policy('events', INTERVAL '7 days');
```

Before compression: `events` 2026-04-01 chunk = 100 MB
After compression: `events` 2026-04-01 chunk = 12 MB

## Retention and Purge

Automatic hard deletion of data past retention period:

```sql
-- Purge events older than 90 days
SELECT add_retention_policy('events', INTERVAL '90 days');

-- Or manual deletion
DELETE FROM events
WHERE time < now() - INTERVAL '90 days'
  AND governance->>'regulation' != 'sox';  -- SOX requires 7 years
```

Soft deletion (marked deleted but not physically removed):

```sql
UPDATE events SET deleted = true
WHERE user_id = 'alice@company.com'
  AND time < now() - INTERVAL '1 day';  -- Right-to-erasure delay

-- Physical removal 30 days later
DELETE FROM events
WHERE deleted = true
  AND created_at < now() - INTERVAL '30 days';
```

## Prometheus Metrics

Node exports metrics at `/metrics`:

```
# HELP hive_events_ingested Total events ingested
# TYPE hive_events_ingested counter
hive_events_ingested{provider="openai", department="eng"} 45230

# HELP hive_cost_usd Total cost in USD
# TYPE hive_cost_usd gauge
hive_cost_usd{provider="openai", model="gpt-4"} 1234.56

# HELP hive_latency_ms Request latency in milliseconds
# TYPE hive_latency_ms histogram
hive_latency_ms_bucket{le="100", provider="openai"} 10000
hive_latency_ms_bucket{le="500", provider="openai"} 45000
hive_latency_ms_bucket{le="1000", provider="openai"} 50000
hive_latency_ms_bucket{le="+Inf", provider="openai"} 50230

# HELP hive_database_rows_events Rows in events table
# TYPE hive_database_rows_events gauge
hive_database_rows_events 5000000

# HELP hive_ingestion_latency_seconds Batch ingestion latency
# TYPE hive_ingestion_latency_seconds histogram
hive_ingestion_latency_seconds_bucket{le="0.1", quantile="0.5"} 500
hive_ingestion_latency_seconds_bucket{le="0.5", quantile="0.95"} 2000
```

Access metrics:

```bash
curl http://localhost:3001/metrics | grep hive_cost_usd
```

---

Next: [Connectors Overview](/connectors/overview) or [API Reference](/api/ingest).
