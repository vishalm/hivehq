# HIVE — Identity Architecture & Social Layer
### CIAM · TokenPrint · The Agent Economy

> **Apple Light theme** · Mermaid diagrams · Last updated 2026-04-15

---

## Overview

HIVE's identity system is the first to unify three distinct identity types — personal, professional, and autonomous agent — under a single cryptographic root. It is simultaneously:

- A **CIAM protocol** (like Auth0, but for AI identity)
- A **verified credential** (like a background check, but for AI fluency)
- A **social graph** (like LinkedIn, but machine-verified and gamified)

Nobody has built this. The space is empty exactly here.

---

## Three Identity Types — One Cryptographic Root

```mermaid
graph TB
    ROOT["HIVE Account\nOne cryptographic root\nPortable · Yours forever"]

    subgraph PERSONAL ["Personal Identity"]
        P_DEF["Self-sovereign\nYou control everything"]
        P_VIS["Private vault\nNever published unless you choose"]
        P_USE["Personal AI mirror\nGrowth tracking over time"]
        P_AUTH["Social login\nno SSO required"]
    end

    subgraph PROFESSIONAL ["Professional Identity"]
        PR_DEF["Org-attested\nNode-verified · tamper-evident"]
        PR_VIS["Public standing\nCareer credential · employer-facing"]
        PR_USE["TokenPrint score\nFuels leaderboard · benchmark ranking"]
        PR_AUTH["SSO / SAML ready\nEnterprise auth integration"]
    end

    subgraph AGENT ["Agent Identity"]
        A_DEF["Owner-attested\nHuman registers autonomous agent"]
        A_VIS["Public by default\nAgent leaderboard · performance rank"]
        A_USE["Machine-to-machine\nNo human in the loop"]
        A_AUTH["Enrolled via API\nPost /api/agents/enroll"]
    end

    ROOT --> PERSONAL
    ROOT --> PROFESSIONAL
    ROOT --> AGENT

    style ROOT fill:#007AFF,color:#fff,stroke:none
    style PERSONAL fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style PROFESSIONAL fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style AGENT fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

**All three share one cryptographic root. All three are portable. All three are yours.**

---

## Personal vs. Professional Scrubbing

The scrubbing layer is not a privacy feature bolted on — **it is the core product differentiation.** It runs client-side. The user defines rules. The org never sees personal usage. The Hive never conflates them.

```mermaid
graph TD
    RAW["Raw telemetry\nAll AI calls observed by Scout"]
    SCRUB["Scrubbing Layer\nClient-side · user-defined rules"]

    RAW --> SCRUB

    subgraph PERSONAL_B ["Personal Bucket"]
        P1["Personal email domains\n@gmail.com @icloud.com"]
        P2["Evening + weekend hours\n6pm–9am · weekends"]
        P3["Personal device scouts\nPersonal laptop · home network"]
        P4["Outcome: never leaves vault\nYour personal AI mirror only"]
    end

    subgraph PROF_B ["Professional Bucket"]
        PR1["Work domain\n@company.com emails"]
        PR2["Work hours\nCustom window · you set it"]
        PR3["Org node scout\nWork laptop · office network"]
        PR4["Outcome: org-verified\nFeeds public TokenPrint score"]
    end

    SCRUB --> PERSONAL_B
    SCRUB --> PROF_B

    PROF_B -->|"higher weight\norga-attested = trust multiplier"| TOKEN["TokenPrint Score"]
    PERSONAL_B -.->|"optional opt-in\nyour choice always"| TOKEN

    style RAW fill:#F5F5F7,stroke:#86868B,color:#1D1D1F
    style SCRUB fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style PERSONAL_B fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style PROF_B fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style TOKEN fill:#007AFF,color:#fff,stroke:none
```

**Professional score is worth more because it's node-attested. That's the incentive to consent.**

---

## TokenPrint Score

The TokenPrint score is HIVE's primary identity signal. It is composite, hard to game, and machine-verified.

### Score composition

```mermaid
pie title TokenPrint Score — Signal Weights
    "Volume · tokens · sessions · frequency" : 25
    "Breadth · model diversity · use cases" : 20
    "Depth · session length · multi-turn ratio" : 20
    "Consistency · tenure · streak · growth curve" : 20
    "Verified · node-attested professional use" : 10
    "Influence · social graph · public posts" : 5
```

### Anti-gaming design

```mermaid
graph LR
    GAME["Attempted gaming\n'I'll just spam API calls'"]

    GAME -->|"caught by"| D1["Depth signals\nSingle-turn spam = low depth score"]
    GAME -->|"caught by"| D2["Session quality\nRobotic patterns flagged"]
    GAME -->|"caught by"| D3["Node attestation\nOrg node verifies legitimacy"]
    GAME -->|"caught by"| D4["Model diversity\nSame model spam = low breadth"]
    GAME -->|"caught by"| D5["Tenure requirement\nStreak requires real daily usage"]

    style GAME fill:#FF3B30,color:#fff,stroke:none
    style D1 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style D2 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style D3 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style D4 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style D5 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## Earned Badges — The Social Tags

Badges are not self-assigned. They are earned automatically by the telemetry data and attached to the identity cryptographically.

```mermaid
graph TD
    subgraph GENESIS ["Genesis Tier · Lifetime"]
        B1["Genesis\nFirst 1,000 users ever\nNon-transferable"]
        B2["Early Adopter\nBefore 10k users"]
    end

    subgraph ACTIVITY ["Activity Signals"]
        B3["Streak N days\nConsecutive active days\nUpdates dynamically"]
        B4["Multi-model ×N\nDistinct models used\nUpdates as you grow"]
        B5["Agent Builder\nOwns N+ enrolled agents"]
    end

    subgraph VERIFIED ["Verification Tier · Highest trust"]
        B6["Gov Verified\nSmart Dubai node attested\nFederal entity confirmed"]
        B7["Org Verified\nCorporate node attested"]
    end

    subgraph RANK ["Ranking Tier"]
        B8["UAE #N\nCountry rank · live"]
        B9["Top N%\nGlobal percentile · live"]
        B10["#1 Sector\nTop in your industry"]
    end

    style GENESIS fill:#007AFF,color:#fff,stroke:none
    style ACTIVITY fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style VERIFIED fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style RANK fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

These tags travel with the person everywhere HIVE Login is used. Every integrated app sees them. **This is the flex layer that becomes fashion.**

---

## The Agent Economy

### Two citizens — one graph

```mermaid
graph TB
    subgraph HUMAN ["Human Citizens"]
        IND["Individual\nPersonal + professional\nTokenPrint score"]
        ORG["Organisation\nNode-level identity\nDept breakdown"]
        DEPT["Department / Team\nSub-org unit\nProject-tagged telemetry"]
    end

    subgraph AGENT ["Agent Citizens"]
        AUT["Autonomous Agent\nFully automated\nNo human in loop"]
        BOT["Bot Fleet\nMulti-agent orchestration\nOwner: individual or org"]
        SYS["System / Pipeline\nInfrastructure-level agent\nCI/CD · data processing"]
    end

    IND -->|"spawns · owns"| AUT
    IND -->|"spawns · owns"| BOT
    ORG -->|"deploys"| SYS
    DEPT -->|"runs"| BOT

    style HUMAN fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style AGENT fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

### Agent enrollment API

```mermaid
sequenceDiagram
    participant DEV as Developer / Org
    participant API as HIVE API
    participant HIVE as Hive Constellation
    participant SC as Scout Agent

    DEV->>API: POST /api/agents/enroll<br/>{ name, owner_hive_id, org_node,<br/>  type, model_primary, purpose }

    API->>API: Validate owner identity
    API->>API: Generate agent_id: "agt_7f3a9c2e"
    API->>HIVE: Register agent profile

    API-->>DEV: { agent_id, swag_handle,<br/>  parent, enrolled, scout_tag }

    Note over SC: All traffic tagged with scout_tag automatically
    SC->>HIVE: Telemetry events tagged as agent
    HIVE->>HIVE: Builds agent public profile
    HIVE->>HIVE: Updates agent leaderboard
```

### What each citizen shows off

```mermaid
graph LR
    subgraph HUMAN_SWAG ["Human Swag"]
        HS1["TokenPrint score"]
        HS2["Model diversity badge"]
        HS3["Streak · tenure · rank"]
        HS4["AI Year in Review"]
        HS5["Verified org · #1 in sector"]
    end

    subgraph AGENT_SWAG ["Agent Swag"]
        AS1["Autonomy score"]
        AS2["Tasks completed count"]
        AS3["Uptime %"]
        AS4["Cost efficiency rank"]
        AS5["Owner · spawned by"]
    end

    subgraph IMPACT ["Impact Swag — the deepest flex"]
        IS1["CO₂ equivalent saved"]
        IS2["Decisions automated"]
        IS3["Hours returned to team"]
        IS4["Cost vs manual work"]
        IS5["Sector contribution"]
    end

    style HUMAN_SWAG fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style AGENT_SWAG fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style IMPACT fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
```

---

## The Social Feed

**The key insight: The feed requires no human content creation. The telemetry IS the content.**

```mermaid
graph LR
    TEL["Telemetry events\nAutomatic · continuous"]

    TEL -->|"crosses milestone"| E1["2B tokens processed\n→ auto post to feed"]
    TEL -->|"weekly report"| E2["Agent completes\n847th eval cycle\n→ auto post to feed"]
    TEL -->|"rank change"| E3["Moved to UAE #2\n→ notify + optional share"]
    TEL -->|"new badge earned"| E4["Genesis badge\n→ auto post + share card"]
    TEL -->|"annual wrapped"| E5["AI Year in Review\nJan 1st · viral loop"]

    style TEL fill:#007AFF,color:#fff,stroke:none
    style E1 fill:#E8F4FF,stroke:#007AFF,color:#1D1D1F
    style E2 fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
    style E3 fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style E4 fill:#FFF4E5,stroke:#FF9500,color:#1D1D1F
    style E5 fill:#FF3B30,color:#fff,stroke:none
```

Every other social network requires humans to create content. **HIVE's content is generated by the act of using AI.** The more you use AI, the more you post, automatically.

---

## Login with HIVE — The Integration Protocol

### For platform developers

```mermaid
sequenceDiagram
    participant APP as AI Application
    participant USER as User
    participant HIVE as HIVE OAuth
    participant ND as User's Node

    USER->>APP: Clicks "Login with HIVE"
    APP->>HIVE: OAuth2 redirect with scope
    USER->>HIVE: Authenticates (passkey / social)
    HIVE->>ND: Verify professional identity
    ND-->>HIVE: Attestation confirmed
    HIVE-->>APP: Access token + HIVE profile

    Note over APP: profile includes:<br/>- TokenPrint score<br/>- All earned badges<br/>- Verified org (if professional)<br/>- Model diversity signal<br/>- Global + country rank

    APP->>APP: User experience personalised\nto their verified AI identity
    APP->>HIVE: Telemetry flows automatically\nfrom this point forward
```

### Pricing — Auth0 model

| Tier | MAU | Price |
|------|-----|-------|
| Free | 0 – 1,000 MAU | $0 |
| Growth | 1,001 – 100k MAU | $0.02 / MAU |
| Enterprise | 100k+ MAU | Flat contract + SLA |
| Gov / Sovereign | On-prem node | Annual deal |

---

## Verified Credential — The AI Resume

A TokenPrint credential is machine-verified, node-attested, and tamper-evident. Employers pay to verify it. ATS platforms integrate the API.

```mermaid
graph TD
    CRED["HIVE Verified Credential"]

    subgraph SIGNALS ["Verified Signals"]
        S1["Total tokens processed\n2.1B — from telemetry"]
        S2["Models used\n14 distinct providers"]
        S3["Node attestation\nSmart Dubai HIVE Node #verified"]
        S4["Professional bucket\nWork hours · work domain only"]
        S5["Credential hash\n0x7f3a…9c2e · tamper-evident"]
    end

    subgraph BUYERS ["Who Verifies"]
        B1["Employers\nHiring signal for AI roles"]
        B2["HR Platforms\nGreenhouse · Workday · Lever"]
        B3["LinkedIn\nBadge integration · revenue share"]
        B4["Recruiters\nSingle lookup: $2/call"]
        B5["Bulk API\nATS integration: $0.80/call"]
    end

    CRED --> SIGNALS
    CRED --> BUYERS

    style CRED fill:#007AFF,color:#fff,stroke:none
    style SIGNALS fill:#E8F9F0,stroke:#34C759,color:#1D1D1F
    style BUYERS fill:#F0EEFF,stroke:#5856D6,color:#1D1D1F
```

---

## The Wrapped Moment — Annual Viral Loop

Every year, January 1st:

```mermaid
sequenceDiagram
    participant HIVE
    participant USER as All HIVE Users
    participant SOCIAL as Social Media

    Note over HIVE: January 1st · 00:00 UTC
    HIVE->>HIVE: Generate personalised AI Year in Review
    Note over HIVE: Most used model<br/>Peak week<br/>Biggest project spike<br/>Growth vs last year<br/>Country rank movement<br/>Top badge earned

    HIVE->>USER: Push notification + email
    USER->>HIVE: Open personalised card
    USER->>SOCIAL: Share card to X / LinkedIn / WhatsApp
    SOCIAL-->>HIVE: Viral acquisition loop
    Note over HIVE: One day per year HIVE trends globally
```

This is not a feature. This is the **annual acquisition event.**

---

*See also: [Architecture](./architecture.md) · [Business Model](./business-model.md) · [PLAN.md](../PLAN.md)*

---

<sub>HIVE &nbsp;·&nbsp; هايف &nbsp;·&nbsp; הייב &nbsp;·&nbsp; ہائیو &nbsp;·&nbsp; هایو &nbsp;·&nbsp; हाइव &nbsp;·&nbsp; ਹਾਈਵ &nbsp;·&nbsp; হাইভ &nbsp;·&nbsp; ஹைவ் &nbsp;·&nbsp; హైవ్ &nbsp;·&nbsp; හයිව් &nbsp;·&nbsp; ဟိုင်ဗ် &nbsp;·&nbsp; ហ៊ីវ &nbsp;·&nbsp; ไฮฟ์ &nbsp;·&nbsp; 蜂巢 &nbsp;·&nbsp; ハイブ &nbsp;·&nbsp; 하이브 &nbsp;·&nbsp; ჰაივი &nbsp;·&nbsp; Հայվ &nbsp;·&nbsp; Χάιβ &nbsp;·&nbsp; Хайв &nbsp;·&nbsp; ሃይቭ &nbsp;·&nbsp; Colmena &nbsp;·&nbsp; Ruche &nbsp;·&nbsp; Colmeia &nbsp;·&nbsp; Alveare &nbsp;·&nbsp; Kovan &nbsp;·&nbsp; Mzinga &nbsp;·&nbsp; Tổ Ong &nbsp;·&nbsp; Ul</sub>