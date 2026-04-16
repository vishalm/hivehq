---
sidebar_position: 3
title: "Configuration"
description: "Environment variables and setup configuration"
---

# Configuration

HIVE is configured via environment variables and the Setup UI. No `.env` files are committed — all user config is persisted to the ConfigStore vault.

## Configuration Tiers

### 1. Docker Compose Defaults

When you run `docker-compose up`, services load from environment blocks in `docker-compose.yml`:

```yaml
services:
  node:
    environment:
      DATABASE_URL: postgresql://hive:hive@db:5432/hive
      NODE_ENV: development
      PORT: 3001
      LOG_LEVEL: info
      BATCH_TIMEOUT_MS: 5000
```

These are **baked in** and apply to all containers.

### 2. Runtime Environment Variables

Override Docker defaults by exporting before `docker-compose up`:

```bash
export LOG_LEVEL=debug
export ANOMALY_SENSITIVITY=0.75
docker-compose up -d node
```

### 3. Setup UI (ConfigStore)

After HIVE boots, use the dashboard Setup panel to configure:
- LLM provider credentials (OpenAI API key, Anthropic API key, etc.)
- Governance tags (regulation, data residency, retention)
- Department mappings
- Alert rules and notification channels

This config is **persisted to `.hive/config.json`** in the ConfigStore vault.

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-4",
      "enabled": true
    },
    "anthropic": {
      "apiKey": "sk-ant-...",
      "enabled": true
    }
  },
  "governance": {
    "defaultRegulation": "none",
    "defaultDataResidency": "us-east-1",
    "defaultRetentionDays": 90
  },
  "departments": [
    { "id": "eng", "name": "Engineering" },
    { "id": "mkt", "name": "Marketing" }
  ]
}
```

## Environment Variables Reference

### Node Server

#### Database

| Variable | Default | Type | Required |
|----------|---------|------|----------|
| `DATABASE_URL` | `postgresql://hive:hive@db:5432/hive` | string | yes |

PostgreSQL or TimescaleDB connection string. Format:
```
postgresql://user:password@host:port/database
```

Example for local Postgres:
```
postgresql://postgres:password@localhost:5432/hive_dev
```

#### Server

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `PORT` | `3001` | number | Port to listen on |
| `NODE_ENV` | `development` | string | `development`, `staging`, or `production` |
| `HOST` | `0.0.0.0` | string | Bind address |
| `ENABLE_CORS` | `true` | boolean | Enable CORS for dashboard |

#### Logging

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `LOG_LEVEL` | `info` | string | `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | `json` | string | `json` or `text` |

Debug example:
```bash
LOG_LEVEL=debug npm run dev:node
```

#### TTP Processing

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `BATCH_TIMEOUT_MS` | `5000` | number | Max wait time before flushing batches (ms) |
| `MAX_BATCH_SIZE` | `1000` | number | Max events per batch before force-flush |
| `ENABLE_SIGNATURE_VALIDATION` | `true` | boolean | Validate Ed25519 signatures on batches |
| `MERKLE_ANCHOR_INTERVAL_HOURS` | `24` | number | How often to compute Merkle anchors |

#### Intelligence Engine

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `ANOMALY_SENSITIVITY` | `0.85` | number | Anomaly threshold (0-1, higher = stricter) |
| `FORECAST_LOOKBACK_DAYS` | `60` | number | Historical data for forecasting |
| `CLUSTERING_DISTANCE_METRIC` | `euclidean` | string | Distance metric for clustering |
| `RUN_INTELLIGENCE_JOBS` | `true` | boolean | Enable background analysis tasks |
| `INTELLIGENCE_JOB_INTERVAL_MINUTES` | `15` | number | How often to re-run analysis |

Tune anomaly detection:
```bash
# Stricter (more alerts)
ANOMALY_SENSITIVITY=0.95 docker-compose up -d node

# Looser (fewer false positives)
ANOMALY_SENSITIVITY=0.70 docker-compose up -d node
```

#### Metrics and Monitoring

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `ENABLE_METRICS` | `true` | boolean | Enable Prometheus /metrics endpoint |
| `METRICS_PORT` | `9090` | number | Prometheus metrics port |

Access metrics:
```bash
curl http://localhost:3001/metrics
```

### Dashboard

#### Server

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `NEXT_PUBLIC_NODE_URL` | `http://localhost:3001` | string | HIVE Node API URL (exposed to browser) |
| `NODE_ENV` | `development` | string | Environment |
| `PORT` | `3000` | number | Port to listen on |

For production, set to your domain:
```bash
NEXT_PUBLIC_NODE_URL=https://api.hive.mycompany.com docker-compose up -d dashboard
```

#### UI

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `NEXT_PUBLIC_THEME_MODE` | `dark` | string | `dark` or `light` (currently dark only) |
| `NEXT_PUBLIC_BRAND_NAME` | `HIVE` | string | Brand name in navbar |

## Configuration Files

### .env.local (Development)

Create this file for local overrides:

```bash
# .env.local
DATABASE_URL=postgresql://postgres:password@localhost:5432/hive_dev
NODE_ENV=development
LOG_LEVEL=debug
NEXT_PUBLIC_NODE_URL=http://localhost:3001
ANOMALY_SENSITIVITY=0.80
```

Load with:
```bash
source .env.local
npm run dev:node
npm run dev:dashboard
```

### .env.docker (Docker Compose)

Docker Compose can read from an `.env.docker` file:

```bash
# .env.docker
DATABASE_URL=postgresql://hive:hive@db:5432/hive
BATCH_TIMEOUT_MS=10000
ANOMALY_SENSITIVITY=0.75
LOG_LEVEL=info
```

Reference in `docker-compose.yml`:
```yaml
services:
  node:
    env_file:
      - .env.docker
    environment:
      PORT: 3001
```

### .env.production (Production)

For production deployments, create `.env.production`:

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://hive_prod:${DB_PASSWORD}@hive-db.internal:5432/hive
LOG_LEVEL=warn
ENABLE_METRICS=true
ANOMALY_SENSITIVITY=0.90
FORECAST_LOOKBACK_DAYS=180
```

Do not commit `.env.production`. Use a secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.).

## Setup UI

After HIVE boots, navigate to `http://localhost:3000/settings` to configure:

### Providers

Add API credentials for each provider you use:

| Provider | Connector | Config |
|----------|-----------|--------|
| OpenAI | `@hive/connector-openai` | API key, model default |
| Anthropic | `@hive/connector-anthropic` | API key, model default |
| Ollama | `@hive/connector-ollama` | Host URL, port |
| Google | `@hive/connector-google` | Project ID, credentials |
| Mistral | `@hive/connector-mistral` | API key, model default |
| Bedrock | `@hive/connector-bedrock` | AWS region, model default |
| Azure OpenAI | `@hive/connector-azure-openai` | Endpoint, API key, model |

### Governance

Set organization-wide defaults:

- **Regulation**: `none`, `hipaa`, `gdpr`, `sox`, `sox-hipaa`
- **Data Residency**: `us-east-1`, `eu-west-1`, `ap-southeast-1`, etc.
- **Retention Days**: Default retention before purge (30-365 days)

These values are frozen in `GovernanceBlock` on every event.

### Departments

Define teams/departments for cost allocation:

```json
[
  { "id": "eng", "name": "Engineering", "costCenter": "1001" },
  { "id": "mkt", "name": "Marketing", "costCenter": "2001" },
  { "id": "sales", "name": "Sales", "costCenter": "3001" }
]
```

Used for cost breakdowns and anomaly detection.

### Alerts

Configure notifications for:
- Anomalies (unusual spend spikes)
- Shadow AI (unsanctioned providers detected)
- Error rates exceeding threshold
- Compliance violations

Channels: Slack, email, PagerDuty, webhook.

## Example: Full Local Setup

Create `.env.local`:

```bash
DATABASE_URL=postgresql://localhost/hive_dev
NODE_ENV=development
LOG_LEVEL=debug
PORT=3001
BATCH_TIMEOUT_MS=3000
ANOMALY_SENSITIVITY=0.80
NEXT_PUBLIC_NODE_URL=http://localhost:3001
```

Start development:

```bash
source .env.local
npm run migrate
npm run dev:node &
npm run dev:dashboard &
```

Visit `http://localhost:3000`, then `http://localhost:3000/settings` to configure providers.

## Example: Docker Compose Override

Create `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  node:
    environment:
      LOG_LEVEL: debug
      ANOMALY_SENSITIVITY: 0.75
      BATCH_TIMEOUT_MS: 3000

  db:
    ports:
      - "5432:5432"  # Expose for psql access
```

Docker Compose automatically merges this with `docker-compose.yml`.

## Validation and Secrets

### Never Commit Secrets

- `.env.production` is `.gitignore`'d
- Never hardcode API keys in code
- Use environment variables or a secrets vault

### Using a Secrets Manager

Example with AWS Secrets Manager:

```bash
# Before starting
export $(aws secretsmanager get-secret-value \
  --secret-id hive-prod \
  --query 'SecretString' \
  --output text | jq -r 'to_entries | .[] | "\(.key)=\(.value)"')

docker-compose up -d
```

### Validation

HIVE validates configuration on startup:

```
INFO Validating configuration...
INFO DATABASE_URL points to PostgreSQL 15.2
INFO Ed25519 keys loaded from .hive/keys
INFO Anomaly sensitivity: 0.85
INFO All validations passed
```

If validation fails, startup halts with error:

```
ERROR Invalid DATABASE_URL: cannot connect to postgresql://...
ERROR Startup failed
```

---

Next: [Architecture Overview](/architecture/overview) or [Docker Setup](/getting-started/docker).
