# HIVE Documentation
### The Global AI Consumption Network · Scout → Node → Hive

> Start with [PLAN.md](../PLAN.md). Everything else is a deep-dive.

---

## What is HIVE?

HIVE is three things simultaneously:

| Layer | What it is | Analogy |
|-------|-----------|---------|
| **Telemetry network** | Captures AI consumption signals across any org, any model, any tool | Nielsen ratings for AI |
| **Identity protocol** | Verified AI usage as a portable career credential | LinkedIn, but machine-verified |
| **Social platform** | Gamified, public-facing AI consumption leaderboard | Strava for AI usage |

**The trust covenant:** HIVE captures who, which model, when, how much, and which department. Never the content. Architecturally impossible.

---

## Documentation Map

```
PLAN.md                          ← Start here. The north star.
│
docs/
├── README.md                    ← This file
├── architecture.md              ← System design · Scout → Node → Hive
├── data-model.md                ← Telemetry schema · The covenant
├── identity.md                  ← CIAM · TokenPrint · Agent economy
├── business-model.md            ← Revenue streams · Flywheel · UAE play
├── deployment.md                ← 4 modes · Solo → Org → Federated → Open
└── build-sequence.md            ← Phase 0–5 · Week 1 start
```

---

## Quick Navigation

### By Role

**If you are the founder / product lead:**
→ Start with [PLAN.md](../PLAN.md) — the full north star  
→ Then [business-model.md](./business-model.md) — revenue and flywheel  
→ Then [build-sequence.md](./build-sequence.md) — what to build when

**If you are the lead engineer:**
→ Start with [architecture.md](./architecture.md) — full system design  
→ Then [data-model.md](./data-model.md) — the telemetry covenant  
→ Then [deployment.md](./deployment.md) — four modes, one codebase

**If you are an enterprise IT manager evaluating HIVE:**
→ Start with [deployment.md](./deployment.md) — Mode 2: Org On-Prem  
→ Then [data-model.md](./data-model.md) — what we collect (and don't)  
→ Then [architecture.md](./architecture.md) — the trust covenant

**If you are a government or regulatory stakeholder:**
→ Start with [deployment.md](./deployment.md) — Mode 4: Open  
→ Then [identity.md](./identity.md) — verified credentials + audit trail  
→ Then [business-model.md](./business-model.md) — the UAE gov partnership play

**If you are a platform developer (integrating Login with HIVE):**
→ Start with [identity.md](./identity.md) — the OAuth protocol  
→ Then [data-model.md](./data-model.md) — what flows after integration

---

## Core Concepts at a Glance

### The Topology

```
Scout  →  Node  →  Hive
meter     hub      constellation
```

- **Scout**: lightweight agent — macOS app, browser extension, SDK wrapper, network proxy
- **Node**: org's on-prem hub — Express + PostgreSQL + TimescaleDB + Redis
- **Hive**: global constellation — Supabase, leaderboard, benchmarks, public profiles

### The Four Deployment Modes

| Mode | Data stays | Who uses it |
|------|-----------|-------------|
| **Solo** | On device only | Personal users, developers |
| **Org** | On-prem Node | Enterprise IT, CISOs |
| **Federated** | On-prem + anonymised to Hive | Enterprises wanting benchmarks |
| **Open** | Named public on Hive | UAE gov entities, flex participants |

### The Telemetry Schema (the covenant)

```typescript
interface HiveTelemetryEvent {
  scout_id: string        // hash · rotates monthly
  node_id: string         // org hub identifier
  session_hash: string    // links req+res · not the user
  timestamp: number       // unix ms
  provider: Provider      // openai · anthropic · gemini · ...
  endpoint: string        // /v1/chat/completions
  model_hint: string      // fingerprinted from headers
  direction: 'request' | 'response'
  payload_bytes: number   // size proxy · never content
  latency_ms: number
  status_code: number
  estimated_tokens: number  // derived from bytes · not content
  dept_tag?: string       // optional · IT-defined
  project_tag?: string    // optional · org-defined
  deployment: 'solo' | 'node' | 'federated' | 'open'
}
// Nothing outside this. Ever.
```

### The Revenue Model

| Stream | Model | When |
|--------|-------|------|
| Identity Infrastructure | Auth0-style MAU pricing | Phase 3 |
| Verified Credentials | $2/lookup · bulk API | Phase 4 |
| Benchmark Intelligence | $5k–1M reports | Phase 5 |
| UAE Gov Partnership | Annual sovereign deal | Phase 3 |

---

## Status

| Document | Status | Last updated |
|----------|--------|-------------|
| [PLAN.md](../PLAN.md) | Complete | 2026-04-15 |
| [architecture.md](./architecture.md) | Complete | 2026-04-15 |
| [data-model.md](./data-model.md) | Complete | 2026-04-15 |
| [identity.md](./identity.md) | Complete | 2026-04-15 |
| [business-model.md](./business-model.md) | Complete | 2026-04-15 |
| [deployment.md](./deployment.md) | Complete | 2026-04-15 |
| [build-sequence.md](./build-sequence.md) | Complete | 2026-04-15 |
| API reference | Not started | — |
| Connector development guide | Not started | — |
| Node deployment runbook | Not started | — |

---

*HIVE — The Global AI Consumption Network · هيف · April 2026*
