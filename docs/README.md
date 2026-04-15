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
│
├── ── Core ────────────────────────────────────────────
├── architecture.md              ← System design · Scout → Node → Hive
├── data-model.md                ← Telemetry schema · The covenant
├── identity.md                  ← CIAM · TokenPrint · Agent economy
├── business-model.md            ← Revenue streams · Flywheel · UAE play
├── deployment.md                ← 4 modes · Solo → Org → Federated → Open
├── build-sequence.md            ← Phase 0–5 · Week 1 start
│
├── ── Protocol ────────────────────────────────────────
├── protocol.md                  ← HATP · The open wire standard · v0.1
├── protocol-versioning.md       ← Version negotiation · Migration · Compat matrix
├── telemetry-edge-cases.md      ← Streaming · Tool use · Multimodal · Dedup
│
└── ── Non-Functional ──────────────────────────────────
    ├── security.md              ← Auth model · Threat model · Supply chain
    ├── key-lifecycle.md         ← Vault · Rotation · Device loss · Revocation
    ├── integrity.md             ← Anti-gaming · Sybil resistance · TokenPrint
    ├── observability.md         ← Health endpoints · Metrics · SLOs · Alerting
    ├── data-lifecycle.md        ← RTBF · Erasure · Retention · GDPR/PDPL
    └── resilience.md            ← Scout buffer · Node HA · Backpressure · RTO/RPO
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
→ Then [protocol.md](./protocol.md) — HATP wire standard  
→ Then [data-model.md](./data-model.md) — the telemetry covenant  
→ Then [deployment.md](./deployment.md) — four modes, one codebase

**If you are building the non-functional layer:**
→ [security.md](./security.md) — auth flows, threat model, rate limiting  
→ [key-lifecycle.md](./key-lifecycle.md) — vault, rotation, revocation  
→ [resilience.md](./resilience.md) — Scout buffer, Node HA, RTO/RPO  
→ [observability.md](./observability.md) — Prometheus metrics, SLOs, alerting  
→ [integrity.md](./integrity.md) — anti-gaming, anomaly detection, sybil

**If you are an enterprise IT manager evaluating HIVE:**
→ Start with [deployment.md](./deployment.md) — Mode 2: Org On-Prem  
→ Then [security.md](./security.md) — auth model and threat model  
→ Then [data-lifecycle.md](./data-lifecycle.md) — GDPR/PDPL, erasure, retention  
→ Then [resilience.md](./resilience.md) — RTO/RPO and HA options

**If you are a government or regulatory stakeholder:**
→ Start with [deployment.md](./deployment.md) — Mode 4: Open  
→ Then [data-lifecycle.md](./data-lifecycle.md) — UAE PDPL, erasure API, audit trail  
→ Then [integrity.md](./integrity.md) — leaderboard legitimacy, attestation  
→ Then [business-model.md](./business-model.md) — the UAE gov partnership play

**If you are a platform developer (integrating Login with HIVE or building connectors):**
→ Start with [protocol.md](./protocol.md) — HATP spec and SDK  
→ Then [telemetry-edge-cases.md](./telemetry-edge-cases.md) — streaming, tool use, multimodal  
→ Then [protocol-versioning.md](./protocol-versioning.md) — version negotiation  
→ Then [identity.md](./identity.md) — Login with HIVE OAuth flow

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

### The Protocol Layer

```
HATPEvent (v0.1)
  ├── Schema layer     → canonical JSON · semver · backward-compat
  ├── Transport layer  → HTTPS/2 · batch flush · msgpack
  ├── Registry layer   → provider namespace · model fingerprints
  ├── Identity layer   → ed25519 signatures · org attestation
  └── Governance layer → GovernanceBlock · required on every event
```

### The Four Deployment Modes

| Mode | Data stays | Who uses it |
|------|-----------|-------------|
| **Solo** | On device only | Personal users, developers |
| **Org** | On-prem Node | Enterprise IT, CISOs |
| **Federated** | On-prem + anonymised to Hive | Enterprises wanting benchmarks |
| **Open** | Named public on Hive | UAE gov entities, flex participants |

### The Revenue Model

| Stream | Model | When |
|--------|-------|------|
| Identity Infrastructure | Auth0-style MAU pricing | Phase 3 |
| Verified Credentials | $2/lookup · bulk API | Phase 4 |
| Benchmark Intelligence | $5k–1M reports | Phase 5 |
| UAE Gov Partnership | Annual sovereign deal | Phase 3 |

---

## Document Status

| Document | Area | Status | Last updated |
|----------|------|--------|-------------|
| [PLAN.md](../PLAN.md) | Strategy | Complete | 2026-04-15 |
| [architecture.md](./architecture.md) | Core | Complete | 2026-04-15 |
| [data-model.md](./data-model.md) | Core | Complete | 2026-04-15 |
| [identity.md](./identity.md) | Core | Complete | 2026-04-15 |
| [business-model.md](./business-model.md) | Core | Complete | 2026-04-15 |
| [deployment.md](./deployment.md) | Core | Complete | 2026-04-15 |
| [build-sequence.md](./build-sequence.md) | Core | Complete | 2026-04-15 |
| [protocol.md](./protocol.md) | Protocol | Complete | 2026-04-15 |
| [protocol-versioning.md](./protocol-versioning.md) | Protocol | Complete | 2026-04-15 |
| [telemetry-edge-cases.md](./telemetry-edge-cases.md) | Protocol | Complete | 2026-04-15 |
| [security.md](./security.md) | Non-functional | Complete | 2026-04-15 |
| [key-lifecycle.md](./key-lifecycle.md) | Non-functional | Complete | 2026-04-15 |
| [integrity.md](./integrity.md) | Non-functional | Complete | 2026-04-15 |
| [observability.md](./observability.md) | Non-functional | Complete | 2026-04-15 |
| [data-lifecycle.md](./data-lifecycle.md) | Non-functional | Complete | 2026-04-15 |
| [resilience.md](./resilience.md) | Non-functional | Complete | 2026-04-15 |
| API reference | Dev | Not started | — |
| Connector development guide | Dev | Not started | — |
| Node deployment runbook | Dev | Not started | — |

---

*HIVE — The Global AI Consumption Network · April 2026*

هايف · הייב · ہائیو · هایو · हाइव · ਹਾਈਵ · হাইভ · ஹைவ் · హైవ్ · හයිව් · ဟိုင်ဗ် · ហ៊ីវ · ไฮฟ์ · 蜂巢 · ハイブ · 하이브 · ჰაივი · Հայվ · Χάιβ · Хайв · ሃይቭ · ཧའི་ཝ · Colmena · Ruche · Colmeia · Alveare · Kovan · Mzinga · Tổ Ong · Sarang · Ul
