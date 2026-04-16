---
sidebar_position: 1
title: "Quickstart"
description: "Get HIVE running in 5 minutes"
---

# Quickstart

Get HIVE up and running in minutes. This guide covers the fastest path to a working dashboard with sample data.

## Prerequisites

- Node.js 20+ (check with `node --version`)
- Docker and Docker Compose (or just Node for in-memory mode)
- 2GB free disk space
- Bash shell

## Option 1: Docker Compose (Recommended)

This is the fastest way to get everything running.

### Step 1: Clone the repository

```bash
git clone https://github.com/vishalm/hivehq.git
cd hivehq
```

### Step 2: Start the stack

```bash
docker-compose up -d
```

This spins up:
- HIVE Node server (`:3001`)
- HIVE Dashboard (`:3000`)
- TimescaleDB (`:5432`)
- Ollama proxy (`:11434`)

Wait 15-20 seconds for services to initialize.

### Step 3: Check health

```bash
curl http://localhost:3001/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2026-04-16T12:34:56Z",
  "version": "0.1.0"
}
```

### Step 4: Open the dashboard

Visit http://localhost:3000 in your browser.

You'll see the HIVE dashboard with:
- KPI cards (tokens consumed, cost, models)
- Cost breakdown by provider and department
- Recent events table
- Setup wizard if first run

### Step 5: Seed sample data (optional)

To populate the dashboard with sample token events:

```bash
npm run seed:data
```

This injects 500+ synthetic AI consumption events spanning 3 months, with:
- Multiple providers (OpenAI, Anthropic, Ollama)
- Department variations
- Cost variations by model
- Anomalies to detect

Refresh the dashboard to see updated KPIs and charts.

### Step 6: Send your first event

Use curl to ingest a real TTP event:

```bash
curl -X POST http://localhost:3001/api/v1/ttp/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "test-batch-001",
    "events": [
      {
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "provider": "openai",
        "model": "gpt-4",
        "tokens_prompt": 50,
        "tokens_completion": 100,
        "department": "engineering",
        "governance": {
          "pii_asserted": false,
          "content_asserted": false,
          "regulation": "none",
          "data_residency": "us-east-1",
          "retention_days": 90
        }
      }
    ]
  }'
```

Refresh the dashboard. Your event should appear in the "Recent Events" table.

## Option 2: Node Standalone

If you prefer not to use Docker:

### Step 1: Install dependencies

```bash
npm install
npm run bootstrap
```

This installs all 19 packages with their dependencies.

### Step 2: Set up local Postgres (optional)

HIVE defaults to SQLite for development. To use Postgres:

```bash
brew install postgresql  # macOS
# OR
sudo apt-get install postgresql  # Linux

createdb hive_dev
```

Set `DATABASE_URL` in `.env.local`:

```bash
DATABASE_URL=postgresql://localhost/hive_dev
```

### Step 3: Migrate database

```bash
npm run migrate
```

### Step 4: Start the Node server

```bash
npm run dev:node
```

Server listens on `http://localhost:3001`.

### Step 5: Start the Dashboard

In a new terminal:

```bash
npm run dev:dashboard
```

Dashboard runs on `http://localhost:3000`.

### Step 6: Install a connector

To send real events, install the OpenAI connector in your app:

```bash
npm install @hive/connector-openai
```

In your app code:

```typescript
import { createOpenAIConnector } from '@hive/connector-openai';
import { createScout } from '@hive/scout';

// Create Scout instance (batches and ships events)
const scout = createScout({
  nodeUrl: 'http://localhost:3001',
  batchSize: 10,
  flushIntervalMs: 5000,
});

// Initialize OpenAI connector
const connector = createOpenAIConnector({
  scout,
  department: 'engineering',
});

// Use connector
const client = connector.createClient({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

Every API call is now tracked and reported to HIVE.

## Verify Installation

Check that all components are working:

```bash
# Node server health
curl http://localhost:3001/health

# Recent events
curl http://localhost:3001/api/v1/events/recent?limit=5

# Intelligence - cost breakdown
curl http://localhost:3001/api/v1/intelligence/cost

# Metrics (Prometheus format)
curl http://localhost:3001/metrics
```

All should return HTTP 200 with JSON responses.

## Next Steps

- **Dashboard tour**: Explore KPIs, charts, filters, and event details
- **Send real events**: Install a connector for your AI provider
- **Configure governance**: Visit Settings in the dashboard to set regulation tags and data residency
- **Enable notifications**: Set up Slack/email alerts for anomalies
- **Read the architecture**: Deep-dive into TTP, governance, and data flow

## Troubleshooting

**Dashboard won't load?**
- Check that Node is healthy: `curl http://localhost:3001/health`
- Check browser console for errors (F12)
- Verify ports 3000 and 3001 are not in use

**Events not appearing?**
- Confirm event payload matches TTP schema: see [TTP Protocol](/architecture/ttp-protocol)
- Check Node logs: `docker-compose logs node`
- Verify `timestamp` is valid ISO 8601 format

**High memory usage?**
- Scout batches events to reduce overhead. Defaults: batch size 10, flush every 5 seconds
- Configure via Scout init options: `batchSize`, `flushIntervalMs`

**Database errors?**
- Ensure Postgres is running (Docker) or created locally
- Check connection string in `.env.local`
- Run `npm run migrate` to initialize schema

---

Ready to dive deeper? Continue to:
- [Docker Setup Guide](/getting-started/docker)
- [Architecture Overview](/architecture/overview)
- [TTP Protocol Specification](/architecture/ttp-protocol)
