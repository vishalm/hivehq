---
sidebar_position: 2
title: "Docker Setup"
description: "Complete Docker Compose reference for HIVE"
---

# Docker Setup

HIVE is fully containerized. Docker Compose orchestrates all services with sensible defaults for local development and production-ready configurations.

## What's Included

The standard `docker-compose.yml` includes:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **node** | `hive:node-latest` | 3001 | HIVE API server and intelligence engine |
| **dashboard** | `hive:dashboard-latest` | 3000 | Next.js dashboard UI |
| **db** | `timescaledb/timescaledb:latest` | 5432 | TimescaleDB (Postgres + time-series) |
| **ollama-proxy** | `hive:ollama-proxy` | 11434 | Local Ollama with HIVE connector built-in |

## Quick Start

### Copy the Example Compose File

```bash
cp docker-compose.example.yml docker-compose.yml
```

Or use the default (checked into the repo).

### Start All Services

```bash
docker-compose up -d
```

All four services boot in parallel. TimescaleDB takes ~10 seconds to initialize.

### Verify Health

```bash
# Node server
curl http://localhost:3001/health

# Dashboard (should redirect or show HTML)
curl -I http://localhost:3000

# Database connection
docker-compose exec db psql -U hive -d hive -c "SELECT version();"
```

## Service Details

### Node Server (`node`)

The core HIVE API and intelligence engine.

**Environment variables:**
```yaml
DATABASE_URL: postgresql://hive:hive@db:5432/hive
NODE_ENV: development
PORT: 3001
LOG_LEVEL: info
BATCH_TIMEOUT_MS: 5000
ANOMALY_SENSITIVITY: 0.85
```

**Health endpoint:**
```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 1234.56,
  "database": "connected"
}
```

**Volumes:**
- None in dev (state is ephemeral)

**Networks:**
- `hive-net` (internal Docker network)

### Dashboard (`dashboard`)

Next.js application serving the HIVE UI.

**Environment variables:**
```yaml
NEXT_PUBLIC_NODE_URL: http://localhost:3001
NODE_ENV: development
```

**Access:**
```
http://localhost:3000
```

**Build:**
- Built from `packages/dashboard`
- Uses `.next` for production builds

### Database (`db`)

TimescaleDB (Postgres 15 + time-series extension).

**Credentials:**
```yaml
POSTGRES_USER: hive
POSTGRES_PASSWORD: hive
POSTGRES_DB: hive
```

**Connection:**
```
postgresql://hive:hive@localhost:5432/hive
```

(Change `localhost` to `db` inside Docker network)

**Volumes:**
- `hive-db-data:/var/lib/postgresql/data` (persisted across restarts)

**Init scripts:**
- `docker/init-db.sql` runs on first start (creates hypertables, indexes)

**Access from host:**
```bash
psql postgresql://hive:hive@localhost:5432/hive
```

### Ollama Proxy (`ollama-proxy`)

Ollama instance with HIVE connector intercepting all requests.

**Access:**
```
http://localhost:11434
```

**Supported models:**
- `ollama pull llama2` (2GB)
- `ollama pull mistral` (5GB)
- `ollama pull neural-chat` (5GB)

**HIVE tracking:**
- All `/api/*` endpoints are tracked
- No tracking for `/tags` or `/show` (metadata-only)

**GPU acceleration:**
- If GPU available (NVIDIA), runs on GPU
- Otherwise, CPU mode (slower but functional)

**Data directory:**
- `hive-ollama-data:/root/.ollama` (persisted)

## Environment Variables

### Node Server

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://...` | Postgres connection string |
| `NODE_ENV` | `development` | Environment (development, staging, production) |
| `PORT` | `3001` | Server port |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `BATCH_TIMEOUT_MS` | `5000` | Time to wait before flushing partial batches (ms) |
| `ANOMALY_SENSITIVITY` | `0.85` | Threshold for anomaly scoring (0-1, higher = stricter) |
| `ENABLE_METRICS` | `true` | Enable Prometheus metrics endpoint |

### Dashboard

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_NODE_URL` | `http://localhost:3001` | HIVE Node endpoint (exposed to browser) |
| `NODE_ENV` | `development` | Environment |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `hive` | Database user |
| `POSTGRES_PASSWORD` | `hive` | Database password |
| `POSTGRES_DB` | `hive` | Database name |
| `POSTGRES_INITDB_ARGS` | (empty) | Extra `initdb` args |

## Volumes and Persistence

Default Docker Compose creates named volumes:

```bash
# List all HIVE volumes
docker volume ls | grep hive

# Inspect a volume
docker volume inspect hive_hive-db-data
```

### Database Volume

```yaml
hive-db-data:
  driver: local
```

Stores TimescaleDB data. Persists across `docker-compose restart` or `docker-compose up -d` (unless you `docker-compose down -v`).

### Ollama Volume

```yaml
hive-ollama-data:
  driver: local
```

Stores downloaded models. Useful for keeping models between restarts.

## Networking

All services communicate via internal Docker network `hive-net`:

```yaml
networks:
  hive-net:
    driver: bridge
```

DNS resolution works by service name:
- Dashboard talks to `http://node:3001` (not `localhost`)
- Node talks to database as `postgresql://db:5432`

External access:
- Port `3000` → Dashboard
- Port `3001` → Node API
- Port `5432` → Postgres (if exposed, good for local dev)
- Port `11434` → Ollama

## Profiles

Docker Compose supports profiles for optional services:

```yaml
services:
  ollama-proxy:
    profiles: ["ollama"]
    # ...
```

Start only specific services:

```bash
# Without Ollama
docker-compose up -d

# With Ollama
docker-compose --profile ollama up -d
```

## Logs

Tail logs for all services:

```bash
docker-compose logs -f
```

Specific service:

```bash
docker-compose logs -f node
docker-compose logs -f dashboard
docker-compose logs -f db
```

Follow new logs only:

```bash
docker-compose logs -f --tail 50
```

## Scaling and Resource Limits

### CPU and Memory Limits

For production, add resource limits to `docker-compose.yml`:

```yaml
services:
  node:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
  db:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Database Initialization

On first start, `docker/init-db.sql` runs:

```sql
-- Create hypertables for time-series data
CREATE TABLE IF NOT EXISTS events (
  time TIMESTAMPTZ NOT NULL,
  event_type TEXT,
  provider TEXT,
  tokens_used INTEGER,
  cost_usd NUMERIC,
  department TEXT,
  ...
);

SELECT create_hypertable('events', 'time', if_not_exists => TRUE);

-- Create indexes for common queries
CREATE INDEX ON events (provider, time DESC);
CREATE INDEX ON events (department, time DESC);
```

To add custom initialization:
1. Edit `docker/init-db.sql`
2. Remove the named volume: `docker volume rm hive_hive-db-data`
3. Restart: `docker-compose up -d db`

## Cleanup

Remove all containers and volumes:

```bash
docker-compose down -v
```

Remove only containers (keep data):

```bash
docker-compose down
```

Rebuild images:

```bash
docker-compose build --no-cache
```

## Troubleshooting

**Services fail to start?**
```bash
docker-compose logs
```

Common issues:
- Port already in use: `lsof -i :3000` (macOS/Linux)
- Out of disk space: `docker system df`
- Old volumes conflict: `docker volume rm hive_*`

**Database won't connect?**
```bash
docker-compose exec db psql -U hive -d hive -c "SELECT 1;"
```

If fails, check logs:
```bash
docker-compose logs db
```

**Ollama pulling models?**
```bash
docker-compose exec ollama-proxy ollama pull mistral
```

Models are large (1-7GB). Check progress with:
```bash
docker-compose logs -f ollama-proxy
```

**Dashboard blank or errors?**
- Open browser dev tools (F12)
- Check Network tab for failed requests to `http://localhost:3001`
- Check Node logs: `docker-compose logs node`
- Ensure Node is healthy: `curl http://localhost:3001/health`

---

Next: [Configuration Reference](/getting-started/configuration) or [Architecture Overview](/architecture/overview).
