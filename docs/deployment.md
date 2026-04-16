# HIVE — Deployment Modes
### Four Modes · One Codebase · One docker-compose up

> **Apple Light theme** · Mermaid diagrams · Last updated 2026-04-15

---

## Overview

HIVE runs in four modes. **The codebase is identical across all four.** Mode is determined by environment configuration, not code. This means no forks, no drift, no feature divergence between self-hosted and SaaS.

```mermaid
graph LR
    subgraph MODES ["Four Deployment Modes"]
        M1["Mode 1\nSOLO\nPersonal"]
        M2["Mode 2\nORG\nEnterprise on-prem"]
        M3["Mode 3\nFEDERATED\nEnterprise + benchmarks"]
        M4["Mode 4\nOPEN\nGov · leaderboard · flex"]
    end

    CONFIG["Environment config\nDEPLOYMENT_MODE=solo|org|federated|open"]

    CONFIG -->|"drives"| MODES

    style MODES fill:#F5F5F7,stroke:#D2D2D7,color:#1D1D1F
    style CONFIG fill:#007AFF,color:#fff,stroke:none
```

---

## Mode 1 — SOLO (Personal)

**The first moment. The personal AI mirror.**

```mermaid
graph LR
    subgraph SOLO_ARCH ["Solo Mode Architecture"]
        direction TB
        SC["Scout Agent\nmacOS menubar app"]
        VT["Vault\nLocal libsodium\nKey stays here"]
        PV["Personal Dashboard\nLocal Next.js\nlocalhost:3000"]
        SC --> VT
        SC --> PV
    end

    subgraph SOLO_SCOPE ["What happens in Solo"]
        SS1["Scout observes your AI calls\nAll four methods available"]
        SS2["Telemetry stored locally only\nSQLite · nothing leaves device"]
        SS3["Dashboard shows your personal stats\n'You made 847 calls this month'"]
        SS4["Model breakdown\nGPT-4o vs Claude vs Gemini"]
        SS5["No account required\nNo network required\nWorks offline"]
    end

    subgraph SOLO_NOT ["What does NOT happen"]
        SN1["No data sent anywhere"]
        SN2["No account created"]
        SN3["No Node Hub"]
        SN4["No Hive connection"]
    end

    style SOLO_ARCH fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style SOLO_SCOPE fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style SOLO_NOT fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
```

### The "847 calls" moment

When someone opens the Solo dashboard for the first time and sees *"You've made 847 AI calls this month across 4 models"* — that's the moment. That's the hook. That's what causes them to say *"wait, can my whole team see this?"* — and that's the conversation that converts to Mode 2.

### Install paths — Solo

| Platform | Install method | Binary |
|----------|---------------|--------|
| macOS | `.pkg` installer · Homebrew | Menubar app |
| Windows | `.exe` installer · winget | System tray app |
| Linux | `.deb` / `.rpm` / snap | System service |
| Any | `npm install -g @hive/scout` | CLI daemon |
| Docker | `docker run hive/scout` | Container |
| Browser | Chrome / Firefox extension | Browser-only mode |

---

## Mode 2 — ORG (Enterprise On-Prem)

**Full enterprise visibility. Nothing leaves the building.**

```mermaid
graph TB
    subgraph ORG_ARCH ["Org Mode Architecture"]
        direction TB

        subgraph SCOUTS_ORG ["Scout Layer — employee machines"]
            SC_A["Scout A\nAlice's laptop"]
            SC_B["Scout B\nBob's laptop"]
            SC_C["Scout C\nOffice router proxy"]
            SC_D["Scout D\nCI/CD pipeline"]
        end

        subgraph NODE_ORG ["Node Hub — on-prem server"]
            NDX["Express API :3000"]
            PG[("PostgreSQL\n+ TimescaleDB")]
            RD[("Redis\nBull Queue")]
            SH["Shadow AI\nDetector"]
            DASH_ORG["Org Dashboard\nNext.js :3001"]
            VK["Vault Key Manager"]
            NDX --> PG & RD & SH
            VK -.->|"encrypted only"| NDX
            PG --> DASH_ORG
        end

        SCOUTS_ORG -->|"encrypted telemetry"| NDX
    end

    subgraph ORG_SCOPE ["What IT gets"]
        OS1["Full dept drill-down\nEngineering vs Finance vs Legal"]
        OS2["Shadow AI detector\n'New endpoint detected: groq.com'"]
        OS3["Budget rollup\nCost by team · by project · by model"]
        OS4["Audit trail\nCSV / JSON export · Compliance ready"]
        OS5["Model adoption map\nWho uses what across the org"]
    end

    style ORG_ARCH fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style ORG_SCOPE fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
```

### One-command install — Org Hub

```bash
# Download docker-compose
curl -O https://hive.io/install/node-compose.yml

# Configure
export HIVE_NODE_ID="my-org-hub"
export HIVE_ORG_NAME="ACME Corp"
export HIVE_DEPLOYMENT_MODE="org"
export POSTGRES_PASSWORD="$(openssl rand -hex 32)"

# Launch full stack
docker-compose -f node-compose.yml up -d

# Scout enrollment URL
echo "Share this with employees: http://your-server:3000/enroll"
```

### Why legal says yes in 20 minutes

```mermaid
graph LR
    LEGAL["Legal Team Concern\n'We need to approve this'"]

    LEGAL -->|"answered by"| A1["Data sovereignty\nAll data stays on-prem\nYou control the server"]
    LEGAL -->|"answered by"| A2["Zero content access\nOpen source schema\nAudit it yourself"]
    LEGAL -->|"answered by"| A3["GDPR compliance\nNo PII in telemetry\nHashed IDs only"]
    LEGAL -->|"answered by"| A4["DIFC / ADGM ready\nLocal data residency\nAudit trail built-in"]

    style LEGAL fill:#FF3B30,color:#fff,stroke:none
    style A1 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style A2 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style A3 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style A4 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## Mode 3 — FEDERATED (Enterprise + Benchmarks)

**On-prem + global context. The org's anonymised footprint contributes to global benchmarks.**

```mermaid
graph TB
    subgraph FED_ARCH ["Federated Mode Architecture"]
        direction TB

        subgraph SCOUTS_FED ["Scouts"]
            SC_FED["Employee scouts\n+ network proxy"]
        end

        subgraph NODE_FED ["Node Hub (on-prem)"]
            ND_FED["Express + PGSQL + TimescaleDB"]
            AGG_FED["Aggregator\nAnonymise before forwarding"]
        end

        subgraph HIVE_FED ["Hive Constellation (SaaS)"]
            HV_FED["Global benchmark dataset\nCountry · Sector · Model share"]
            LB_FED["Leaderboard — org-level\nAnonymised ranks"]
        end

        SCOUTS_FED -->|"encrypted telemetry"| ND_FED
        ND_FED --> AGG_FED
        AGG_FED -->|"anonymised aggregate ONLY\nno individual data"| HV_FED
        HV_FED --> LB_FED
    end

    subgraph FED_BENEFIT ["What the Org Gets"]
        FB1["See where you rank globally\n'Your org uses 40% more tokens/employee\nthan the UAE average for your sector'"]
        FB2["Benchmarks for CFO\n'Our AI adoption is top quartile'"]
        FB3["Model adoption context\n'GPT-4o is 60% of global enterprise'\nyou use 80% — or 20%"]
        FB4["Competitive intelligence\nAnonymised — no org can see another's raw data"]
    end

    style FED_ARCH fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style FED_BENEFIT fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
```

### What "anonymised aggregate" means

```mermaid
graph LR
    RAW_F["Raw Node data\nOrg A: 14,200 calls · GPT-4o · Engineering dept"]

    ANON["Anonymisation\nbefore forwarding to Hive"]

    OUT["Forwarded to Hive:\nSector: Technology\nCountry: UAE\nTotal calls: [bucket 10k-20k]\nModel: openai\nPeriod: 2026-04-15"]

    RAW_F --> ANON --> OUT

    style RAW_F fill:#FFE8E8,stroke:#FF3B30,color:#1D1D1F
    style ANON fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style OUT fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

**The Hive cannot reconstruct the org's raw data from the aggregate. This is enforced by the aggregation algorithm, not just policy.**

---

## Mode 4 — OPEN (Government · Leaderboard · Flex)

**Named public participation. The UAE gov play. The leaderboard.**

```mermaid
graph TB
    subgraph OPEN_ARCH ["Open Mode Architecture"]
        direction TB

        subgraph SCOUTS_OPEN ["Scouts"]
            SC_OPEN["Entity scouts\nNetwork proxy · SDK wrappers"]
        end

        subgraph NODE_OPEN ["Node Hub (on-prem or HIVE-managed)"]
            ND_OPEN["Express + PGSQL + TimescaleDB"]
            ATT["Node Attestation\nSigns telemetry bundles\nProves provenance"]
        end

        subgraph HIVE_OPEN ["Hive Constellation — Public"]
            PROF_OPEN["Named public profile\n@smart-dubai-ai-office"]
            LB_OPEN["Public leaderboard\nUAE · Global · Sector ranks"]
            BADGE_OPEN["Gov Verified badge\n Smart Dubai attested"]
            FEED_OPEN["Social feed\nAuto-generated from telemetry"]
        end

        SCOUTS_OPEN --> ND_OPEN --> ATT
        ATT -->|"named · signed · public"| HIVE_OPEN
    end

    subgraph OPEN_USE ["Who lives in Open Mode"]
        OU1["UAE government entities\nDEWA · RTA · Smart Dubai · ADNOC"]
        OU2["Academic institutions\nMBZUAI · NYU Abu Dhabi"]
        OU3["Individuals who want the flex\nPublic profile · leaderboard rank"]
        OU4["Agent builders\nPublic agent leaderboard"]
    end

    style OPEN_ARCH fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style OPEN_USE fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
```

### The UAE Open Mode leaderboard

```mermaid
graph LR
    subgraph LB ["HIVE UAE Gov Leaderboard — Live"]
        direction TB
        R1["#1 Smart Dubai AI Office\n8.2B tokens · 94 models · 847 days"]
        R2["#2 ADNOC AI Hub\n6.1B tokens · 72 models · 612 days"]
        R3["#3 DEWA Digital\n4.8B tokens · 58 models · 501 days"]
        R4["#4 RTA Innovation Lab\n3.2B tokens · 44 models · 390 days"]
        R5["#5 MOHRE AI Unit\n2.1B tokens · 31 models · 280 days"]
    end

    POL["Political instrument\nAnnual report KPI\nMinisterial flex on social media"]

    LB --> POL

    style LB fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style POL fill:#FF3B30,color:#fff,stroke:none
```

---

## Mode Comparison Matrix

```mermaid
graph LR
    subgraph MATRIX ["Mode Comparison"]
        direction TB
        HEADER["Feature comparison across all modes"]

        subgraph SOLO_COL ["Solo"]
            SOLO_D["• Scout: any method\n• Storage: local only\n• Dashboard: personal\n• Hub: none\n• Hive: none\n• Account: optional\n• Cost: free forever"]
        end

        subgraph ORG_COL ["Org"]
            ORG_D["• Scout: any method\n• Storage: on-prem Node\n• Dashboard: org + dept\n• Hub: your server\n• Hive: none\n• Account: org admin\n• Cost: free (self-host)"]
        end

        subgraph FED_COL ["Federated"]
            FED_D["• Scout: any method\n• Storage: on-prem Node\n• Dashboard: org + global\n• Hub: your server\n• Hive: anonymised aggregate\n• Account: org + Hive\n• Cost: data tier pricing"]
        end

        subgraph OPEN_COL ["Open"]
            OPEN_D["• Scout: any method\n• Storage: on-prem + Hive\n• Dashboard: public profile\n• Hub: on-prem or managed\n• Hive: named public\n• Account: org + public\n• Cost: gov deal / data tier"]
        end
    end

    style SOLO_COL fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style ORG_COL fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style FED_COL fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style OPEN_COL fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
```

---

## Upgrade Path — The Natural Journey

```mermaid
flowchart LR
    S["Solo\nPersonal AI mirror\n'847 calls this month'"]
    O["Org\n'Can my whole team\nsee this?'\nIT installs one Node Hub"]
    F["Federated\n'How do we compare\nto other UAE orgs?'\nConnect to Hive benchmarks"]
    OP["Open\n'We want to be #1\nin the UAE gov leaderboard'\nPublic named participation"]

    S -->|"'Can my team see this?'"| O
    O -->|"'How do we compare?'"| F
    F -->|"'We want to be first'"| OP

    style S fill:#86868B,color:#fff,stroke:none
    style O fill:#34C759,color:#1D1D1F,stroke:none
    style F fill:#5856D6,color:#fff,stroke:none
    style OP fill:#FF9500,color:#fff,stroke:none
```

Each upgrade is driven by the user's own desire — not a paywall, not a feature gate. The product's gravity pulls them up the stack.

---

*See also: [Architecture](./architecture.md) · [Build Sequence](./build-sequence.md) · [PLAN.md](../PLAN.md)*

---

<sub>HIVE &nbsp;·&nbsp; هايف &nbsp;·&nbsp; הייב &nbsp;·&nbsp; ہائیو &nbsp;·&nbsp; هایو &nbsp;·&nbsp; हाइव &nbsp;·&nbsp; ਹਾਈਵ &nbsp;·&nbsp; হাইভ &nbsp;·&nbsp; ஹைவ் &nbsp;·&nbsp; హైవ్ &nbsp;·&nbsp; හයිව් &nbsp;·&nbsp; ဟိုင်ဗ် &nbsp;·&nbsp; ហ៊ីវ &nbsp;·&nbsp; ไฮฟ์ &nbsp;·&nbsp; 蜂巢 &nbsp;·&nbsp; ハイブ &nbsp;·&nbsp; 하이브 &nbsp;·&nbsp; ჰაივი &nbsp;·&nbsp; Հայվ &nbsp;·&nbsp; Χάιβ &nbsp;·&nbsp; Хайв &nbsp;·&nbsp; ሃይቭ &nbsp;·&nbsp; Colmena &nbsp;·&nbsp; Ruche &nbsp;·&nbsp; Colmeia &nbsp;·&nbsp; Alveare &nbsp;·&nbsp; Kovan &nbsp;·&nbsp; Mzinga &nbsp;·&nbsp; Tổ Ong &nbsp;·&nbsp; Ul</sub>