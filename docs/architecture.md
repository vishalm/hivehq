# HIVE — System Architecture
### Scout → Node → Hive · The Global AI Consumption Network

> **Apple Light theme** · Mermaid diagrams · Last updated 2026-04-15

---

## Overview

HIVE is a three-layer distributed telemetry network. Each layer has a single, clear responsibility and communicates with the next layer via an encrypted, minimal, schema-locked payload. **Nothing travels upstream except what the schema permits. Ever.**

```
Scout  →  Node  →  Hive
meter     hub      constellation
```

---

## Full System Architecture

```mermaid
graph TB
    subgraph HIVE_LAYER ["HIVE Constellation — Global SaaS"]
        direction LR
        MAP["Map View\nDeck.gl WebGL"]
        LB["Leaderboard\nReal-time ranks"]
        BM["Benchmarks\nSector · Country · Model"]
        PP["Public Profiles\nTokenPrint · Badges"]
        AI["Agent Index\nAutonomous agent registry"]
        INS["Intelligence\nBenchmark data API"]
    end

    subgraph NODE_A ["NODE — Org A Hub (On-prem · Dubai HQ)"]
        direction TB
        NA_EX["Express API\nHTTP + WebSocket"]
        NA_PG[("PostgreSQL\n+ TimescaleDB")]
        NA_RD[("Redis\nBull Queue")]
        NA_SH["Shadow AI\nDetector"]
        NA_VT["Vault\nKey Manager"]
        NA_SYNC["Peer Sync\nGossip protocol"]
        NA_EX --> NA_PG & NA_RD & NA_SH
        NA_VT -.->|"encrypted keys only"| NA_EX
        NA_SYNC <--> NA_EX
    end

    subgraph NODE_B ["NODE — Org B Hub (On-prem · Abu Dhabi)"]
        direction TB
        NB_EX["Express API"]
        NB_PG[("PostgreSQL\n+ TimescaleDB")]
        NB_RD[("Redis\nBull Queue")]
        NB_SYNC["Peer Sync"]
        NB_EX --> NB_PG & NB_RD
        NB_SYNC <--> NB_EX
    end

    subgraph SCOUTS ["Scout Agents — Interception Layer"]
        direction LR
        S1["Network Proxy\nRouter / firewall level\nOrg-wide coverage"]
        S2["Desktop Agent\nmacOS menubar\nOS network hooks"]
        S3["Browser Extension\nChrome / Firefox\nShadow AI catcher"]
        S4["SDK Wrapper\n@hive/connector\nDeveloper drop-in"]
        S5["Mobile Agent\niOS / Android\n(Phase 4+)"]
    end

    subgraph VAULT_LAYER ["Vault — Zero-Knowledge Key Storage"]
        direction LR
        VS["libsodium-wrappers\nClient-side ONLY\nKey never transmitted"]
        VE["Encrypted blob\nAt rest only\nUseless without Scout key"]
    end

    subgraph CONN_ECO ["Connector Ecosystem — @hive/connector npm spec"]
        direction LR
        OAI["OpenAI"]
        ANT["Anthropic"]
        GEM["Gemini"]
        BED["Bedrock"]
        OLL["Ollama"]
        AZR["Azure OAI"]
        COMM["Community\nMistral · Cohere\nGroq · Together · ..."]
    end

    CONN_ECO -->|"HiveConnectorEvent"| SCOUTS
    VAULT_LAYER -->|"local decryption key"| SCOUTS
    SCOUTS -->|"encrypted telemetry bundles\n60s flush cycle"| NODE_A
    SCOUTS -->|"encrypted telemetry bundles"| NODE_B
    NODE_A <-->|"peer sync · encrypted\ngossip protocol"| NODE_B
    NA_SYNC -->|"anonymised aggregate\norg-controlled"| HIVE_LAYER
    NB_SYNC -->|"anonymised aggregate\norg-controlled"| HIVE_LAYER

    style HIVE_LAYER fill:#F0EEFF,stroke:#5856D6,stroke-width:2px,color:#1D1D1F
    style NODE_A fill:#E8F9F0,stroke:#34C759,stroke-width:1.5px,color:#1D1D1F
    style NODE_B fill:#E8F9F0,stroke:#34C759,stroke-width:1.5px,color:#1D1D1F
    style SCOUTS fill:#F5F5F7,stroke:#86868B,stroke-width:1.5px,color:#1D1D1F
    style VAULT_LAYER fill:#FFE8E8,stroke:#FF3B30,stroke-width:1.5px,color:#1D1D1F
    style CONN_ECO fill:#FFF4E5,stroke:#FF9500,stroke-width:1.5px,color:#1D1D1F
```

---

## Layer 1 — Scout Agents

Scouts are the edge of the network. They live on machines, in routers, in browsers, and in code. They observe, measure, and report. **They never read content. They never transmit content.**

### Four interception methods

```mermaid
graph LR
    subgraph A ["Method A — Network Proxy"]
        A1["Deployed at router / firewall"]
        A2["Sees all LLM-bound traffic org-wide"]
        A3["One install → entire org covered"]
        A4["Enterprise killer feature"]
    end

    subgraph B ["Method B — Desktop Agent"]
        B1["Sits on employee machine"]
        B2["Hooks OS outbound HTTPS"]
        B3["Known LLM domains only"]
        B4["Ships as macOS menubar app first"]
    end

    subgraph C ["Method C — Browser Extension"]
        C1["Captures ChatGPT / Claude.ai / Gemini web"]
        C2["Shadow AI that network proxy misses"]
        C3["Voluntary install"]
        C4["Consumer → enterprise trojan horse"]
    end

    subgraph D ["Method D — SDK Wrapper"]
        D1["import from '@hive/connector-openai'"]
        D2["Zero behaviour change"]
        D3["Full telemetry from line one"]
        D4["Developer-first adoption path"]
    end

    style A fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style B fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style C fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style D fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

### Scout operation loop

```mermaid
sequenceDiagram
    participant LLM as LLM API
    participant SC as Scout Agent
    participant BUF as Local Buffer
    participant ND as Node Hub

    loop Every 60 seconds
        SC->>LLM: Intercepts outbound call (proxy / hook / SDK)
        LLM-->>SC: Response headers + status

        SC->>SC: Observe: endpoint, provider, model hint
        SC->>SC: Measure: payload_bytes, latency_ms, status_code
        SC->>SC: Estimate: tokens from byte size (no content read)
        SC->>SC: Classify: dept_tag, project_tag (from org context)
        SC->>SC: Encrypt telemetry bundle (libsodium)
        SC->>ND: Push encrypted bundle

        alt Hub reachable
            ND-->>SC: Receipt confirmed
            SC->>SC: Delete raw data locally
        else Hub unreachable
            SC->>BUF: Queue encrypted bundle
            Note over BUF: Exponential backoff retry
            Note over BUF: Never lose a data point
        end
    end

    Note over SC,ND: If new LLM endpoint detected → flag unknown connector → alert Hub: shadow AI fired
```

---

## Layer 2 — Node Hubs

Node is the organisation's on-prem hub. It aggregates Scout telemetry, enforces the org's tagging rules, runs the shadow AI detector, and forwards anonymised aggregates upstream to the Hive constellation.

**Critical property: Nodes are peers, not subordinates.** No Hub reports to another Hub in the hierarchy sense. They gossip-sync like blockchain nodes.

### Node internal architecture

```mermaid
graph TD
    IN["Incoming encrypted\nScout bundles"]

    subgraph NODE_INT ["Node Hub — Internal"]
        direction TB
        API["Express API\n:3000"]
        Q["Bull Queue\n+ Redis"]
        PROC["Telemetry Processor\nDecrypt · Validate · Store"]
        TS[("TimescaleDB\nHypertable: telemetry_events")]
        SH["Shadow AI Detector\nUnknown endpoint alert"]
        VK["Vault Key Manager\nOrg API key storage"]
        AGG["Aggregator\nDept · Team · Project rollups"]
        PEER["Peer Sync\nHub ↔ Hub gossip"]
        API --> Q --> PROC --> TS
        PROC --> SH
        VK -.->|"never plaintext"| API
        TS --> AGG
        AGG --> PEER
    end

    OUT_DASH["Org Dashboard\nNext.js"]
    OUT_HIVE["Hive Constellation\nanonymised only"]

    IN --> API
    AGG --> OUT_DASH
    PEER --> OUT_HIVE

    style NODE_INT fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

### Node deployment — one command

```bash
# Full on-prem stack — postgres + timescale + redis + express + dashboard
docker-compose -f docker/node-compose.yml up -d

# Scout only — join an existing org Node
docker-compose -f docker/scout-only.yml up -d
```

---

## Layer 3 — Hive Constellation

The Hive is the global brain. It receives only anonymised, aggregated telemetry from Nodes (or directly from Scouts in Solo mode). It builds the leaderboard, the benchmark dataset, and the public profiles.

```mermaid
graph LR
    subgraph HIVE_INT ["Hive Constellation — Internal (Supabase)"]
        direction TB
        INGRESS["Edge Function\nTelemetry ingress"]
        PG[("Supabase PostgreSQL\nManaged · Scalable")]
        EDGE_AGG["Edge Function\nGlobal aggregator"]
        RANK["Ranking Engine\nTokenPrint calculator"]
        API_PUB["Public API\nBenchmarks · Scores"]

        INGRESS --> PG
        PG --> EDGE_AGG --> RANK
        RANK --> API_PUB
    end

    HIVE_FRONT["Next.js Dashboard\n+ Deck.gl maps"]
    EXT["External\nConsultants · VCs · Gov"]

    HIVE_INT --> HIVE_FRONT
    API_PUB --> EXT

    style HIVE_INT fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

---

## Monorepo Structure

```mermaid
graph LR
    subgraph ROOT ["hive/ — Turborepo root"]
        direction TB
        PKG_JSON["package.json\nturbo.json\ntsconfig.base.json"]

        subgraph PACKAGES ["packages/"]
            SCOUT["scout/\nNode.js → pkg binary\n.exe .pkg .deb .npm"]
            NODE_SRV["node-server/\nExpress · PGSQL · Bull · Redis"]
            HIVE_SRV["hive-server/\nSame code · Supabase adapter"]
            DASH["dashboard/\nNext.js · Deck.gl · Recharts"]
            VAULT["vault/\nlibsodium-wrappers\nclient-side ONLY"]
            SDK["connector-sdk/\n@hive/connector\nnpm package · open spec"]
            SHARED["shared/\ntelemetry.ts · types.ts · utils.ts"]
        end

        subgraph CONNECTORS ["connectors/"]
            C_OAI["openai/"]
            C_ANT["anthropic/"]
            C_GEM["gemini/"]
            C_BED["bedrock/"]
            C_OLL["ollama/"]
            C_AZR["azure-openai/"]
        end

        subgraph DOCKER ["docker/"]
            D1["node-compose.yml"]
            D2["scout-only.yml"]
        end
    end

    SHARED -->|"types"| SCOUT & NODE_SRV & HIVE_SRV & DASH
    SDK -->|"protocol"| CONNECTORS
    VAULT -->|"crypto"| SCOUT

    style ROOT fill:#F5F5F7,stroke:#D2D2D7,color:#1D1D1F
    style PACKAGES fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style CONNECTORS fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style DOCKER fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## Architectural Principles

| Principle | Implementation | Why |
|-----------|---------------|-----|
| **Schema is the covenant** | `packages/shared/src/telemetry.ts` — open sourced day one | Public audit = trust |
| **Client-side crypto only** | `packages/vault` — zero server logic | Architecturally impossible to leak |
| **One language** | TypeScript everywhere, strict mode | One hire profile, one brain |
| **Config not code for modes** | Environment variables drive mode | No forks, no drift |
| **Nodes are peers** | Gossip sync, no hierarchy below Hive | No SPOF in org layer |
| **Connectors are plugins** | `@hive/connector` npm spec | Community builds the long tail |
| **Time-series native** | TimescaleDB hypertables | Query patterns are always time-bounded |

---

*See also: [Data Model](./data-model.md) · [Deployment Modes](./deployment.md) · [PLAN.md](../PLAN.md)*

---

<sub>HIVE &nbsp;·&nbsp; هايف &nbsp;·&nbsp; הייב &nbsp;·&nbsp; ہائیو &nbsp;·&nbsp; هایو &nbsp;·&nbsp; हाइव &nbsp;·&nbsp; ਹਾਈਵ &nbsp;·&nbsp; হাইভ &nbsp;·&nbsp; ஹைவ் &nbsp;·&nbsp; హైవ్ &nbsp;·&nbsp; හයිව් &nbsp;·&nbsp; ဟိုင်ဗ် &nbsp;·&nbsp; ហ៊ីវ &nbsp;·&nbsp; ไฮฟ์ &nbsp;·&nbsp; 蜂巢 &nbsp;·&nbsp; ハイブ &nbsp;·&nbsp; 하이브 &nbsp;·&nbsp; ჰაივი &nbsp;·&nbsp; Հայվ &nbsp;·&nbsp; Χάιβ &nbsp;·&nbsp; Хайв &nbsp;·&nbsp; ሃይቭ &nbsp;·&nbsp; Colmena &nbsp;·&nbsp; Ruche &nbsp;·&nbsp; Colmeia &nbsp;·&nbsp; Alveare &nbsp;·&nbsp; Kovan &nbsp;·&nbsp; Mzinga &nbsp;·&nbsp; Tổ Ong &nbsp;·&nbsp; Ul</sub>