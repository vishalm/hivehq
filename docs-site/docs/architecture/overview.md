---
sidebar_position: 1
title: "Architecture Overview"
description: "Three-tier architecture: Connectors, Scout, Node, HIVE Dashboard"
---

# Architecture Overview

HIVE is a three-tier system that transforms invisible AI token consumption into visible, governed, accountable metrics.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Applications                       │
│                                                                 │
│  Your App              Your App              Your App         │
│    (Python)              (Node.js)              (Go)           │
│    │                      │                      │             │
└────┼──────────────────────┼──────────────────────┼─────────────┘
     │                      │                      │
     │ import              │ import               │ import
     │ connector           │ connector            │ connector
     │                      │                      │
┌────▼──────────┬───────────▼────────┬────────────▼──────────────┐
│ Connector SDK │  Connector SDK     │  Connector SDK            │
│ (OpenAI)      │  (Anthropic)       │  (Ollama)                │
│               │                    │                           │
│ Wraps fetch() │ Wraps fetch()      │ Wraps fetch()            │
│ Extracts:     │ Extracts:          │ Extracts:                │
│ - tokens      │ - tokens           │ - tokens                 │
│ - model       │ - model            │ - model                  │
│ - provider    │ - provider         │ - provider               │
│ - latency     │ - latency          │ - latency                │
│ - cost        │ - cost             │ - cost                   │
└────┬──────────┴────────┬───────────┴────────────┬──────────────┘
     │                   │                        │
     │     TTP Events (batched)                   │
     │     (no prompts, no completions)           │
     │                                             │
     └──────────────────────┬──────────────────────┘
                            │
                   ┌────────▼────────┐
                   │ Scout Agent     │
                   │                 │
                   │ - Batches TTP   │
                   │ - Signs (Ed25519)
                   │ - Adds GovernanceBlock
                   │ - Persists locally
                   │ - Ships to Node │
                   └────────┬────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        │   HTTPS Batches (signed)              │
        │   ┌─────────────────────────────┐     │
        │   │ GovernanceBlock             │     │
        │   │ pii_asserted: false         │     │
        │   │ content_asserted: false     │     │
        │   │ regulation: none            │     │
        │   │ data_residency: us-east-1   │     │
        │   │ retention_days: 90          │     │
        │   └─────────────────────────────┘     │
        │                                       │
        ▼
┌───────────────────────────────────────┐
│        HIVE Node (Express.js)         │
│                                       │
│ POST /api/v1/ttp/ingest               │
│                                       │
│ ├─ Validate TTP schema               │
│ ├─ Verify Ed25519 signatures         │
│ ├─ Check GovernanceBlock             │
│ └─ Ingest into TimescaleDB           │
│                                       │
│ Intelligence Engine:                 │
│ ├─ Cost modeling                     │
│ ├─ Anomaly detection                 │
│ ├─ Spend forecasting                 │
│ ├─ Behavioral clustering             │
│ └─ Merkle anchoring                  │
│                                       │
│ REST API:                             │
│ ├─ GET /api/v1/events/recent         │
│ ├─ GET /api/v1/intelligence/cost     │
│ ├─ GET /api/v1/intelligence/forecast │
│ └─ GET /api/v1/metrics (Prometheus)  │
└───────────────────┬───────────────────┘
                    │
      ┌─────────────┼─────────────┐
      │             │             │
      ▼             ▼             ▼
  ┌────────┐  ┌──────────┐  ┌──────────┐
  │ Events │  │ Costs    │  │ Anomalies│
  │ Table  │  │ Table    │  │ Table    │
  └────────┘  └──────────┘  └──────────┘
      │             │             │
      └─────────────┼─────────────┘
                    │
            TimescaleDB
            (Hypertables)
                    │
                    │
              ┌─────▼────────┐
              │ HIVE Dashboard
              │ (Next.js)      │
              │                │
              │ - KPI cards    │
              │ - Cost charts  │
              │ - Event table  │
              │ - Alerts       │
              │ - Chat widget  │
              │                │
              └────────────────┘
```

## The Three Tiers

### Tier 1: Connectors (Application Layer)

Connectors are transparent wrappers around `globalThis.fetch`. They live in your application.

**What they do:**
- Intercept API calls to OpenAI, Anthropic, Ollama, Google, Mistral, Bedrock, Azure
- Extract token counts, models, latency, and costs
- Create TTP events (Token Telemetry Protocol)
- Ship events to Scout for batching

**Key principle:** Zero content. Connectors never read prompts, completions, or API keys. Metadata only.

**Example:**
```typescript
import { createOpenAIConnector } from '@hive/connector-openai';

const connector = createOpenAIConnector({
  scout,
  department: 'engineering',
});

const client = connector.createClient({ apiKey: 'sk-...' });
// Every call is tracked
const response = await client.chat.completions.create({...});
```

**Supported providers:**
- OpenAI (GPT-4, GPT-3.5, Davinci, etc.)
- Anthropic (Claude, Claude Opus, Claude Sonnet)
- Ollama (Llama, Mistral, Phi, etc.)
- Google (PaLM, Gemini)
- Mistral (Mistral 7B, Mixtral)
- AWS Bedrock (Claude via Bedrock, Llama, Titan)
- Azure OpenAI (GPT-4, GPT-3.5 via Azure)

### Tier 2: Scout (Local Agent)

Scout is a Node.js agent that runs in your environment (same process or adjacent).

**What it does:**
- Collects TTP events from connectors
- Batches events (default: 10 events per batch, flush every 5 seconds)
- Creates GovernanceBlock for each batch (freezes `pii_asserted: false`, `content_asserted: false`)
- Signs batches with Ed25519
- Computes Merkle anchors for audit chains
- Persists failed batches locally (SQLite)
- Ships batches to HIVE Node via HTTPS

**Key principle:** Scout never reads content. Only metadata. All payloads are encrypted in transit.

**Features:**
- Automatic retry with exponential backoff
- Local SQLite queue for reliability
- Configurable batch size and flush interval
- Offline mode (queues locally, ships when online)
- Memory-efficient (minimal overhead when idle)

### Tier 3: HIVE Node + Dashboard

HIVE Node is a centralized Express.js server. Dashboard is the UI.

**Node responsibilities:**
- Accept TTP batches at `POST /api/v1/ttp/ingest`
- Validate TTP schema (Zod)
- Verify Ed25519 signatures
- Validate GovernanceBlock (ensure `pii_asserted: false`, `content_asserted: false`)
- Ingest events into TimescaleDB
- Run intelligence analysis (cost modeling, anomalies, forecasting, clustering)
- Expose REST API for dashboard and external clients
- Emit Prometheus metrics

**Intelligence Engine:**
- **Cost Modeling**: Per-token, per-model cost estimation. Tracks USD spend by provider, model, department.
- **Anomaly Detection**: Identifies unusual spend spikes, error rate increases, shadow AI.
- **Spend Forecasting**: Projects monthly burn based on 60-day lookback.
- **Behavioral Clustering**: Groups API calls by behavioral patterns (prompt length, latency, error rate).
- **Department Fingerprinting**: Identifies which departments use which models and providers.

**Dashboard:**
- Real-time KPI cards (total spend, token count, model diversity)
- Cost breakdown charts (by provider, by model, by department)
- Event log with full metadata
- Anomaly alerts and drill-down
- Settings UI for governance and provider config
- HIVE Chat — a data-aware assistant grounded in your consumption data

## Data Flow Example

User sends an OpenAI request in their app:

```
1. App calls OpenAI API via connector
   OpenAI Connector → intercepts call → extracts tokens, model, cost
   
2. Connector creates TTP event
   {
     timestamp: "2026-04-16T12:34:56Z",
     provider: "openai",
     model: "gpt-4",
     tokens_prompt: 100,
     tokens_completion: 50,
     cost_usd: 0.003,
     department: "engineering"
   }
   
3. Scout receives event
   Adds 9 more events, reaches batch size 10 or timeout fires
   
4. Scout creates batch envelope
   {
     signature: "ed25519_sig_...",
     events: [...],
     governance: {
       pii_asserted: false,
       content_asserted: false,
       regulation: "none",
       data_residency: "us-east-1",
       retention_days: 90
     },
     merkle_anchor: "hash_..."
   }
   
5. Scout ships batch to Node via HTTPS POST /api/v1/ttp/ingest
   
6. Node validates
   ├─ Zod schema: valid? ✓
   ├─ Ed25519 sig: valid? ✓
   ├─ GovernanceBlock: compliant? ✓
   └─ Insert into events table
   
7. Intelligence engine runs
   ├─ Cost: +$0.003 to openai total
   ├─ Anomalies: none detected
   ├─ Forecast: updated burn rate
   └─ Clustering: grouped with other gpt-4 calls
   
8. Dashboard updates
   ├─ KPI: +1 event
   ├─ Cost: +$0.003
   ├─ Charts: refresh
   └─ Events table: shows new event
```

## Package Architecture

HIVE consists of 19 packages:

```
@hive/
├── core/
│   ├── ttp-spec          # TTP protocol definition (Zod schemas)
│   ├── types             # TypeScript interfaces
│   └── utils             # Shared utilities
├── scout                 # Local batching and shipping agent
├── node                  # Express API server and intelligence engine
├── dashboard             # Next.js UI
├── intelligence          # Cost modeling, anomalies, forecasting, clustering
├── connector-openai      # OpenAI wrapper
├── connector-anthropic   # Anthropic wrapper
├── connector-ollama      # Ollama wrapper
├── connector-google      # Google wrapper
├── connector-mistral     # Mistral wrapper
├── connector-bedrock     # AWS Bedrock wrapper
├── connector-azure-openai # Azure OpenAI wrapper
├── cli                   # Command-line tools
├── sdk                   # Python/JS/Go SDK libraries
├── config-store          # ConfigStore vault (persists settings)
├── prometheus-exporter   # Metrics endpoint
└── docker                # Docker and Compose files
```

## Key Guarantees

### Zero Content Principle

HIVE never reads prompts, completions, API keys, or any content.

- Connectors extract only: tokens, model, provider, latency, cost, department
- Scout never opens the content of requests/responses
- Node stores only metadata, never content
- Dashboard shows aggregates, never raw requests

This is enforced at the schema level via `z.literal(false)`:

```typescript
const GovernanceBlock = z.object({
  pii_asserted: z.literal(false),        // Not just false, but structurally false
  content_asserted: z.literal(false),    // Cannot be changed at runtime
  regulation: z.enum([...]),
  data_residency: z.string(),
  retention_days: z.number(),
});
```

### Ed25519 Signing

Every batch is signed with Ed25519 before leaving Scout. Node verifies signatures. Batches without valid signatures are rejected.

Enables:
- Auditability: prove origin and integrity
- Non-repudiation: Scout cannot deny sending a batch
- Tamper detection: any modification is detected

### Governance Compliance

GovernanceBlock is immutable and carries:
- Regulation tags (HIPAA, GDPR, SOX, etc.)
- Data residency (us-east-1, eu-west-1, etc.)
- Retention policy (auto-purge after N days)
- PII assertion (always false)
- Content assertion (always false)

Node enforces these. Queries that violate retention policy are blocked.

---

Next: [TTP Protocol Specification](/architecture/ttp-protocol) or [Governance & Compliance](/architecture/governance).
