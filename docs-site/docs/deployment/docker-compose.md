---
sidebar_position: 2
title: "Docker Compose Reference"
description: "Complete docker-compose.yml configuration"
---

# Docker Compose Reference

Standard HIVE Docker Compose setup for local and production use.

See [Docker Setup](/getting-started/docker) for detailed explanation.

This page is a quick reference for all compose options.

## docker-compose.yml

```yaml
version: '3.8'

services:
  node:
    image: hive:node-latest
    container_name: hive-node
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://hive:hive@db:5432/hive
      NODE_ENV: development
      PORT: 3001
      LOG_LEVEL: info
      BATCH_TIMEOUT_MS: 5000
      ANOMALY_SENSITIVITY: 0.85
      ENABLE_METRICS: true
    depends_on:
      db:
        condition: service_healthy
    networks:
      - hive-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  dashboard:
    image: hive:dashboard-latest
    container_name: hive-dashboard
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_NODE_URL: http://localhost:3001
      NODE_ENV: development
    depends_on:
      - node
    networks:
      - hive-net

  db:
    image: timescaledb/timescaledb:latest-pg15
    container_name: hive-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: hive
      POSTGRES_PASSWORD: hive
      POSTGRES_DB: hive
    volumes:
      - hive-db-data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - hive-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hive"]
      interval: 10s
      timeout: 5s
      retries: 5

  ollama-proxy:
    image: hive:ollama-proxy
    container_name: hive-ollama
    ports:
      - "11434:11434"
    profiles:
      - ollama
    volumes:
      - hive-ollama-data:/root/.ollama
    networks:
      - hive-net

volumes:
  hive-db-data:
  hive-ollama-data:

networks:
  hive-net:
    driver: bridge
```

## Environment Variables

### Node Service

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://hive:hive@db:5432/hive` | Postgres connection |
| `NODE_ENV` | `development` | Set to `production` for prod |
| `PORT` | `3001` | Server port |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `BATCH_TIMEOUT_MS` | `5000` | Batch flush timeout |
| `ANOMALY_SENSITIVITY` | `0.85` | Anomaly threshold (0-1) |
| `ENABLE_METRICS` | `true` | Enable Prometheus metrics |

### Dashboard Service

| Variable | Default | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_NODE_URL` | `http://localhost:3001` | Node endpoint (exposed to browser) |
| `NODE_ENV` | `development` | Set to `production` for prod |

### Database Service

| Variable | Default | Notes |
|----------|---------|-------|
| `POSTGRES_USER` | `hive` | Database user |
| `POSTGRES_PASSWORD` | `hive` | Database password |
| `POSTGRES_DB` | `hive` | Database name |

## Override File

Create `docker-compose.override.yml` for local customization:

```yaml
version: '3.8'

services:
  node:
    environment:
      LOG_LEVEL: debug
      ANOMALY_SENSITIVITY: 0.75
    ports:
      - "9090:9090"  # Metrics port

  db:
    ports:
      - "5432:5432"  # For local psql access
```

Docker Compose automatically merges this with the main file.

## Production Example

For production, create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  node:
    image: hive:node-latest
    environment:
      NODE_ENV: production
      LOG_LEVEL: warn
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/hive
      ANOMALY_SENSITIVITY: 0.90
    restart: always
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s

  dashboard:
    image: hive:dashboard-latest
    environment:
      NEXT_PUBLIC_NODE_URL: https://hive-api.mycompany.com
      NODE_ENV: production
    restart: always

  db:
    image: timescaledb/timescaledb:latest-pg15
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: always
    volumes:
      - hive-db-prod:/var/lib/postgresql/data
```

Start:

```bash
export DB_USER=hive_prod
export DB_PASSWORD=$(openssl rand -base64 32)
export DB_HOST=hive-db.internal

docker-compose -f docker-compose.prod.yml up -d
```

---

Next: [Production Checklist](/deployment/production) or [Contributing](/contributing).
