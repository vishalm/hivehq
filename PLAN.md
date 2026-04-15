# HIVE — Master Plan
### The Global AI Consumption Network · April 2026

> **This document is the north star.** Every architectural decision, every feature prioritisation, every partnership conversation flows back here. If something is not in this plan, it does not get built. If something conflicts with this plan, the plan wins — or the plan gets updated explicitly with a reason.

---

## Table of Contents

1. [The Problem We Are Solving](#1-the-problem-we-are-solving)
2. [The Solution — HIVE](#2-the-solution--hive)
3. [Core Thesis](#3-core-thesis)
4. [System Architecture](#4-system-architecture)
5. [The Trust Covenant](#5-the-trust-covenant)
6. [Technical Stack](#6-technical-stack)
7. [The Connector Protocol](#7-the-connector-protocol)
8. [Identity Architecture](#8-identity-architecture)
9. [The Social Layer](#9-the-social-layer)
10. [Business Model](#10-business-model)
11. [Go-to-Market Strategy](#11-go-to-market-strategy)
12. [Build Sequence](#12-build-sequence)
13. [Success Metrics](#13-success-metrics)
14. [Risks and Mitigations](#14-risks-and-mitigations)
15. [Open Questions](#15-open-questions)
16. [Governance Blockers to Fix First](#16-governance-blockers-to-fix-first)

---

## 1. The Problem We Are Solving

Three real, compounding pain points that no product has addressed together:

### Pain 1 — The CFO Problem
An organisation uses GPT-4, Claude, Gemini, Copilot, and a rogue Mistral deployment someone spun up in AWS. Budget is scattered across six credit cards, three departments, no central visibility. There is no single pane of glass. The CFO cannot answer "how much are we spending on AI?" — not because the data doesn't exist, but because it is fragmented across every team's expense reports.

### Pain 2 — The Compliance Problem
DIFC, ADGM, UAE AI regulations, EU AI Act, US executive orders on AI accountability — all incoming. Auditors will ask "show me your AI usage." Without HIVE, the answer is "we can't." With HIVE, the answer is a signed, node-attested, tamper-evident audit trail.

### Pain 3 — The Shadow AI Problem
People in orgs use personal ChatGPT accounts, expense it, hide it, or simply don't report it. IT has no visibility. The content stays private (and should). But that it happened, which model, how much — that is operational data the org is flying blind without.

### The Synthesis
No product captures all three. Enterprise dashboards (ThoughtSpot, Grafana) are org-internal and require manual instrumentation. AI benchmarks (HuggingFace, Galileo) measure model performance, not human consumption. CIAM tools handle identity for apps, not AI identity as social standing. **The space is empty exactly where HIVE stands.**

---

## 2. The Solution — HIVE

```
Scout  →  Node  →  Hive
```

**Scout** = the lightweight agent on a machine, network, or codebase  
**Node** = the organisation's on-prem hub — aggregates, stores, controls  
**Hive** = the global constellation — benchmarks, leaderboards, identity

HIVE is three things simultaneously:

| Layer | What it is | Analogy |
|-------|-----------|---------|
| **Telemetry network** | Collects AI consumption signals globally | Nielsen ratings for AI |
| **Identity protocol** | Verified AI usage as portable career credential | LinkedIn, but machine-verified |
| **Social platform** | Gamified, public-facing AI consumption leaderboard | Strava for AI usage |

The telemetry-only constraint is not a limitation. It is the product. **You never see their content. Ever. Architecturally impossible.**

---

## 3. Core Thesis

> You are not building a dashboard. You are building **the Nielsen ratings for AI** — social, gamified, and global.

**Why it wins:**

- **Timing**: AI budgets are exploding and CFOs have zero visibility. The audit window is open now.
- **Blue ocean social angle**: Nobody is building Strava for AI. The Wrapped moment, the leaderboard, the badge — all zero competition.
- **TokenPrint as identity**: "I've processed 2B tokens" becomes a LinkedIn badge. That is a career signal employers will pay to verify.
- **Government angle**: Public sector AI accountability is a coming regulatory requirement in UAE, EU, and US. HIVE is the instrument of compliance.
- **The UAE unfair advantage**: Government entities race on AI metrics *publicly*. TDRA, Smart Dubai, MBZUAI — they will pay to host this data because it serves their AI governance mandate. One federal partnership funds three years of runway.

**The flywheel:**

```mermaid
flowchart LR
    A([Users join free]) --> B([Score becomes real\nidentity has value])
    B --> C([Platforms integrate\nHIVE login])
    C --> D([More users · more telemetry\nricher benchmark data])
    D --> E([Benchmarks become\nauthoritative])
    E --> F([Employers verify scores])
    F --> A

    style A fill:#007AFF,color:#fff,stroke:none
    style B fill:#5856D6,color:#fff,stroke:none
    style C fill:#34C759,color:#1D1D1F,stroke:none
    style D fill:#FF9500,color:#fff,stroke:none
    style E fill:#FF3B30,color:#fff,stroke:none
    style F fill:#007AFF,color:#fff,stroke:none
```

This is the LinkedIn flywheel. Except LinkedIn's data is self-reported. **HIVE's is machine-verified.**

---

## 4. System Architecture

### Three-layer topology

```mermaid
graph TB
    subgraph HIVE ["☁  HIVE — constellation (Global SaaS)"]
        direction LR
        MAP[Map View]
        LB[Leaderboard]
        BM[Benchmarks]
        PP[Public Profiles]
        AI[Agent Index]
    end

    subgraph NODE_A ["🏢  NODE A — Dubai HQ (On-prem)"]
        direction TB
        NA_PG[(PostgreSQL\n+ TimescaleDB)]
        NA_RD[(Redis Queue)]
        NA_SH[Shadow AI Detector]
        NA_VT[Vault Key Manager]
    end

    subgraph NODE_B ["🏢  NODE B — Abu Dhabi (On-prem)"]
        direction TB
        NB_PG[(PostgreSQL\n+ TimescaleDB)]
        NB_RD[(Redis Queue)]
        NB_SH[Shadow AI Detector]
        NB_VT[Vault Key Manager]
    end

    subgraph SCOUTS ["🔍  Scout Agents"]
        direction LR
        S1[Network Proxy\nRouter-level]
        S2[Desktop Agent\nmacOS menubar]
        S3[Browser Extension\nShadow AI]
        S4[SDK Wrapper\n@hive/connector]
        S5[Mobile Agent\niOS / Android]
    end

    subgraph CONNECTORS ["🔌  Connector Ecosystem"]
        direction LR
        C1[OpenAI]
        C2[Anthropic]
        C3[Gemini]
        C4[Bedrock]
        C5[Ollama]
        C6[Azure OAI]
        C7[Community...]
    end

    SCOUTS --> NODE_A
    SCOUTS --> NODE_B
    NODE_A <-->|"peer sync\nencrypted"| NODE_B
    NODE_A -->|"encrypted telemetry only\norg-controlled"| HIVE
    NODE_B -->|"encrypted telemetry only\norg-controlled"| HIVE
    CONNECTORS --> SCOUTS

    style HIVE fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style NODE_A fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style NODE_B fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style SCOUTS fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style CONNECTORS fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

### Key architectural principles

1. **Nodes are peers, not subordinates.** No Hub reports to another Hub. They gossip-sync like blockchain nodes. There is no central point of failure below the Hive constellation.

2. **The Scout is the trust boundary.** All encryption happens at the Scout level. The Node never receives plaintext content. The Hive never receives plaintext content. The schema is the covenant.

3. **One language, one runtime.** Pure TypeScript/Node.js monorepo. One brain to hire, one toolchain to maintain, one language to own.

4. **Config, not code, determines deployment mode.** The same codebase runs solo, org, federated, or open mode. Infrastructure is configuration, not a fork.

---

## 5. The Trust Covenant

**This is not a privacy feature. This is the product's legal permission to exist.**

```mermaid
sequenceDiagram
    participant U as User
    participant S as Scout (local)
    participant V as Vault
    participant N as Node Hub
    participant H as Hive

    U->>S: Installs Scout
    U->>V: Pushes API key (plaintext, client only)
    V->>V: Encrypts key with libsodium
    V->>S: Stores encryption key locally
    Note over V: Encrypted blob stored at rest
    Note over S: Decryption key NEVER leaves device

    loop Every 60 seconds
        S->>S: Observe LLM calls
        S->>S: Measure: endpoint, size, latency
        S->>S: Package telemetry (no content, ever)
        S->>S: Encrypt bundle
        S->>N: Push encrypted telemetry
        N->>N: Aggregate by dept / project
        N->>H: Forward anonymised aggregate
    end

    Note over H: Never sees: keys, content, user PII
    Note over N: Never sees: keys, content
    Note over S: Only one that can decrypt
```

**The zero-knowledge guarantee:**
- If Scout is compromised → encrypted blob is useless without local key
- If Vault is breached → ciphertext is useless without Scout's local key
- If Hive is breached → only anonymised aggregates, no org secrets

**Technology: libsodium-wrappers** — the same cryptographic primitive that Signal uses.

**This covenant is open source from day one.** Let anyone audit it. The transparency IS the trust.

---

## 6. Technical Stack

### Monorepo structure

```mermaid
graph LR
    subgraph MONO ["hive/ (Turborepo)"]
        direction TB
        subgraph PKG ["packages/"]
            SCOUT[scout\nNode.js → pkg binary]
            NODE[node-server\nExpress + PGSQL]
            HIVE_S[hive-server\nSupabase adapter]
            DASH[dashboard\nNext.js]
            VAULT[vault\nlibsodium-wrappers]
            SDK[connector-sdk\n@hive/connector npm]
            SHARED[shared\nschema · types · utils]
        end
        subgraph CONN ["connectors/"]
            OAI[openai]
            ANT[anthropic]
            GEM[gemini]
            BED[bedrock]
            OLL[ollama]
            AZR[azure-openai]
        end
        subgraph DOCK ["docker/"]
            COMP[node-compose.yml\nfull on-prem stack]
            SOLO[scout-only.yml\njust the agent]
        end
    end

    style MONO fill:#F5F5F7,stroke:#D2D2D7,color:#1D1D1F
    style PKG fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style CONN fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style DOCK fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

### Stack decisions

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Scout agent** | Node.js + `pkg` | Single binary, cross-platform, same language |
| **Node Hub** | Express + PostgreSQL + TimescaleDB | TimescaleDB is purpose-built for time-series telemetry |
| **Queue** | Bull + Redis | Battle-tested job queue, handles offline Scout buffering |
| **Hive SaaS** | Same codebase + Supabase adapter | No new code — swap the DB adapter |
| **Dashboard** | Next.js | SSR for public profiles, App Router for dashboard |
| **Maps** | Deck.gl | WebGL-accelerated, handles global telemetry maps |
| **Charts** | Recharts | Composable, TypeScript-first |
| **Crypto** | libsodium-wrappers | Gold standard, same as Signal |
| **Monorepo** | Turborepo | Best-in-class for Node.js monorepos |
| **Distribution** | .exe / .pkg / .deb / Docker / npm | Every install target from one build |

### Non-negotiable constraints

1. **TypeScript strict mode everywhere** — `strict: true`, no exceptions
2. **Schema-first** — the telemetry covenant (`packages/shared`) is the source of truth
3. **Vault is client-side only** — `packages/vault` has zero server-side logic
4. **Connectors emit only `HiveConnectorEvent`** — nothing outside the protocol, ever
5. **All secrets via environment variables** — no hardcoded credentials, `.env` in `.gitignore`

---

## 7. The Connector Protocol

**Don't build connectors. Define a protocol and let connectors be community-maintained plugins.**

```mermaid
graph LR
    subgraph SPEC ["@hive/connector — public protocol"]
        EV[HiveConnectorEvent\ntimestamp · provider · model_hint\ndirection · payload_bytes\nlatency_ms · status · session_hash]
    end

    subgraph CORE ["HIVE maintains (core six)"]
        OAI2[connector-openai]
        ANT2[connector-anthropic]
        GEM2[connector-gemini]
        BED2[connector-bedrock]
        OLL2[connector-ollama]
        AZR2[connector-azure-openai]
    end

    subgraph COMM ["Community maintains (long tail)"]
        M[Mistral]
        CO[Cohere]
        GR[Groq]
        TO[Together]
        RE[Replicate]
        LM[LM Studio]
        XX[...]
    end

    SPEC --> CORE
    SPEC --> COMM

    style SPEC fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style CORE fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style COMM fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
```

**The one-line drop-in:**

```typescript
// Before
import openai from 'openai'

// After — zero behaviour change, full telemetry
import { openai } from '@hive/connector-openai'
```

Open source the spec. Community builds connectors. You get ecosystem without hiring 20 engineers.

---

## 8. Identity Architecture

### Three identity types under one cryptographic root

```mermaid
graph TB
    ROOT["🔑 HIVE Account\nOne cryptographic root"]

    subgraph PERSONAL ["Personal ID"]
        P1[Self-sovereign]
        P2[Private vault]
        P3[Optional public]
        P4[Social login]
    end

    subgraph PROFESSIONAL ["Professional ID"]
        PR1[Org-attested]
        PR2[Node-verified]
        PR3[Public standing]
        PR4[SSO / SAML ready]
    end

    subgraph AGENT ["Agent ID"]
        A1[Owner-attested]
        A2[Enrolled via API]
        A3[Public by default]
        A4[Machine-to-machine]
    end

    ROOT --> PERSONAL
    ROOT --> PROFESSIONAL
    ROOT --> AGENT

    style ROOT fill:#007AFF,color:#fff,stroke:none
    style PERSONAL fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style PROFESSIONAL fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style AGENT fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

### CIAM deployment modes

```mermaid
graph LR
    subgraph SOLO_M ["Solo Mode"]
        S_SC[Scout] --> S_PV[Personal Vault]
        S_PV --> S_DS[Local Dashboard]
        Note1["Nothing leaves\nthe device"]
    end

    subgraph ORG_M ["Org Mode"]
        O_SC[Scouts] --> O_ND[Node Hub]
        O_ND --> O_DS[Org Dashboard]
        Note2["Nothing leaves\nthe building"]
    end

    subgraph FED_M ["Federated Mode"]
        F_SC[Scouts] --> F_ND[Node Hub]
        F_ND -->|"anonymised only"| F_HV[Hive]
        Note3["Org sees global\nbenchmarks"]
    end

    subgraph OPEN_M ["Open Mode"]
        OP_SC[Scouts] --> OP_ND[Node Hub]
        OP_ND -->|"named public"| OP_HV[Hive]
        OP_HV --> OP_LB[Leaderboard]
        Note4["UAE gov flex\nFull public profile"]
    end

    style SOLO_M fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style ORG_M fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style FED_M fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style OPEN_M fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

### Personal vs. professional scrubbing

The scrubbing is not just privacy — **it is the product.** User defines rules client-side. Professional bucket is node-attested. Professional score is worth more because it is verified. That is the incentive to consent.

---

## 9. The Social Layer

### TokenPrint score composition

```mermaid
pie title TokenPrint Score Signals
    "Volume (tokens, sessions, frequency)" : 25
    "Breadth (model diversity)" : 20
    "Depth (session complexity, multi-turn)" : 20
    "Consistency (tenure, streak, growth)" : 20
    "Influence (social graph, public posts)" : 5
    "Verified (node-attested professional use)" : 10
```

### The Wrapped Moment
Every year, January 1st, every HIVE user gets their **AI Year in Review.** Most used model. Peak week. Biggest project. Growth since last year. Shareable card. One day a year the whole network posts their card. HIVE trends globally. This is not a feature — it is the annual acquisition event.

### Six identity types in the graph

```mermaid
graph LR
    subgraph HUMAN ["Human Citizens"]
        IND[Individual]
        ORG2[Organisation]
        DEPT[Department / Team]
    end

    subgraph AGENT2 ["Agent Citizens"]
        AUT[Autonomous Agent]
        BOT[Bot Fleet\nMulti-agent]
        SYS[System / Pipeline\nInfrastructure]
    end

    IND -->|"spawns"| AUT
    ORG2 -->|"deploys"| BOT
    DEPT -->|"runs"| SYS

    style HUMAN fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style AGENT2 fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

Nobody has built human + agent citizens in one verified social graph. Not OpenAI. Not Anthropic. Not Google.

---

## 10. Business Model

**Free forever is a strategy when one of these four is the real business:**

```mermaid
graph TB
    FREE["FREE — core product forever\nPersonal + Org dashboard\nTokenPrint score · Social feed"]

    FREE --> S1
    FREE --> S2
    FREE --> S3
    FREE --> S4

    subgraph S1 ["Stream 01 — Identity Infrastructure"]
        I1[Login with HIVE · OAuth]
        I2["Free: 0–1k MAU"]
        I3["Growth: $0.02/MAU"]
        I4["Enterprise: flat contract"]
        I5["Gov/Sovereign: on-prem annual"]
    end

    subgraph S2 ["Stream 02 — Verified Credentials"]
        V1[TokenPrint API]
        V2["Individual share: free"]
        V3["Single verify: $2/lookup"]
        V4["Bulk API: $0.80/call"]
        V5["ATS integration: monthly flat"]
    end

    subgraph S3 ["Stream 03 — Benchmark Intelligence"]
        B1[The dataset nobody else has]
        B2["Sector reports: $5k–50k/yr"]
        B3["Country AI index: $100k–1M"]
        B4["Model market share: $20k–200k/yr"]
        B5["Enterprise benchmarking: $10k–50k/yr"]
    end

    subgraph S4 ["Stream 04 — UAE Gov Play (fastest)"]
        G1[Federal entity partnership]
        G2["Funds infrastructure"]
        G3["Serves AI governance mandate"]
        G4["One deal = 3 years runway"]
    end

    style FREE fill:#007AFF,color:#fff,stroke:none
    style S1 fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style S2 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style S3 fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style S4 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
```

---

## 11. Go-to-Market Strategy

### Phase 0 — UAE First (Weeks 1–4, before writing code)

Talk to 5 IT managers in UAE orgs. One question: *"Do you know how much your org spends on AI APIs across all tools right now?"* Watch their face. That face is the pitch deck.

Target orgs for Phase 0 conversations:
- ADNOC
- DEWA
- RTA
- Smart Dubai / Dubai Digital Authority
- MOHRE
- MBZUAI

### The UAE unfair advantage

```mermaid
sequenceDiagram
    participant HIVE
    participant TDRA as TDRA / Dubai Digital
    participant ENTITY as UAE Gov Entity
    participant MIN as Minister / Leadership

    TDRA->>HIVE: Partnership conversation\n"we need AI governance data"
    HIVE->>TDRA: Deploy sovereign HIVE Node\nFederal-grade, on-prem, Arabic UI
    ENTITY->>HIVE: Join as Open Mode participant
    ENTITY->>ENTITY: AI usage is now tracked, verified
    MIN->>ENTITY: "Show me our AI ranking"
    ENTITY->>MIN: "We are #1 in UAE gov sector"
    MIN-->>HIVE: Posts publicly, creates demand
    HIVE-->>ENTITY: More entities join to compete
    Note over HIVE: Network effect triggered
```

**The leaderboard is a political instrument.** A federal entity at #1 in AI consumption is a KPI they put in their annual report. This is not a feature you pitch — it is a status game they already play.

### Cold start strategy

The leaderboard is only interesting with 100 orgs. With 3 orgs it is embarrassing. The UAE gov angle is **essential, not optional.** If Dubai Municipality is on HIVE from day one, everyone wants to be on it.

---

## 12. Build Sequence

```mermaid
timeline
    title HIVE Build Phases
    section Phase 0 (Weeks 1–4)
        Customer discovery : Talk to 5 UAE IT managers
                           : Validate the CFO problem face
                           : Identify first 3 org pilots
    section Phase 1 (Months 1–3)
        Foundation : packages/shared — schema · types
                   : packages/scout — intercept · log locally
                   : packages/vault — libsodium client-side
                   : packages/connector-sdk — openai · anthropic
                   : packages/dashboard — personal view only
                   : Goal: "847 calls this month" moment
                   : Goal: 1000 personal users who love it
    section Phase 2 (Months 3–6)
        Org Layer : packages/node-server — org Hub
                  : Professional mode + scrubbing
                  : Org dashboard · dept drill-down
                  : Shadow AI detector
                  : Goal: 5 UAE orgs on platform
    section Phase 3 (Months 6–9)
        Identity Protocol : Login with HIVE · OAuth
                          : First platform integration
                          : Public profiles · leaderboard
                          : Goal: 1 major AI app integrates
    section Phase 4 (Months 9–12)
        Credential : Verified credential PDF + API
                   : Employer verification endpoint
                   : ATS integrations — Greenhouse, Workday
                   : Goal: first paid verification
    section Phase 5 (Month 12+)
        Intelligence Layer : packages/hive-server — Supabase
                           : Benchmark reports
                           : UAE gov partnership conversation
                           : Goal: first data deal
```

---

## 13. Success Metrics

### Phase 1 metrics (Month 3 checkpoint)

| Metric | Target | Why |
|--------|--------|-----|
| Personal users | 1,000 | Validates "847 calls" moment |
| Daily active scouts | 200 | Retention signal |
| Connectors live | 2 (OpenAI + Anthropic) | Core coverage |
| NPS | > 50 | Product love before scaling |

### Phase 2 metrics (Month 6 checkpoint)

| Metric | Target | Why |
|--------|--------|-----|
| Orgs on platform | 5 UAE orgs | Cold start solved |
| Scouts per org | > 20 | Real enterprise adoption |
| Shadow AI detected | > 0 events | Validates the problem |
| Node uptime | 99.5% | Enterprise-grade requirement |

### Phase 3 metrics (Month 9 checkpoint)

| Metric | Target | Why |
|--------|--------|-----|
| Platform integrations | 1 | Proves the protocol |
| Public profiles | 500 | Social layer live |
| Leaderboard orgs | 10 | Network effect seeded |
| Gov partnership MOU | 1 | UAE angle validated |

### Phase 4–5 metrics (Month 12+)

| Metric | Target | Why |
|--------|--------|-----|
| Paid verifications | 100 | Revenue model proven |
| Benchmark data deal | 1 | Intelligence layer live |
| Global users | 10,000 | Scale threshold |
| Annual recurring revenue | $500k | Series A ready |

---

## 14. Risks and Mitigations

```mermaid
graph LR
    subgraph HIGH ["High Impact Risks"]
        R1["Privacy backlash\n'You are spying on us'"]
        R2["Enterprise legal says no\nData sovereignty concerns"]
        R3["Cold start leaderboard\nNo orgs = no value"]
        R4["OpenAI blocks interception\nConnector breaks"]
    end

    subgraph MED ["Medium Impact Risks"]
        R5["Strong competitor enters\nMicrosoft / Datadog"]
        R6["UAE gov moves slow\nPartnership delayed"]
        R7["Node complexity\ndocker-compose up fails"]
    end

    subgraph MIT ["Mitigations"]
        M1["Open source the schema\nPublic audit = trust"]
        M2["On-prem Node mode first\nData never leaves building"]
        M3["UAE gov as anchor\nDay-one leaderboard credibility"]
        M4["SDK connector path\nDeveloper installs willingly"]
        M5["TimescaleDB + Redis\nBattle-tested stack, not novel"]
        M6["Phase 0 discovery\nValidate before building"]
    end

    R1 --> M1
    R2 --> M2
    R3 --> M3
    R4 --> M4
    R5 --> M5
    R6 --> M6

    style HIGH fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style MED fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style MIT fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## 15. Open Questions

These must be resolved before Phase 2 begins. Each is a decision point that affects architecture or GTM:

| # | Question | Deadline | Owner |
|---|----------|----------|-------|
| Q1 | Which UAE entity do we approach first — TDRA or Smart Dubai? | End of Phase 0 | GTM |
| Q2 | Do we build the browser extension in Phase 1 or Phase 2? | Month 1 | Engineering |
| Q3 | How do we handle GDPR for EU users if they join before Phase 3 (no formal privacy policy)? | Month 1 | Legal |
| Q4 | Node-to-node peer sync: Gossip protocol or webhook? | Month 2 | Architecture |
| Q5 | Do we open source the full Scout codebase or just the protocol spec? | Month 2 | Product |
| Q6 | What is the Arabic localisation plan — RTL Next.js from day one? | Month 2 | Engineering |
| Q7 | TokenPrint score algorithm — publish the formula or keep it proprietary? | Month 3 | Product |
| Q8 | First platform integration target — which AI app do we approach? | Month 6 | GTM |

---

## 16. Governance Blockers to Fix First

> These are the vibe doctor blockers. Fix them before Phase 1 code ships.

```mermaid
graph TD
    subgraph BLOCK ["🚨 Blocking Violations — Fix Immediately"]
        B1["✗ .env not in .gitignore\n$ echo '.env' >> .gitignore"]
        B2["✗ No environment validation\nAdd Zod schema for env vars"]
        B3["✗ No health check endpoint\nGET /health → 200 + uptime"]
        B4["✗ No test framework\nVitest — config first, tests second"]
        B5["✗ No CI/CD pipeline\nGitHub Actions — lint + test + build"]
        B6["✗ Not in version control\ngit init && git remote add origin"]
        B7["✗ No package.json\nnpm init + Turborepo setup"]
        B8["✗ TypeScript strict mode off\ntsconfig.json strict: true"]
        B9["✗ No linter\nESLint + @typescript-eslint"]
        B10["✗ No README\nThis PLAN.md links to docs/"]
    end

    subgraph WARN ["⚠️  Warnings — Fix in Phase 1"]
        W1["Dependency lockfile\npackage-lock.json committed"]
        W2["Input validation\nZod on all API boundaries"]
        W3["ORM for DB access\nDrizzle ORM — type-safe, lightweight"]
        W4["Structured logging\nPino — JSON logs, not console.log"]
        W5["Containerisation\nDockerfile + docker-compose.yml"]
        W6["Formatter\nPrettier — .prettierrc committed"]
        W7["Git hooks\nHusky + lint-staged"]
        W8["Test coverage threshold\n80% minimum in vitest config"]
    end

    style BLOCK fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style WARN fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

**Priority order:** B6 → B7 → B1 → B8 → B9 → B4 → B5 → B2 → B3 → B10, then warnings.

---

*Last updated: 2026-04-15*  
*Status: Pre-build · Phase 0 customer discovery*  
*Next review: End of Phase 0 (4 weeks)*
