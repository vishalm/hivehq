<div align="center">

<img src="logo.svg" width="96" height="96" alt="HIVE Logo" />

<br/>

# HIVE

**The Global AI Consumption Network**

*Scout · Node · Hive — Know exactly how your org uses AI.*

<br/>

[![Status](https://img.shields.io/badge/status-pre--alpha-FF9500?style=flat-square)](https://github.com/vishalm/hivehq)
[![Phase](https://img.shields.io/badge/phase-4%20%E2%80%93%20auth%20%2B%20RBAC-5856D6?style=flat-square)](./docs/build-sequence.md)
[![License](https://img.shields.io/badge/license-MIT-34C759?style=flat-square)](LICENSE)
[![Stack](https://img.shields.io/badge/stack-TypeScript%20%2F%20Node.js-007AFF?style=flat-square)](./docs/architecture.md)
[![Docs](https://img.shields.io/badge/docs-PLAN.md-1D1D1F?style=flat-square)](./PLAN.md)

<br/>

<img src="banner.svg" width="100%" alt="HIVE — The Global AI Consumption Network" />

</div>

---

## The Problem Nobody Has Solved

```
Your org uses GPT-4, Claude, Gemini, Copilot, and a rogue
Mistral deployment someone spun up in AWS.

Budget: scattered across 6 credit cards, 3 departments, zero visibility.
Compliance: auditors ask "show me your AI usage" — you can't.
Shadow AI: 3 employees using personal ChatGPT, expensing it.

There is no single pane of glass.
```

<table>
<tr>
<td align="center" width="33%">

###  The CFO Problem
AI spend scattered across every team's expense reports. Nobody can answer "how much do we spend on AI?"

</td>
<td align="center" width="33%">

###  The Compliance Problem
DIFC, ADGM, EU AI Act, UAE AI regulations — all incoming. You need an audit trail. You don't have one.

</td>
<td align="center" width="33%">

###  The Shadow AI Problem
Personal ChatGPT. Expensed API keys. Rogue Mistral deployments. IT is flying blind.

</td>
</tr>
</table>

---

## TTP — The Open Wire Protocol

> **TTP (Token Telemetry Protocol)** is to AI consumption what OpenTelemetry is to infrastructure observability. One canonical event schema. Any provider. Governance baked into every packet. MIT-licensed open standard — governed by HIVE.

```mermaid
graph LR
    subgraph PROVIDERS ["Any AI Provider"]
        P1["OpenAI"]
        P2["Anthropic"]
        P3["Gemini · Mistral · ..."]
        P4["custom:your-llm"]
    end

    subgraph TTP_LAYER ["TTP Protocol Layer"]
        direction TB
        L5["Layer 5 · Governance — consent · residency · retention"]
        L4["Layer 4 · Identity — signed events · org attestation"]
        L3["Layer 3 · Registry — provider namespace · model fingerprints"]
        L2["Layer 2 · Transport — HTTPS/2 · batch flush · msgpack"]
        L1["Layer 1 · Schema — TTPEvent · canonical JSON · semver"]
    end

    subgraph NETWORK ["HIVE Network"]
        SC["Scout\nReference impl"]
        ND["Node Hub\nOn-prem ingest"]
        HV["Hive\nConstellation"]
    end

    PROVIDERS -->|"@TTP/sdk wrap()"| TTP_LAYER
    TTP_LAYER --> NETWORK

    style TTP_LAYER fill:#F0EEFF,stroke:#5856D6,stroke-width:2px,color:#1D1D1F
    style PROVIDERS fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style NETWORK fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
```

**Key design principle:** `pii_asserted: false` and `content_asserted: false` are protocol-enforced constants. They cannot be set to true. Compliance is structural.

```typescript
// The TTP GovernanceBlock — required on every event, no exceptions
governance: {
  consent_basis:   'org_policy',
  data_residency:  'AE',           // ISO 3166-1 · enforced at Node Hub
  retention_days:  90,
  regulation_tags: ['UAE_AI_LAW', 'GDPR'],
  pii_asserted:    false,          // always false — schema enforced
  content_asserted: false,         // always false — schema enforced
}
```

---

## The Solution — Scout → Node → Hive

```mermaid
graph TB
    subgraph HIVE ["HIVE Constellation — Global SaaS"]
        direction LR
        LB["Leaderboard"]
        BM["Benchmarks"]
        PP["Public Profiles"]
        AI["Agent Index"]
    end

    subgraph NODE ["NODE — Your Org (On-Prem)"]
        direction TB
        EX["Express API"]
        PG[("PostgreSQL\n+ TimescaleDB")]
        SH["Shadow AI Detector"]
        VT["Vault · Zero-Knowledge"]
        EX --> PG & SH
    end

    subgraph SCOUTS ["Scout Agents"]
        direction LR
        S1["Network Proxy\nOrg-wide"]
        S2["Desktop App\nmacOS menubar"]
        S3["Browser Ext\nShadow AI"]
        S4["SDK Wrapper\n@hive/connector"]
    end

    subgraph VAULT ["Zero-Knowledge Vault"]
        V1["libsodium · Client-side only\nKeys never leave your device"]
    end

    VAULT --> SCOUTS
    SCOUTS -->|"encrypted telemetry"| NODE
    NODE -->|"anonymised aggregate\norg-controlled"| HIVE

    style HIVE fill:#F0EEFF,stroke:#5856D6,stroke-width:2px,color:#1D1D1F
    style NODE fill:#E8F9F0,stroke:#34C759,stroke-width:1.5px,color:#1D1D1F
    style SCOUTS fill:#F5F5F7,stroke:#86868B,stroke-width:1.5px,color:#1D1D1F
    style VAULT fill:#FFE8E8,stroke:#FF3B30,stroke-width:1.5px,color:#1D1D1F
```

> **HIVE captures:** who · which model · when · how much · which department  
> **HIVE never captures:** what you asked · what the AI answered · your API keys

---

## The Trust Covenant

```mermaid
sequenceDiagram
    participant U as You
    participant V as Vault (local)
    participant S as Scout (local)
    participant N as Node (on-prem)
    participant H as Hive (cloud)

    U->>V: API key (plaintext · client only)
    V->>V: libsodium encrypt
    V->>S: Encrypted blob + local key
    Note over V,S: Key NEVER transmitted

    loop Every 60 seconds
        S->>S: Observe LLM calls
        S->>S: Measure: endpoint · bytes · latency
        S->>S: Encrypt telemetry bundle
        S->>N: Push encrypted bundle
        N->>H: Anonymised aggregate only
    end

    Note over H: Never sees: keys · content · PII
    Note over N: Never sees: keys · content
    Note over S: Only party that can decrypt
```

**You never see their keys. Ever. Architecturally impossible.** This covenant is open source from day one.

---

## The Telemetry Schema — The Public Contract

```typescript
// packages/shared/src/telemetry.ts — open sourced day one
// This is the covenant. Nothing outside this. Ever.

interface HiveTelemetryEvent {
  // Identity — always hashed, never personal
  scout_id:      string   // hash · rotates monthly
  node_id:       string   // org hub identifier
  session_hash:  string   // links req+res · not the user

  // Time
  timestamp:     number   // unix ms

  // Provider fingerprint
  provider:      Provider // 'openai' | 'anthropic' | 'gemini' | ...
  endpoint:      string   // '/v1/chat/completions'
  model_hint:    string   // fingerprinted from response headers

  // Signal — no content, ever
  direction:       'request' | 'response'
  payload_bytes:   number   // size proxy · never content
  latency_ms:      number
  status_code:     number
  estimated_tokens: number  // derived from bytes · not content

  // Classification — org-defined, optional
  dept_tag?:     string   // 'engineering' | 'finance' | IT-set
  project_tag?:  string   // org-defined cost centre

  // Mode
  deployment: 'solo' | 'node' | 'federated' | 'open'
}

// Nothing else. Ever.
```

---

## Four Deployment Modes

```mermaid
graph LR
    subgraph S ["Mode 1 · SOLO"]
        S1["Scout → Local Dashboard\nNo hub · No cloud\nYour personal AI mirror"]
    end

    subgraph O ["Mode 2 · ORG"]
        O1["Scouts → On-Prem Node\n→ Org Dashboard\nNothing leaves the building"]
    end

    subgraph F ["Mode 3 · FEDERATED"]
        F1["Node → Hive\nAnonymised only\nOrg sees global benchmarks"]
    end

    subgraph P ["Mode 4 · OPEN"]
        P1["Named Public\nLeaderboards · UAE gov flex\nThe political instrument"]
    end

    S -->|"'Can my team\nsee this?'"| O
    O -->|"'How do we\ncompare?'"| F
    F -->|"'We want\nto be #1'"| P

    style S fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style O fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style F fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style P fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

---

## Identity Architecture

```mermaid
graph TB
    ROOT["HIVE Account\nOne cryptographic root"]

    subgraph PERSONAL ["Personal Identity"]
        P1["Self-sovereign · Private vault\nYour personal AI mirror"]
    end

    subgraph PROFESSIONAL ["Professional Identity"]
        PR1["Node-verified · Org-attested\nTokenPrint career credential"]
    end

    subgraph AGENT ["Agent Identity"]
        A1["Owner-attested · Machine-to-machine\nAutonomous agent registry"]
    end

    ROOT --> PERSONAL & PROFESSIONAL & AGENT

    style ROOT fill:#007AFF,color:#fff,stroke:none
    style PERSONAL fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style PROFESSIONAL fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style AGENT fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

### The TokenPrint Score — Your AI Identity Signal

```mermaid
pie title TokenPrint Score Composition
    "Volume · tokens · sessions · frequency" : 25
    "Breadth · model diversity" : 20
    "Depth · session complexity · multi-turn" : 20
    "Consistency · tenure · streak" : 20
    "Verified · node-attested professional" : 10
    "Influence · social graph" : 5
```

---

## Business Model

```mermaid
graph TD
    FREE["FREE — Core Product Forever\nPersonal dashboard · Org on-prem\nTokenPrint score · Social feed"]

    FREE --> S1["Identity Infrastructure\nLogin with HIVE · OAuth2\n$0.02 / MAU — like Auth0"]
    FREE --> S2["Verified Credentials\nTokenPrint API · employer verify\n$2 / lookup · bulk pricing"]
    FREE --> S3["Benchmark Intelligence\nThe dataset nobody else has\n$5k–1M / yr — gov · VC · consultant"]
    FREE --> S4["UAE Gov Partnership\nSovereign node · federal data\nOne deal = 3 years runway"]

    style FREE fill:#007AFF,color:#fff,stroke:none
    style S1 fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style S2 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style S3 fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style S4 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
```

### The Flywheel

```mermaid
flowchart LR
    A(["Users join free"]) --> B(["Score has value"])
    B --> C(["Platforms integrate"])
    C --> D(["Richer data"])
    D --> E(["Authoritative benchmarks"])
    E --> F(["Employers verify"])
    F --> A

    style A fill:#007AFF,color:#fff,stroke:none
    style C fill:#34C759,color:#1D1D1F,stroke:none
    style E fill:#FF9500,color:#fff,stroke:none
```

> This is the LinkedIn flywheel. Except LinkedIn's data is self-reported. **HIVE's is machine-verified.**

---

## Build Sequence

```mermaid
timeline
    title HIVE — 18 Month Roadmap
    section Phase 0 (Wk 1–4)
        Discovery : 5 UAE IT manager conversations
                  : Validate CFO problem · identify pilots
    section Phase 1 (M 1–3)
        Foundation : shared schema · vault · scout
                   : OpenAI + Anthropic connectors
                   : Personal dashboard · Solo mode
                   : Goal — 1000 users · NPS 50+
    section Phase 2 (M 3–6)
        Org Layer : On-prem Node Hub
                  : Professional scrubbing mode
                  : Shadow AI detector
                  : Goal — 5 UAE orgs on platform
    section Phase 3 (M 6–9)
        Identity : Login with HIVE OAuth
                 : Public profiles + leaderboard
                 : UAE gov partnership MOU
    section Phase 4 (M 9–12)
        Credential : Verified credential PDF + API
                   : ATS integrations · LinkedIn badge
                   : Goal — $50k ARR
    section Phase 5 (M 12+)
        Intelligence : Supabase adapter
                     : Benchmark reports · Gov deal
                     : Goal — $500k ARR · Series A
```

---

## The Connector Ecosystem

```mermaid
graph LR
    subgraph SPEC ["@hive/connector — Open Protocol"]
        EV["HiveConnectorEvent\ntimestamp · provider · model_hint\npayload_bytes · latency_ms · status"]
    end

    subgraph CORE ["HIVE Maintains"]
        OAI["connector-openai"]
        ANT["connector-anthropic"]
        GEM["connector-gemini"]
        BED["connector-bedrock"]
        OLL["connector-ollama"]
        AZR["connector-azure-openai"]
    end

    subgraph COMM ["Community Maintains"]
        M["Mistral"]
        CO["Cohere"]
        GR["Groq"]
        TO["Together"]
        XX["...and more"]
    end

    SPEC --> CORE & COMM

    style SPEC fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style CORE fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style COMM fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
```

**One-line SDK drop-in:**

```typescript
// Before
import openai from 'openai'

// After — zero behaviour change, full telemetry
import { openai } from '@hive/connector-openai'
```

---

## Monorepo Structure

```
hive/
├── packages/
│   ├── shared/             ← TTP schema, signatures, audit chain, canonical JSON
│   ├── intelligence/       ← Cost modeling, anomaly detection, forecasting, clustering
│   ├── vault/              ← libsodium-wrappers client-side encryption
│   ├── connector/          ← @hive/connector — TTPCollector + FetchHook base
│   ├── auth/               ← @hive/auth — Keycloak OIDC, RBAC middleware, tenants, API keys, audit
│   ├── policy/             ← @hive/policy — ABAC engine + built-in residency/retention rules
│   ├── otel-bridge/        ← @hive/otel-bridge — OpenTelemetry gen-AI spans → TTP
│   ├── scout/              ← Node.js agent (batch + sign + ship)
│   ├── node-server/        ← Express + Postgres/Timescale + Auth + Prometheus /metrics
│   └── dashboard/          ← Next.js + Recharts + OIDC login + Admin UI
├── connectors/
│   ├── anthropic/          ← @hive/connector-anthropic
│   ├── openai/             ← @hive/connector-openai
│   ├── google/             ← @hive/connector-google (Gemini + Vertex)
│   ├── azure-openai/       ← @hive/connector-azure-openai
│   ├── bedrock/            ← @hive/connector-bedrock
│   ├── mistral/            ← @hive/connector-mistral
│   └── ollama/             ← @hive/connector-ollama (local LLM)
├── docs/
│   └── TTP_SPEC.md         ← Protocol spec v0.1 (MIT, no CLA)
├── .env.local               ← Local dev config (localhost URLs)
├── .env.docker              ← Docker Compose config (network names)
├── .env.example             ← Full reference of all variables
├── keycloak/realms/         ← Keycloak realm config (auto-imported on first boot)
├── docker-compose.yml       ← Full stack: Node + Dashboard + Postgres + Redis + Keycloak + Ollama
├── Dockerfile.node          ← Multi-stage Node server image (includes @hive/auth)
├── Dockerfile.dashboard     ← Multi-stage Next.js standalone image
├── QUICKSTART.md            ← Setup guide with diagrams
└── package.json             ← Turborepo · npm workspaces · 9 packages + 7 connectors
```

### What ships today

- **TTP v0.1** — [`docs/TTP_SPEC.md`](./docs/TTP_SPEC.md). Open wire protocol with Ed25519 batch signatures, canonical JSON, hash-chained audit log, daily Merkle anchors.
- **Connectors** — OpenAI, Anthropic, Google (Gemini + Vertex), Azure OpenAI, Bedrock, Mistral, plus `@hive/otel-bridge` for teams already on OpenTelemetry gen-AI conventions.
- **Policy engine** — `@hive/policy` with ABAC predicates, first-match-wins ordering, and built-in recipes: UAE residency, shadow-AI routing, retention caps, composition.
- **Node server** — Express app with ingest, signature verification, policy admission control, residency enforcement, `/metrics` Prometheus endpoint, Postgres/Timescale store with continuous aggregates.
- **Authentication** — Keycloak OIDC/SSO with PKCE, RBAC (5 roles), multi-tenant isolation (6-level hierarchy), API key management, immutable audit log. Supports bespoke (on-prem) and SaaS deployment modes.
- **Dashboard** — Next.js with recharts: activity timeline, top providers, dept/project split, shadow-AI panel, regulation-tag roll-ups. Admin UI for users, API keys, audit log, and tenant hierarchy.


---

## Why HIVE Is Different

<table>
<tr>
<th>What exists</th>
<th>What they do</th>
<th>Why it's different</th>
</tr>
<tr>
<td>Galileo · HuggingFace · Scale</td>
<td>Benchmark LLM <em>performance</em> on tasks</td>
<td>HIVE measures human + agent <em>consumption identity</em></td>
</tr>
<tr>
<td>ThoughtSpot · Grafana</td>
<td>Org-internal BI, manual instrumentation</td>
<td>HIVE is cross-platform, social, and zero-config</td>
</tr>
<tr>
<td>Auth0 · Okta · CIAM tools</td>
<td>Identity for apps</td>
<td>HIVE is AI identity <em>as social standing</em></td>
</tr>
<tr>
<td>LinkedIn</td>
<td>Self-reported professional identity</td>
<td>HIVE is machine-verified AI fluency</td>
</tr>
</table>

**Nobody has built:** cross-platform AI consumption telemetry as social identity, with human + agent citizens in one verified graph, as a portable career credential.

**The space is empty exactly where HIVE stands.**

---

## Quick Start

Two ways to run HIVE — pick one:

### Docker (recommended)

```bash
git clone https://github.com/vishalm/hivehq.git && cd hivehq
docker compose --env-file .env.docker up --build -d
```

Opens: Dashboard at `http://localhost:3001`, Node API at `http://localhost:3000`, Keycloak at `http://localhost:8080`

Default logins: `admin@hive.local` / `admin`, `operator@hive.local` / `operator`, `viewer@hive.local` / `viewer`

### Local Development

```bash
git clone https://github.com/vishalm/hivehq.git && cd hivehq
npm install
npm run local:setup    # copies .env.local -> .env
npm run dev
```

Requires: Node 20+, PostgreSQL 16, Redis 7 running locally. Set `HIVE_AUTH_MODE=none` in `.env` to bypass Keycloak for local dev.

See **[QUICKSTART.md](./QUICKSTART.md)** for the full guide with architecture diagrams, API examples, and troubleshooting.

### Drop-in Connector

```typescript
// Before — your existing code
import OpenAI from 'openai'

// After — zero behaviour change, full telemetry
import { openai } from '@hive/connector-openai'

const response = await openai.chat.completions.create({ ... })
// Telemetry flows. Nothing else changed.
```

---

## Documentation

| Document | What it covers |
|----------|---------------|
| [**QUICKSTART.md**](./QUICKSTART.md) | Full setup guide · Docker & local · Auth & RBAC · API examples · Troubleshooting |
| [**PLAN.md**](./PLAN.md) | North star · Full strategy · Build sequence · Risk matrix |
| [**AUTH_PLAN.md**](./AUTH_PLAN.md) | Keycloak OIDC/SSO · RBAC roles · Multi-tenant hierarchy · API keys · Audit log |
| [**Protocol — TTP**](./docs/TTP_SPEC.md) | Open wire standard · TTPEvent schema · Governance layer |
| [Architecture](./docs/architecture.md) | Scout → Node → Hive system design · Mermaid diagrams |
| [Data Model](./docs/data-model.md) | Telemetry covenant · DB schema · "never collect" manifest |
| [Identity](./docs/identity.md) | CIAM · TokenPrint · Agent economy · Social layer |
| [Business Model](./docs/business-model.md) | Revenue streams · Flywheel · UAE gov play |
| [Deployment Modes](./docs/deployment.md) | All 4 modes · install paths · upgrade journey |
| [Build Sequence](./docs/build-sequence.md) | Phase 0–5 roadmap · Week 1 start |

---

## The UAE Angle

> **Government entities in the UAE race on AI metrics publicly.** MBZUAI, AI Strategy 2031, Smart Dubai — ministers flex on X about being first. Entities benchmark against each other: DEWA vs RTA vs ADNOC vs MOHRE.

> **The leaderboard is a political instrument.** A federal entity at #1 in AI consumption is a KPI they put in their annual report.

> One strategic partnership with a UAE federal entity funds **three years of runway.**

In Arabic: **خلية** (Khaliya) — it sounds powerful.

---

<div align="center">

**HIVE is pre-alpha. Phase 4 — auth, RBAC, and multi-tenant isolation complete.**

[ Quick Start](./QUICKSTART.md) · [ Read the Plan](./PLAN.md) · [ Architecture](./docs/architecture.md) · [ Business Model](./docs/business-model.md)

<br/>

*Built in UAE · April 2026*

<sub>
HIVE &nbsp;·&nbsp;
هايف &nbsp;·&nbsp;
הייב &nbsp;·&nbsp;
ہائیو &nbsp;·&nbsp;
هایو &nbsp;·&nbsp;
हाइव &nbsp;·&nbsp;
ਹਾਈਵ &nbsp;·&nbsp;
হাইভ &nbsp;·&nbsp;
ஹைவ் &nbsp;·&nbsp;
హైవ్ &nbsp;·&nbsp;
හයිව් &nbsp;·&nbsp;
ဟိုင်ဗ် &nbsp;·&nbsp;
ហ៊ីវ &nbsp;·&nbsp;
ไฮฟ์ &nbsp;·&nbsp;
蜂巢 &nbsp;·&nbsp;
ハイブ &nbsp;·&nbsp;
하이브 &nbsp;·&nbsp;
ჰაივი &nbsp;·&nbsp;
Հայվ &nbsp;·&nbsp;
Χάιβ &nbsp;·&nbsp;
Хайв &nbsp;·&nbsp;
Хайв &nbsp;·&nbsp;
ሃይቭ &nbsp;·&nbsp;
ཧའི་ཝ &nbsp;·&nbsp;
Colmena &nbsp;·&nbsp;
Ruche &nbsp;·&nbsp;
Colmeia &nbsp;·&nbsp;
Alveare &nbsp;·&nbsp;
Kovan &nbsp;·&nbsp;
Mzinga &nbsp;·&nbsp;
Tổ Ong &nbsp;·&nbsp;
Sarang &nbsp;·&nbsp;
Ul &nbsp;·&nbsp;
Ul&#225;n
</sub>

</div>
