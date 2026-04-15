# HIVE — Build Sequence
### Phase 0 through Phase 5 · The Opinionated Path

> **Apple Light theme** · Mermaid diagrams · Last updated 2026-04-15

---

## The Guiding Principle

**Talk to 5 IT managers before writing a single line of code.**

Ask one question: *"Do you know how much your org spends on AI APIs across all tools right now?"* Watch their face. That face is the pitch deck. That face is the product validation. That face is the reason Phase 0 exists.

---

## Full Timeline

```mermaid
timeline
    title HIVE Build Sequence — 18 months
    section Phase 0 (Weeks 1–4)
        Before code : 5 UAE IT manager conversations
                    : Validate CFO problem face
                    : Identify 3 pilot orgs
                    : Choose first UAE gov entity to approach
    section Phase 1 (Months 1–3)
        Foundation : packages/shared — telemetry schema
                   : packages/vault — libsodium client-side
                   : packages/scout — macOS menubar MVP
                   : packages/connector-sdk — OpenAI + Anthropic
                   : packages/dashboard — personal view only
                   : Goal: 1000 personal users · NPS > 50
    section Phase 2 (Months 3–6)
        Org Layer : packages/node-server — Express + PGSQL + TimescaleDB
                  : Professional scrubbing mode
                  : Org dashboard + dept drill-down
                  : Shadow AI detector
                  : docker-compose one-command install
                  : Goal: 5 UAE orgs on platform
    section Phase 3 (Months 6–9)
        Identity Protocol : Login with HIVE — OAuth2
                          : Public profiles + leaderboard
                          : First platform integration
                          : UAE gov partnership MOU
                          : Goal: 1 major AI app integrates
    section Phase 4 (Months 9–12)
        Credential : Verified credential PDF + API
                   : Employer verification endpoint
                   : ATS integrations — Greenhouse / Workday
                   : LinkedIn badge partnership
                   : Goal: first paid verification · $50k ARR
    section Phase 5 (Month 12+)
        Intelligence : packages/hive-server — Supabase adapter
                     : Global benchmark reports
                     : UAE gov data partnership
                     : Series A materials
                     : Goal: $500k ARR · first data deal
```

---

## Phase 0 — Customer Discovery (Weeks 1–4)

**Do not write code. Talk to people.**

```mermaid
graph TD
    PH0["Phase 0 — Discovery\nWeeks 1–4"]

    subgraph CONV ["5 Conversations — UAE IT Managers"]
        C1["Conversation 1\nLarge enterprise (ADNOC / DEWA scale)"]
        C2["Conversation 2\nMid-size UAE org (100–500 employees)"]
        C3["Conversation 3\nGov entity (MOHRE / Smart Dubai)"]
        C4["Conversation 4\nStartup / SME (budget-conscious)"]
        C5["Conversation 5\nFinancial sector (DIFC / ADGM compliance)"]
    end

    subgraph LEARN ["What You're Learning"]
        L1["Do they know their AI spend?\n(Hypothesis: no)"]
        L2["Who owns the AI budget?\n(CFO vs IT vs dept heads)"]
        L3["What's the compliance anxiety?\n(DIFC? ADGM? Data residency?)"]
        L4["Would they install on-prem?\n(Or does SaaS work?)"]
        L5["Who would champion this internally?\n(IT Manager vs CISO vs CFO)"]
    end

    subgraph DECIDE ["Phase 0 Decision Gate"]
        D1["First UAE gov entity to approach\nTDRA vs Smart Dubai vs DIFC"]
        D2["Browser extension in Phase 1 or 2?\n(Scope decision)"]
        D3["GDPR approach for EU users\n(Legal decision)"]
        D4["On-prem first or SaaS first?\n(GTM decision)"]
    end

    PH0 --> CONV --> LEARN --> DECIDE

    style PH0 fill:#007AFF,color:#fff,stroke:none
    style CONV fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style LEARN fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style DECIDE fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

---

## Phase 1 — Foundation (Months 1–3)

**Goal: The "847 calls" moment. 1,000 personal users who love it.**

```mermaid
graph TD
    PH1["Phase 1 — Foundation\nMonths 1–3"]

    subgraph BUILD1 ["What to build"]
        direction LR
        B1_1["packages/shared\ntelemetry.ts — the covenant\nAll types · All schemas\nOpen sourced day one"]
        B1_2["packages/vault\nlibsodium-wrappers\nClient-side ONLY\nZero server logic"]
        B1_3["packages/scout\nmacOS menubar app FIRST\nObserves outbound LLM calls\nFlushes every 60s"]
        B1_4["packages/connector-sdk\n@hive/connector npm spec\nOpenAI connector\nAnthropic connector"]
        B1_5["packages/dashboard\nPersonal view only\nLocalhost:3000\nLocal SQLite in Solo mode"]
    end

    subgraph DONE1 ["Definition of Done"]
        D1_1["User installs Scout macOS menubar"]
        D1_2["Makes 10 ChatGPT calls"]
        D1_3["Opens dashboard"]
        D1_4["Sees: '10 calls · 2 models · $0.84 estimated'"]
        D1_5["Says: 'Wait, I didn't know this'"]
    end

    subgraph METRIC1 ["Phase 1 Metrics — Month 3 Gate"]
        M1_1["1,000 personal users\nvia Product Hunt + Twitter + UAE network"]
        M1_2["NPS > 50\nProduct love before scaling"]
        M1_3["2 connectors live\nOpenAI + Anthropic"]
        M1_4["200 daily active scouts\nRetention signal"]
    end

    PH1 --> BUILD1 --> DONE1 --> METRIC1

    style PH1 fill:#34C759,color:#1D1D1F,stroke:none
    style BUILD1 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style DONE1 fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style METRIC1 fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

### Phase 1 package build order

```mermaid
graph LR
    S1["1. packages/shared\nSchema first\nEverything depends on this"]
    S2["2. packages/vault\nCrypto layer\nScout depends on this"]
    S3["3. packages/connector-sdk\nProtocol spec\nConnectors depend on this"]
    S4["4. connectors/openai\nFirst working connector"]
    S5["5. connectors/anthropic\nSecond connector"]
    S6["6. packages/scout\nWires vault + connectors\nmacOS menubar binary"]
    S7["7. packages/dashboard\nPersonal view\nlocalhost only"]

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7

    style S1 fill:#007AFF,color:#fff,stroke:none
    style S2 fill:#FF3B30,color:#fff,stroke:none
    style S3 fill:#FF9500,color:#fff,stroke:none
    style S4 fill:#34C759,color:#1D1D1F,stroke:none
    style S5 fill:#34C759,color:#1D1D1F,stroke:none
    style S6 fill:#5856D6,color:#fff,stroke:none
    style S7 fill:#5856D6,color:#fff,stroke:none
```

---

## Phase 2 — Org Layer (Months 3–6)

**Goal: 5 UAE orgs on the platform.**

```mermaid
graph TD
    PH2["Phase 2 — Org Layer\nMonths 3–6"]

    subgraph BUILD2 ["What to build"]
        B2_1["packages/node-server\nExpress API\nPGSQL + TimescaleDB\nBull + Redis queue\ndocker-compose up"]
        B2_2["Professional scrubbing mode\nWork vs personal rules\nClient-side · user-defined\nOrg IT sets baseline"]
        B2_3["Org dashboard\nDept breakdown\nShadow AI detector\nBudget rollup by team\nAudit trail export"]
        B2_4["Scout enrollment flow\n'Join your org's Node'\nOne link · zero config"]
    end

    subgraph DONE2 ["Definition of Done"]
        D2_1["IT Manager runs docker-compose up"]
        D2_2["Generates enrollment link"]
        D2_3["Sends to 20 employees"]
        D2_4["Sees org dashboard in < 1 hour\n'Engineering uses 4x more than Finance'"]
        D2_5["Shadow AI fires:\n'groq.com detected — 3 employees'"]
    end

    subgraph METRIC2 ["Phase 2 Metrics — Month 6 Gate"]
        M2_1["5 UAE orgs on platform\nCold start solved"]
        M2_2["> 20 scouts per org\nReal enterprise adoption"]
        M2_3["> 0 shadow AI events\nValidates the problem"]
        M2_4["Node uptime > 99.5%\nEnterprise-grade"]
    end

    PH2 --> BUILD2 --> DONE2 --> METRIC2

    style PH2 fill:#5856D6,color:#fff,stroke:none
    style BUILD2 fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style DONE2 fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style METRIC2 fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

---

## Phase 3 — Identity Protocol (Months 6–9)

**Goal: Login with HIVE live. 1 major AI app integrates. UAE gov MOU signed.**

```mermaid
graph TD
    PH3["Phase 3 — Identity Protocol\nMonths 6–9"]

    subgraph BUILD3 ["What to build"]
        B3_1["Login with HIVE\nOAuth2 + OpenID Connect\nHiveLoginButton component\nPlatform SDK"]
        B3_2["Public profiles\n@handle system\nTokenPrint score live\nBadge display"]
        B3_3["Leaderboard\nGlobal · Country · Sector\nOrg-level + individual\nAnonymised in federated mode"]
        B3_4["UAE gov partnership\nSovereign node deployment\nArabic RTL UI\nDIFC/ADGM compliance docs"]
    end

    subgraph GTM3 ["GTM — Phase 3"]
        G3_1["Approach target AI apps\nCoding assistants\nAI productivity tools\nAI API wrappers"]
        G3_2["TDRA / Smart Dubai\nPartnership conversation\nData residency pitch\nSovereign node"]
        G3_3["Launch on Product Hunt\nPublic profiles go live\nLeaderboard seed"]
    end

    subgraph METRIC3 ["Phase 3 Metrics — Month 9 Gate"]
        M3_1["1 platform integration\nProves OAuth protocol works"]
        M3_2["500 public profiles\nSocial layer live"]
        M3_3["10 orgs on leaderboard\nNetwork effect seeded"]
        M3_4["1 gov partnership MOU\nUAE angle validated"]
    end

    PH3 --> BUILD3 & GTM3 --> METRIC3

    style PH3 fill:#FF9500,color:#fff,stroke:none
    style BUILD3 fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style GTM3 fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style METRIC3 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## Phase 4 — Credential (Months 9–12)

**Goal: First paid verification. $50k ARR.**

```mermaid
graph TD
    PH4["Phase 4 — Credential\nMonths 9–12"]

    subgraph BUILD4 ["What to build"]
        B4_1["Verified credential PDF\nPrint-ready · shareable\nCredential hash on-chain\nVerify at hive.io/verify/0x..."]
        B4_2["Employer verification API\nPOST /verify · returns score + badges\n$2 per lookup\nBulk pricing"]
        B4_3["ATS integrations\nGreenhouse webhook\nWorkday API\nLever integration"]
        B4_4["LinkedIn badge partnership\nRevenue share model\nBadge shows on profile\nVerified signal"]
    end

    subgraph METRIC4 ["Phase 4 Metrics — Month 12 Gate"]
        M4_1["100 paid verifications\nRevenue model proven"]
        M4_2["$50k ARR\nFirst meaningful revenue"]
        M4_3["1 ATS integration live\nEnterprise pipeline"]
        M4_4["10k users globally\nScale threshold"]
    end

    PH4 --> BUILD4 --> METRIC4

    style PH4 fill:#FF3B30,color:#fff,stroke:none
    style BUILD4 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style METRIC4 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## Phase 5 — Intelligence Layer (Month 12+)

**Goal: $500k ARR. First benchmark data deal. Series A ready.**

```mermaid
graph TD
    PH5["Phase 5 — Intelligence Layer\nMonth 12+"]

    subgraph BUILD5 ["What to build"]
        B5_1["packages/hive-server\nSupabase adapter\nSame Node codebase\nManaged cloud version"]
        B5_2["Benchmark report engine\nSector adoption PDFs\nCountry AI index\nModel market share"]
        B5_3["Gov partnership execution\nSovereign UAE node\nAI governance reporting\nRegulator-ready exports"]
        B5_4["Intelligence API\nReal-time feed\nAnalyst-grade access\nUsage-based pricing"]
    end

    subgraph METRIC5 ["Phase 5 Metrics"]
        M5_1["$500k ARR"]
        M5_2["1 benchmark data deal\nConsultant or gov buyer"]
        M5_3["UAE sovereign node live"]
        M5_4["Series A materials ready"]
    end

    PH5 --> BUILD5 --> METRIC5

    style PH5 fill:#007AFF,color:#fff,stroke:none
    style BUILD5 fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style METRIC5 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## Week 1 Actual Start

**Before any of the above. Right now. This week.**

```mermaid
graph LR
    W1["This week"]

    W1 --> T1["Fix governance blockers\ngit init\npackage.json\n.gitignore\ntsconfig strict\nESLint\nVitest"]

    W1 --> T2["5 IT manager calls\nSchedule all 5 this week\nUAE network first\nRecord the face"]

    W1 --> T3["Define Phase 1 scope\nDecisions from Phase 0 discovery\nBrowser extension: Phase 1 or 2?\nGDPR approach\nFirst gov entity target"]

    style W1 fill:#FF3B30,color:#fff,stroke:none
    style T1 fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style T2 fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style T3 fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

---

## What We Are Not Building

**Explicitly out of scope until Phase 3 at earliest:**

```mermaid
graph LR
    NO["Not building (yet)"]

    NO --> N1["Windows / Linux Scout\nmacOS first · validate before expanding"]
    NO --> N2["Mobile agent\niOS / Android is Phase 4+"]
    NO --> N3["Public benchmark API\nNeeds critical data mass first"]
    NO --> N4["AI model recommendations\nBenchmark intelligence is Phase 5"]
    NO --> N5["Multi-org Node federation\nPhase 3 when we have 10+ orgs"]
    NO --> N6["White-label dashboard\nEnterprise tier only · Phase 4"]

    style NO fill:#FF3B30,color:#fff,stroke:none
    style N1 fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style N2 fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style N3 fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style N4 fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style N5 fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style N6 fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
```

---

*See also: [Architecture](./architecture.md) · [Deployment](./deployment.md) · [PLAN.md](../PLAN.md)*
