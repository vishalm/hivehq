# HIVE — Business Model
### Free Forever · Three Revenue Streams · UAE Gov Play

> **Apple Light theme** · Mermaid diagrams · Last updated 2026-04-15

---

## The Core Principle

**Free is not a weakness. Free is the strategy — if one of four plays is the real business.**

The free tier exists to build the data asset, the social graph, and the brand gravity that makes each revenue stream possible. You cannot sell benchmark intelligence without the data. You cannot sell verifications without the identity. You cannot sell the identity without the users. You cannot get the users without free.

---

## The Flywheel

```mermaid
flowchart LR
    A(["Users join free\nPersonal + Org tier"])
    B(["Score becomes real\nIdentity has value"])
    C(["Platforms integrate\nLogin with HIVE"])
    D(["More telemetry\nRicher benchmark data"])
    E(["Benchmarks become\nauthoritative signal"])
    F(["Employers verify\nscores in hiring"])

    A --> B --> C --> D --> E --> F --> A

    style A fill:#007AFF,color:#fff,stroke:none
    style B fill:#5856D6,color:#fff,stroke:none
    style C fill:#34C759,color:#1D1D1F,stroke:none
    style D fill:#FF9500,color:#fff,stroke:none
    style E fill:#FF3B30,color:#fff,stroke:none
    style F fill:#007AFF,color:#fff,stroke:none
```

**This is the LinkedIn flywheel. Except LinkedIn's data is self-reported. HIVE's is machine-verified.**

---

## The Free Product

Everything here is free, forever, with no time limit:

```mermaid
graph TD
    FREE["HIVE Free Tier — Forever"]

    subgraph PERSONAL_FREE ["Personal Tier"]
        PF1["Scout agent install\nmacOS · Windows · Linux · Browser"]
        PF2["Personal AI mirror\n'You made 847 calls this month'"]
        PF3["Model breakdown\nGPT vs Claude vs Gemini mix"]
        PF4["TokenPrint score\nYour personal AI identity"]
        PF5["Public profile\nOptional · your choice"]
    end

    subgraph ORG_FREE ["Org Tier — first 5 scouts free"]
        OF1["One Node Hub\ndocker-compose up · self-hosted"]
        OF2["Org dashboard\nDept breakdown · shadow AI detector"]
        OF3["Team leaderboard\nInternal only"]
        OF4["Audit trail\nCompliance-ready export"]
    end

    FREE --> PERSONAL_FREE
    FREE --> ORG_FREE

    style FREE fill:#007AFF,color:#fff,stroke:none
    style PERSONAL_FREE fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style ORG_FREE fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## Revenue Stream 01 — Identity Infrastructure

**Model: Auth0 for AI identity**

Platforms integrate "Login with HIVE" in one afternoon. HIVE becomes the identity layer for the AI ecosystem.

```mermaid
graph LR
    subgraph S1 ["Stream 01 · Identity Infrastructure"]
        direction TB
        WHAT["Login with HIVE\nOAuth2 · OpenID Connect\nAI-native identity"]
        WHO["Platform integrations\nAny AI app · Any AI tool\nChatGPT wrappers · Coding tools\nAI marketplaces"]
        HOW["Per-MAU pricing\nLike Auth0\nScales with platform growth"]
    end

    subgraph PRICING ["Pricing"]
        P0["Free · 0–1k MAU\n$0"]
        P1["Growth · $0.02/MAU\nSelf-serve"]
        P2["Enterprise · flat contract\nSLA · white-label"]
        P3["Gov/Sovereign · on-prem\nAnnual deal"]
    end

    S1 --> PRICING

    style S1 fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style PRICING fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
```

**The one-switch integration — any AI app adds this in one afternoon:**

```typescript
<HiveLoginButton
  clientId="your_id"
  mode="professional"     // personal | professional | both
  onSuccess={(profile) => {
    // user's full HIVE identity returned:
    // tokenprint_score, badges[], rank, verified_org
    // telemetry flows automatically from this point
  }}
/>
```

**Why platforms pay:** Their users get a richer identity. The platform gets verified AI usage signals. Both benefit. The friction is near-zero.

---

## Revenue Stream 02 — Verified Credentials

**Model: Background check API for AI fluency**

TokenPrint score is machine-verified, node-attested, tamper-evident. Employers pay to verify it. ATS platforms integrate the API.

```mermaid
graph LR
    subgraph S2 ["Stream 02 · Verified Credentials"]
        direction TB
        WHAT2["TokenPrint credential\nPDF + API + shareable link\nMachine-verified · tamper-evident"]
        WHO2["Employers · Recruiters\nHR platforms\nGreenhouse · Workday · Lever\nLinkedIn · ATS systems"]
        HOW2["Per-verification pricing\nBulk API discounts\nATS integrations flat"]
    end

    subgraph PRICING2 ["Pricing"]
        P2_0["Individual share\nFree · PDF + link"]
        P2_1["Single verify\n$2 per lookup"]
        P2_2["Bulk API\n$0.80 per call"]
        P2_3["ATS integration\nmonthly flat rate\nGreenhouse · Workday"]
        P2_4["LinkedIn badge\nrevenue share model"]
    end

    S2 --> PRICING2

    style S2 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style PRICING2 fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
```

**Why this is hard to replicate:** The credential is only worth something if the underlying score is trusted. The score is only trusted because the telemetry is verified. The telemetry is only verified because the Node is on-prem. This chain of trust cannot be faked and cannot be copied by a competitor without the user base.

---

## Revenue Stream 03 — Benchmark Intelligence

**Model: The dataset nobody else has**

Real-time, verified, global AI consumption data. Not surveys. Not estimates. Actual telemetry from real usage, verified by on-prem nodes.

```mermaid
graph TD
    DATA["HIVE Benchmark Dataset\nVerified · Real-time · Global\nNot surveys · Actual telemetry"]

    subgraph PRODUCTS ["Intelligence Products"]
        B1["Sector Adoption Reports\nWhich industries use which models\nHow much · How fast growing"]
        B2["Country AI Index\nGovernment-grade AI ranking\nReal usage · Not self-reported"]
        B3["Model Market Share\nReal consumption share\nNot API pricing volume"]
        B4["Enterprise Benchmarking\n'Your org vs sector average'\nCustom drill-down reports"]
        B5["Academic Research Access\nAnonymised telemetry dataset"]
        B6["Real-time API Feed\nLive consumption signals"]
    end

    subgraph BUYERS ["Buyers"]
        BY1["Strategy consultants\nMcKinsey · BCG · Deloitte"]
        BY2["Governments\nTDRA · Dubai Digital · DIFC"]
        BY3["VCs and investors\nModel bets · Market sizing"]
        BY4["CTOs and CIOs\nBenchmark vs peers"]
        BY5["Universities\nResearch datasets"]
        BY6["Financial analysts\nLive market signals"]
    end

    DATA --> PRODUCTS
    DATA --> BUYERS

    style DATA fill:#FF9500,color:#fff,stroke:none
    style PRODUCTS fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style BUYERS fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
```

### Pricing

| Product | Buyer | Price Range |
|---------|-------|-------------|
| Sector adoption reports | Consultants | $5k–50k / yr |
| Country AI index | Governments | $100k–1M |
| Model market share data | VCs / investors | $20k–200k / yr |
| Enterprise benchmarking | CTOs / CIOs | $10k–50k / yr |
| Academic research access | Universities | $5k–20k / yr |
| Real-time API feed | Analysts | usage-based |

---

## Revenue Stream 04 — UAE Gov Play (Fastest Path)

**Model: Not selling to them — them funding the infrastructure**

This is not a traditional enterprise sale. Federal UAE entities will **pay to host** this data because it serves their AI governance mandate. The leaderboard is a political instrument. Being #1 in AI consumption is a KPI they put in annual reports.

```mermaid
sequenceDiagram
    participant HIVE
    participant TDRA as TDRA / Dubai Digital Authority
    participant ENTITY as UAE Gov Entity (DEWA, RTA, ADNOC)
    participant MIN as Minister / Leadership

    HIVE->>TDRA: Position: AI governance infrastructure\n"Show auditors your AI usage"
    TDRA->>TDRA: AI Strategy 2031 mandate\nNeeds accountability layer

    TDRA->>HIVE: Partnership discussion\n"Can you run this as sovereign infra?"

    HIVE->>TDRA: Sovereign HIVE Node\nOn-prem · UAE data residency\nArabic UI · DIFC/ADGM compliant

    TDRA->>ENTITY: Mandate: join HIVE Open Mode\nAI governance reporting required

    ENTITY->>HIVE: Joins leaderboard · Open Mode
    ENTITY->>ENTITY: AI usage now tracked · verified

    MIN->>MIN: "We are #1 in UAE gov AI adoption"
    MIN->>ENTITY: KPI achieved → annual report
    MIN-->>HIVE: Public endorsement · more entities join

    Note over HIVE: One partnership funds\n3 years of runway
```

### Why this works

```mermaid
graph LR
    subgraph UAE_ADVANTAGE ["The UAE Unfair Advantage"]
        UA1["Government races on AI metrics publicly\nMBZUAI · AI Strategy 2031 · Smart Dubai"]
        UA2["Ministers flex on X about being first\nInstutional, not just personal"]
        UA3["Entities benchmark against each other\nDEWA vs RTA vs ADNOC vs MOHRE"]
        UA4["Leaderboard = political instrument\nAnnual report KPI"]
        UA5["HIVE already has: local entity\nArabic relationships · Wasta"]
    end

    style UAE_ADVANTAGE fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
```

**Local requirements already met:**
- Local entity registration (already have cards)
- Arabic UI (RTL support in Next.js from Phase 1)
- Wasta-friendly sales motion (have the relationships)
- DIFC/ADGM compliance ready out of the box

---

## Revenue Projection Model

```mermaid
xychart-beta
    title "HIVE Revenue Growth Model (Annual)"
    x-axis ["Phase 1\n(M3)", "Phase 2\n(M6)", "Phase 3\n(M9)", "Phase 4\n(M12)", "Phase 5\n(M18)", "Scale\n(M24)"]
    y-axis "ARR (USD)" 0 --> 3000000
    line [0, 0, 0, 50000, 500000, 3000000]
    bar [0, 0, 0, 50000, 500000, 3000000]
```

| Phase | Milestone | ARR Target |
|-------|-----------|-----------|
| Phase 1 (M3) | 1k personal users · 0 revenue | $0 |
| Phase 2 (M6) | 5 UAE orgs | $0 (free tier) |
| Phase 3 (M9) | 1 platform integration · Gov MOU | $0–10k |
| Phase 4 (M12) | First paid verifications · 10k users | $50k ARR |
| Phase 5 (M18) | Benchmark data deal · Gov deal | $500k ARR |
| Scale (M24) | Series A · Global expansion | $3M ARR |

---

## Competitive Moat

```mermaid
graph TD
    MOAT["HIVE Competitive Moat"]

    subgraph LAYER1 ["Layer 1 — Data Moat"]
        M1["Real telemetry from real usage\nNot surveys · Not self-reported\nCannot be replicated without users"]
    end

    subgraph LAYER2 ["Layer 2 — Trust Moat"]
        M2["Open source schema\nZero-knowledge vault\nOn-prem node option\nLegal says yes in 20 min"]
    end

    subgraph LAYER3 ["Layer 3 — Network Moat"]
        M3["Flywheel: users → data → value → users\nLeaderboard only works with critical mass\nUAE gov anchor = cold start solved"]
    end

    subgraph LAYER4 ["Layer 4 — Identity Moat"]
        M4["TokenPrint is portable credential\nFollows user between platforms\nEmployers verify = job market lock-in"]
    end

    MOAT --> LAYER1 --> LAYER2 --> LAYER3 --> LAYER4

    style MOAT fill:#007AFF,color:#fff,stroke:none
    style LAYER1 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style LAYER2 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style LAYER3 fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style LAYER4 fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

---

*See also: [Identity](./identity.md) · [Build Sequence](./build-sequence.md) · [PLAN.md](../PLAN.md)*

---

<sub>HIVE &nbsp;·&nbsp; هايف &nbsp;·&nbsp; הייב &nbsp;·&nbsp; ہائیو &nbsp;·&nbsp; هایو &nbsp;·&nbsp; हाइव &nbsp;·&nbsp; ਹਾਈਵ &nbsp;·&nbsp; হাইভ &nbsp;·&nbsp; ஹைவ் &nbsp;·&nbsp; హైవ్ &nbsp;·&nbsp; හයිව් &nbsp;·&nbsp; ဟိုင်ဗ် &nbsp;·&nbsp; ហ៊ីវ &nbsp;·&nbsp; ไฮฟ์ &nbsp;·&nbsp; 蜂巢 &nbsp;·&nbsp; ハイブ &nbsp;·&nbsp; 하이브 &nbsp;·&nbsp; ჰაივი &nbsp;·&nbsp; Հայվ &nbsp;·&nbsp; Χάιβ &nbsp;·&nbsp; Хайв &nbsp;·&nbsp; ሃይቭ &nbsp;·&nbsp; Colmena &nbsp;·&nbsp; Ruche &nbsp;·&nbsp; Colmeia &nbsp;·&nbsp; Alveare &nbsp;·&nbsp; Kovan &nbsp;·&nbsp; Mzinga &nbsp;·&nbsp; Tổ Ong &nbsp;·&nbsp; Ul</sub>