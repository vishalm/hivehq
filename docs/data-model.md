# HIVE — Data Model & Telemetry Schema
### The Covenant · Nothing Outside This. Ever.

> **Apple Light theme** · Mermaid diagrams · Last updated 2026-04-15

---

## The Core Principle

The telemetry schema is not just a data structure. It is a **public legal contract** between HIVE and every user, org, and regulator that trusts the platform. It is open sourced on day one. It is auditable by anyone. The schema IS the trust.

> *"You are not a spy. You are a meter."*

---

## The Telemetry Covenant Schema

```mermaid
erDiagram
    HiveTelemetryEvent {
        string scout_id "hash · rotates monthly · never personal"
        string node_id "org hub identifier · hashed"
        string session_hash "links req+res pair · not the user"
        number timestamp "unix milliseconds"
        string provider "openai · anthropic · gemini · ..."
        string endpoint "eg /v1/chat/completions"
        string model_hint "fingerprinted from response headers"
        string direction "request OR response"
        number payload_bytes "size proxy · never content"
        number latency_ms "response time in ms"
        number status_code "200 · 429 · 500"
        number estimated_tokens "derived from bytes · never from content"
        string dept_tag "OPTIONAL · IT-defined · eg engineering"
        string project_tag "OPTIONAL · org-defined"
        string deployment "solo · node · federated · open"
    }

    HiveConnectorEvent {
        number timestamp "unix ms"
        string node_id "hash"
        string provider "openai · anthropic · ..."
        string model_hint "gpt-4o · claude-3-5-sonnet · unknown"
        string direction "request OR response"
        number payload_bytes ""
        number latency_ms ""
        number status "200 · 429 · 500"
        string session_hash "rotating · links req and res"
    }

    HiveTelemetryEvent ||--|| HiveConnectorEvent : "extends with org context"
```

---

## Field-by-Field Breakdown

```mermaid
graph LR
    subgraph IDENTITY ["Identity Fields — always hashed, never personal"]
        I1["scout_id\nSHA-256 of device fingerprint\nRotates monthly → unlinkable over time"]
        I2["node_id\nOrg hub identifier\nSet by IT during node setup"]
        I3["session_hash\nLinks request + response pair\nNot a user identifier — a session marker"]
    end

    subgraph TIME ["Time"]
        T1["timestamp\nUnix milliseconds\nClient clock · NTP-synced by Scout"]
    end

    subgraph PROVIDER ["Provider Fingerprint"]
        P1["provider\nopenai · anthropic · gemini\nmistral · cohere · bedrock\nazure-openai · ollama · unknown"]
        P2["endpoint\n/v1/chat/completions\n/messages · /generateContent\nExact path — provider fingerprint"]
        P3["model_hint\nFingerprinted from response headers\nX-Model · model field in response\nNot from prompt or content"]
    end

    subgraph SIGNAL ["Signal — what happened"]
        S1["direction\nrequest OR response\nPaired by session_hash"]
        S2["payload_bytes\nHTTP body size\nSize proxy only · content never read"]
        S3["latency_ms\nTime from request to first response byte\nPerformance signal"]
        S4["status_code\n200 = success · 429 = rate limited\n500 = error · 401 = auth failure"]
        S5["estimated_tokens\nDerived: payload_bytes / avg_bytes_per_token\nProvide-specific calibration table\nNEVER from reading content"]
    end

    subgraph CLASS ["Classification — org-defined, optional"]
        C1["dept_tag\nIT sets rules: work email domain\nwork hours → engineering\nfinance · legal · marketing"]
        C2["project_tag\nOptional · org-defined\nProject codes · cost centres"]
    end

    subgraph MODE ["Mode"]
        M1["deployment\nsolo · node · federated · open\nDetermines upstream routing"]
    end

    style IDENTITY fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style TIME fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style PROVIDER fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style SIGNAL fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style CLASS fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style MODE fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

---

## Provider Enum

```mermaid
graph LR
    PROV["Provider type"]

    PROV --> OAI["openai\napi.openai.com"]
    PROV --> ANT["anthropic\napi.anthropic.com"]
    PROV --> GEM["gemini\ngenerativelanguage.googleapis.com"]
    PROV --> MIS["mistral\napi.mistral.ai"]
    PROV --> COH["cohere\napi.cohere.ai"]
    PROV --> BED["bedrock\nbedrock-runtime.*.amazonaws.com"]
    PROV --> AZR["azure-openai\n*.openai.azure.com"]
    PROV --> OLL["ollama\nlocalhost:11434"]
    PROV --> UNK["unknown\nShadow AI trigger\nAlert fired to Node Hub"]

    style PROV fill:#007AFF,color:#fff,stroke:none
    style UNK fill:#FF3B30,color:#fff,stroke:none
```

---

## Data Flow — From API Call to Dashboard

```mermaid
sequenceDiagram
    participant APP as Application Code
    participant CON as @hive/connector-openai
    participant SC as Scout Agent
    participant VT as Vault (local)
    participant ND as Node Hub
    participant TS as TimescaleDB
    participant HV as Hive Constellation
    participant DS as Dashboard

    APP->>CON: openai.chat.completions.create(...)
    CON->>APP: [original call proxied through]

    Note over CON,SC: Connector intercepts — reads headers only

    CON->>SC: HiveConnectorEvent {<br/>  timestamp, provider: 'openai',<br/>  endpoint: '/v1/chat/completions',<br/>  model_hint: 'gpt-4o',<br/>  direction: 'request',<br/>  payload_bytes: 2048,<br/>  latency_ms: 0,<br/>  status: 0,<br/>  session_hash: 'abc123'<br/>}

    SC->>SC: Enrich: add scout_id, node_id, dept_tag
    SC->>SC: Build: HiveTelemetryEvent
    SC->>VT: Sign with local key
    VT-->>SC: Signed + encrypted bundle
    SC->>ND: POST /telemetry [encrypted]

    ND->>ND: Verify signature
    ND->>ND: Decrypt bundle
    ND->>ND: Validate schema (Zod)
    ND->>TS: INSERT INTO telemetry_events (hypertable)

    TS->>ND: Aggregation jobs (Bull queue)
    ND->>ND: Roll up: dept · team · hour · day
    ND->>DS: WebSocket push (org dashboard)
    ND->>HV: POST /aggregate [anonymised only]

    HV->>HV: Global rank recalculation
    HV->>DS: Public leaderboard update
```

---

## Database Schema

### TimescaleDB — Node Hub

```mermaid
erDiagram
    telemetry_events {
        timestamptz timestamp PK "partition key"
        text scout_id "hashed device id"
        text node_id "org hub id"
        text session_hash "req/res linker"
        text provider "provider enum"
        text endpoint "api path"
        text model_hint "fingerprinted"
        text direction "request/response"
        integer payload_bytes ""
        integer latency_ms ""
        integer status_code ""
        integer estimated_tokens ""
        text dept_tag "nullable"
        text project_tag "nullable"
        text deployment_mode ""
    }

    hourly_rollups {
        timestamptz hour PK ""
        text node_id ""
        text provider ""
        text model_hint ""
        text dept_tag ""
        bigint total_calls ""
        bigint total_tokens ""
        bigint total_bytes ""
        float avg_latency_ms ""
        integer error_count ""
        integer rate_limit_count ""
    }

    daily_rollups {
        date day PK ""
        text node_id ""
        text provider ""
        text dept_tag ""
        bigint total_calls ""
        bigint total_tokens ""
        integer unique_scouts ""
        integer model_count ""
    }

    scout_registry {
        text scout_id PK ""
        text node_id ""
        timestamptz first_seen ""
        timestamptz last_seen ""
        text deployment_mode ""
        boolean is_agent "human vs autonomous agent"
    }

    telemetry_events }o--|| hourly_rollups : "aggregated into"
    hourly_rollups }o--|| daily_rollups : "aggregated into"
    telemetry_events }o--|| scout_registry : "registered by"
```

### Supabase — Hive Constellation

```mermaid
erDiagram
    hive_profiles {
        uuid id PK ""
        text hive_handle "@khalid_ai"
        text display_name ""
        text node_id "attesting node"
        integer tokenprint_score ""
        integer global_rank ""
        text country_code ""
        text sector ""
        boolean is_agent ""
        boolean is_verified ""
        timestamptz created_at ""
        timestamptz updated_at ""
    }

    hive_aggregates {
        timestamptz day PK ""
        text node_id PK ""
        text provider ""
        text sector ""
        text country_code ""
        bigint total_calls ""
        bigint total_tokens ""
        integer org_count ""
        text deployment_mode ""
    }

    agent_registry {
        text agent_id PK "agt_xxxxx"
        text owner_hive_id "FK → hive_profiles"
        text org_node ""
        text agent_type "autonomous · supervised · pipeline"
        text model_primary ""
        text purpose ""
        integer tasks_completed ""
        float uptime_percent ""
        integer autonomy_score ""
        timestamptz enrolled_at ""
    }

    badges {
        uuid id PK ""
        text hive_id "FK → hive_profiles"
        text badge_type "genesis · streak · gov-verified · ..."
        text label ""
        timestamptz earned_at ""
    }

    hive_profiles ||--o{ badges : "earns"
    hive_profiles ||--o{ agent_registry : "owns"
    hive_profiles }o--|| hive_aggregates : "contributes to"
```

---

## Token Estimation — No Content Required

A critical privacy property: HIVE **never reads prompt or completion content** to estimate tokens. Estimation is purely byte-based with provider-specific calibration:

```mermaid
graph LR
    subgraph EST ["Token Estimation Algorithm"]
        B["payload_bytes\nfrom HTTP Content-Length"]
        T["estimated_tokens"]
        B -->|"÷ avg_bytes_per_token"| T
    end

    subgraph CAL ["Provider Calibration Table"]
        OAI_C["openai\n~4.2 bytes/token (UTF-8)\nGPT-4 Turbo calibrated"]
        ANT_C["anthropic\n~4.5 bytes/token\nClaude-specific"]
        GEM_C["gemini\n~4.0 bytes/token\nGemini calibrated"]
        OLL_C["ollama\n~4.0 bytes/token\nmodel-dependent"]
    end

    B --> CAL
    CAL --> T

    style EST fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style CAL fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

The calibration table is open source. Researchers and auditors can verify it is not reading content.

---

## What HIVE Will Never Collect

```mermaid
graph TD
    NEVER["NEVER collected · architecturally impossible"]

    NEVER --> N1["Prompt text\nThe question you asked the AI"]
    NEVER --> N2["Completion text\nThe AI's response"]
    NEVER --> N3["API keys in plaintext\nVault encrypts client-side only"]
    NEVER --> N4["User name or email\nAll IDs are hashed and rotating"]
    NEVER --> N5["IP addresses in long-term storage\nUsed for routing only · not stored"]
    NEVER --> N6["Inter-session linking\nscout_id rotates monthly"]
    NEVER --> N7["Personal vs professional conflation\nScrubbing is user-controlled · client-side"]

    style NEVER fill:#FF3B30,color:#fff,stroke:none
    style N1 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style N2 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style N3 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style N4 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style N5 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style N6 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style N7 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
```

---

*See also: [Architecture](./architecture.md) · [Identity](./identity.md) · [PLAN.md](../PLAN.md)*
