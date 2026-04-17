---
sidebar_position: 2
title: "Docker Setup"
description: "Complete Docker Compose reference for HIVE"
---

# Docker Setup

HIVE is fully containerized. Docker Compose orchestrates all services with health checks, dependency ordering, and sensible defaults.

## Services Overview

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **postgres** | `timescale/timescaledb:latest-pg16` | 5432 | TimescaleDB event storage |
| **redis** | `redis:7-alpine` | 6379 | Queue and caching |
| **keycloak-db** | `postgres:16-alpine` | — | Keycloak identity database |
| **keycloak** | `keycloak:26.0` | 8080 | OIDC/SSO identity provider |
| **node-server** | `hive:node` | 3000 | TTP ingestion, auth API, intelligence |
| **dashboard** | `hive:dashboard` | 3001 | Next.js HIVE Dashboard |
| **ollama-proxy** | `hive:proxy` | 11434, 11435 | Transparent telemetry proxy |
| **ollama** / **ollama-cpu** | `ollama/ollama` | — | Local LLM runtime (profile) |
| **docs** | `hive:docs` | 3002 | Docusaurus documentation (profile) |
| **scout** | `hive:scout` | — | Connector agent (profile) |

## Quick Start

### 1. Start Core Services

```bash
docker compose --env-file .env.docker up --build -d
```

This boots: postgres, redis, keycloak-db, keycloak, node-server, dashboard, and ollama-proxy.

### 2. Verify Health

```bash
# Node server
curl http://localhost:3000/health

# Keycloak
curl -s http://localhost:8080/health/ready | jq .status

# Dashboard
curl -I http://localhost:3001
```

### 3. Login

Open `http://localhost:3001/login` in a browser. Default development credentials:

| Email | Password | Role |
|-------|----------|------|
| `admin@hive.local` | `admin` | Admin |
| `operator@hive.local` | `operator` | Operator |
| `viewer@hive.local` | `viewer` | Viewer |

These are auto-provisioned in the Keycloak `hive` realm on first boot.

## Profiles

Optional services are activated via Docker Compose profiles:

```bash
# CPU Ollama (no GPU required)
docker compose --profile cpu --env-file .env.docker up --build -d

# GPU Ollama (NVIDIA)
docker compose --profile gpu --env-file .env.docker up --build -d

# Documentation site
docker compose --profile docs --env-file .env.docker up --build -d

# Scout connector agent
docker compose --profile scout --env-file .env.docker up --build -d

# Everything at once
docker compose --profile full --env-file .env.docker up --build -d
```

## Service Details

### Node Server (`node-server`)

The core HIVE API: TTP event ingestion, intelligence engine, auth middleware, and configuration.

**Key environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_PORT` | `3000` | Server port |
| `NODE_DATABASE_URL` | `postgresql://...` | TimescaleDB connection |
| `NODE_REDIS_URL` | `redis://redis:6379` | Redis connection |
| `NODE_INGEST_TOKEN` | `hive-dev-token-2026` | Legacy ingest token |
| `HIVE_AUTH_MODE` | `keycloak` | Auth mode: `keycloak` or `none` |
| `HIVE_DEPLOYMENT_MODE` | `bespoke` | Tenancy: `bespoke` or `saas` |
| `KEYCLOAK_URL` | `http://keycloak:8080` | Keycloak internal URL |
| `KEYCLOAK_CLIENT_ID` | `hive-api` | Confidential OIDC client |

**Health endpoint:** `GET /health`

### Dashboard (`dashboard`)

Next.js application serving the HIVE UI with OIDC authentication.

**Key environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_NODE_URL` | `http://node-server:3000` | SSR → Node (Docker network) |
| `NEXT_PUBLIC_NODE_URL` | `http://localhost:3000` | Browser → Node (host port) |
| `NEXT_PUBLIC_KEYCLOAK_URL` | `http://localhost:8080` | Browser → Keycloak |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | `hive` | Keycloak realm |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | `hive-dashboard` | Public OIDC client |

### Keycloak (`keycloak`)

Enterprise identity provider supporting OIDC, SAML, and social SSO. Realm configuration is auto-imported from `keycloak/realms/` on first boot.

**Admin console:** `http://localhost:8080/admin` (login: `admin` / `admin`)

**Keycloak environment:**

| Variable | Default | Description |
|----------|---------|-------------|
| `KEYCLOAK_ADMIN` | `admin` | Admin console username |
| `KEYCLOAK_ADMIN_PASSWORD` | `admin` | Admin console password |
| `KEYCLOAK_DB_PASSWORD` | `keycloak_dev` | Keycloak database password |

### Database (`postgres`)

TimescaleDB (Postgres 16 with time-series extensions).

**Credentials:**
```
User:     hive
Password: hive_dev_password (override with POSTGRES_PASSWORD)
Database: hive
```

**Connection from host:**
```bash
psql postgresql://hive:hive_dev_password@localhost:5432/hive
```

**Data directory:** `.hive/data/postgres` (bind mount, persists across restarts)

### Ollama Proxy (`ollama-proxy`)

Transparent reverse proxy that intercepts all Ollama API calls and reports TTP telemetry to the Node server. Clients connect to `localhost:11434` as if talking to Ollama directly.

### Scout (`scout`)

Connector agent that runs fetch-level connectors for OpenAI, Anthropic, Ollama, Mistral, Google, Bedrock, and Azure OpenAI. Reports telemetry to the Node server via TTP ingest.

## Volumes and Persistence

| Volume | Type | Location | Purpose |
|--------|------|----------|---------|
| postgres data | Bind mount | `.hive/data/postgres` | Event database |
| redis data | Bind mount | `.hive/data/redis` | Cache |
| `hive-keycloak-data` | Named volume | Docker-managed | Keycloak identity data |
| `hive-ollama-models` | Named volume | Docker-managed | Downloaded LLM models |

```bash
# List HIVE volumes
docker volume ls | grep hive

# Purge Ollama models
docker volume rm hive-ollama-models

# Full cleanup (destroys all data)
docker compose down -v
rm -rf .hive/data
```

## Networking

All services communicate via the `hive` bridge network. DNS resolution by service name:

- Dashboard → `http://node-server:3000`
- Node → `postgresql://postgres:5432`
- Node → `http://keycloak:8080`
- Browser → `http://localhost:3000` (node), `http://localhost:8080` (keycloak)

## Dependency Graph

```
keycloak-db ──► keycloak ──┐
                           ├──► node-server ──► dashboard
postgres ──────────────────┤                ──► ollama-proxy
redis ─────────────────────┘                ──► scout
```

All services wait for their dependencies to be healthy before starting.

## Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f node-server
docker compose logs -f keycloak

# Last 50 lines
docker compose logs -f --tail 50
```

## Troubleshooting

**Keycloak takes a long time to start?**

Keycloak needs 20-40 seconds on first boot to import the realm. The health check has a 30-second start period. Check progress:
```bash
docker compose logs -f keycloak
```

**Node server returns 401?**

Check that `HIVE_AUTH_MODE` is set correctly. For development without Keycloak, set `HIVE_AUTH_MODE=none` in `.env.docker`.

**Port already in use?**

```bash
lsof -i :3000   # Node
lsof -i :3001   # Dashboard
lsof -i :8080   # Keycloak
lsof -i :5432   # Postgres
```

**Database won't connect?**

```bash
docker compose exec postgres psql -U hive -d hive -c "SELECT 1;"
```

**Dashboard blank or 500 errors?**

Check that `NEXT_PUBLIC_NODE_URL` and `NEXT_PUBLIC_KEYCLOAK_URL` point to host-accessible ports (not Docker-internal names).

**Rebuild from scratch?**

```bash
docker compose down -v
rm -rf .hive/data
docker compose --env-file .env.docker up --build -d
```

---

Next: [Configuration Reference](/getting-started/configuration) or [Architecture Overview](/architecture/overview).
