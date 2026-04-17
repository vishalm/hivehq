---
sidebar_position: 2
title: "Docker Compose Reference"
description: "Complete docker-compose.yml configuration for HIVE"
---

# Docker Compose Reference

Standard HIVE Docker Compose setup for local development and production use.

See [Docker Setup](/getting-started/docker) for a detailed walkthrough.

## Quick Start

```bash
# Core stack (postgres, redis, keycloak, node-server, dashboard, ollama-proxy)
docker compose --env-file .env.docker up --build -d

# With CPU Ollama
docker compose --profile cpu --env-file .env.docker up --build -d

# With GPU Ollama
docker compose --profile gpu --env-file .env.docker up --build -d

# Include documentation site
docker compose --profile docs --env-file .env.docker up --build -d

# Include Scout connector agent
docker compose --profile scout --env-file .env.docker up --build -d

# Everything
docker compose --profile full --env-file .env.docker up --build -d
```

## Service Map

```
keycloak-db ──► keycloak ──┐
                           ├──► node-server ──► dashboard
postgres ──────────────────┤                ──► ollama-proxy
redis ─────────────────────┘                ──► scout (profile)

Profiles: ollama-cpu / ollama (gpu) / docs / scout / full
```

## Core Services

### postgres (TimescaleDB)

| Setting | Value |
|---------|-------|
| Image | `timescale/timescaledb:latest-pg16` |
| Port | 5432 |
| Data | `.hive/data/postgres` (bind mount) |
| Credentials | `hive` / `${POSTGRES_PASSWORD:-hive_dev_password}` |

### redis

| Setting | Value |
|---------|-------|
| Image | `redis:7-alpine` |
| Port | 6379 |
| Data | `.hive/data/redis` (bind mount) |

### keycloak-db

Dedicated Postgres for Keycloak identity data.

| Setting | Value |
|---------|-------|
| Image | `postgres:16-alpine` |
| Port | Internal only |
| Data | `hive-keycloak-data` (named volume) |
| Credentials | `keycloak` / `${KEYCLOAK_DB_PASSWORD:-keycloak_dev}` |

### keycloak

OIDC/SSO identity provider. Auto-imports the `hive` realm with roles, clients, and default users on first boot.

| Setting | Value |
|---------|-------|
| Image | `quay.io/keycloak/keycloak:26.0` |
| Port | 8080 |
| Admin | `${KEYCLOAK_ADMIN:-admin}` / `${KEYCLOAK_ADMIN_PASSWORD:-admin}` |
| Realm import | `keycloak/realms/` |

### node-server

TTP ingestion, authentication, intelligence engine, and configuration API.

| Setting | Value |
|---------|-------|
| Build | `Dockerfile.node` |
| Port | 3000 |
| Auth | `HIVE_AUTH_MODE=keycloak` (default) |
| Deployment | `HIVE_DEPLOYMENT_MODE=bespoke` (default) |

### dashboard

Next.js HIVE Dashboard with OIDC login, role-based navigation, and admin UI.

| Setting | Value |
|---------|-------|
| Build | `Dockerfile.dashboard` |
| Port | 3001 |
| SSR endpoint | `DASHBOARD_NODE_URL=http://node-server:3000` |
| Browser endpoint | `NEXT_PUBLIC_NODE_URL=http://localhost:3000` |

### ollama-proxy

Transparent reverse proxy capturing TTP telemetry from all Ollama API calls.

| Setting | Value |
|---------|-------|
| Build | `Dockerfile.proxy` |
| Ports | 11434, 11435 |
| Target | `http://ollama-internal:11434` |

## Environment Variables

All configurable via `.env.docker`:

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `HIVE_AUTH_MODE` | `keycloak` | `keycloak` (production) or `none` (dev bypass) |
| `HIVE_DEPLOYMENT_MODE` | `bespoke` | `bespoke` (single-tenant) or `saas` (multi-tenant) |
| `KEYCLOAK_REALM` | `hive` | Keycloak realm name |
| `KEYCLOAK_CLIENT_SECRET` | `hive-api-secret` | Confidential client secret |
| `KEYCLOAK_ADMIN` | `admin` | Keycloak admin username |
| `KEYCLOAK_ADMIN_PASSWORD` | `admin` | Keycloak admin password |
| `KEYCLOAK_DB_PASSWORD` | `keycloak_dev` | Keycloak DB password |

### Node Server

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_REGION` | `AE` | Node region tag |
| `NODE_ID` | `hive-node-01` | Node identifier |
| `NODE_INGEST_TOKEN` | `hive-dev-token-2026` | Legacy ingest bearer token |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `POSTGRES_PASSWORD` | `hive_dev_password` | TimescaleDB password |

### Dashboard

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_KEYCLOAK_URL` | `http://localhost:8080` | Browser → Keycloak |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | `hive` | Realm name |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | `hive-dashboard` | Public OIDC client |

### Ollama

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_DEFAULT_MODEL` | `llama3.2:3b` | Model to pull on first start |
| `HIVE_DEPT_TAG` | — | Department tag for telemetry |
| `HIVE_PROJECT_TAG` | — | Project tag for telemetry |

### Scout

| Variable | Default | Description |
|----------|---------|-------------|
| `HIVE_CONNECTORS` | `ollama,openai,anthropic` | Enabled connectors |
| `HIVE_DATA_RESIDENCY` | `AE` | Data residency region |
| `HIVE_RETENTION_DAYS` | `90` | Event retention period |

## Volumes

| Volume | Type | Survives `down` | Survives `down -v` |
|--------|------|-----------------|---------------------|
| `.hive/data/postgres` | Bind mount | Yes | Yes (manual rm) |
| `.hive/data/redis` | Bind mount | Yes | Yes (manual rm) |
| `hive-keycloak-data` | Named | Yes | No |
| `hive-ollama-models` | Named | Yes | No |

## Override File

Create `docker-compose.override.yml` for local customization:

```yaml
services:
  node-server:
    environment:
      LOG_LEVEL: debug
      HIVE_AUTH_MODE: none    # Skip Keycloak for rapid dev

  postgres:
    ports:
      - "5432:5432"           # Expose for local psql
```

Docker Compose automatically merges this with the main file.

## Cleanup

```bash
# Stop containers (keep data)
docker compose down

# Stop and remove named volumes
docker compose down -v

# Full reset (all data)
docker compose down -v && rm -rf .hive/data

# Rebuild without cache
docker compose build --no-cache
```

---

Next: [Production Checklist](/deployment/production) or [Contributing](/contributing).
