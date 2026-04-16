---
sidebar_position: 0
title: "Welcome to HIVE"
description: "The Global AI Consumption Network - Token Economy, Governance, and Full Visibility"
---

# Welcome to HIVE

**HIVE** is The Global AI Consumption Network — a token economy and governance platform that answers one critical question:

> Where do your AI tokens go, what do they cost, and who controls them?

## Why HIVE Exists

As organizations scale AI, they face invisible costs. Tokens flow through cloud providers, open-source models, and commercial APIs. Teams operate in silos. Compliance blurs. Budgets sprawl.

HIVE transforms this chaos into **visibility, accountability, and control**.

## Core Pillars

### Token Economy

Every token is a unit of spend. HIVE surfaces:
- Total token consumption across your organization
- Cost per department, team, and project
- Cost per model (Ollama, OpenAI, Anthropic, Google, Mistral, Bedrock, Azure)
- Waste detection and optimization opportunities
- ROI and budget forecasting

Your spreadsheet cannot show you what HIVE can. The dashboard makes tokens tangible.

### Token Governance

Compliance is structural, not optional. Every event carries a **GovernanceBlock** with:
- **Zero Content Principle** — HIVE never reads prompts, completions, or API keys. Metadata only.
- `pii_asserted: false` and `content_asserted: false` (frozen via schema, not runtime)
- Regulation tags and data residency policies
- Retention policies and automatic purge schedules
- Admission control and audit chains

Governance isn't a settings page. It's woven into every packet.

### Zero Content Principle

HIVE reads metadata only. Never prompts, never completions, never API keys.

This is the trust foundation that makes enterprise adoption possible. You can audit us. We cannot leak your LLM conversations.

### Shadow AI Detection

Unsanctioned AI providers are a governance risk. HIVE makes shadow AI immediately visible and quantified so you can close gaps and enforce policy.

## Architecture at a Glance

```
Connectors → Scout → Node → HIVE Dashboard
```

- **Connectors** (`@hive/connector-*`): Fetch-level interceptors for Ollama, OpenAI, Anthropic, Google, Mistral, Bedrock, Azure OpenAI. Transparent to your app.
- **Scout** (`@hive/scout`): Local agent that wraps `globalThis.fetch`, batches TTP events, ships to Node via HTTPS.
- **Node Server** (`@hive/node`): Express API. Ingests events at `/api/v1/ttp/ingest`. TimescaleDB backend. Runs intelligence analysis.
- **HIVE Dashboard** (`@hive/dashboard`): Next.js glassmorphic dark UI. KPIs, cost charts, event tables, anomaly alerts, chat widget.
- **Intelligence** (`@hive/intelligence`): Cost modeling, anomaly detection, spend forecasting, behavioral clustering, department fingerprinting.

## Key Concepts

**TTP** (Token Telemetry Protocol)
: Wire format for AI consumption events. Batched, signed with Ed25519, anchored to Merkle trees. See [TTP Protocol Spec](/architecture/ttp-protocol).

**GovernanceBlock**
: Immutable metadata structure attached to every TTP event. Guarantees: `pii_asserted: false`, `content_asserted: false`, regulation tags, data residency, retention policy.

**Scout**
: Local Node.js agent that wraps fetch, collects TTP events, batches them, signs them, and ships them to HIVE Node. Zero runtime overhead when idle.

**HIVE Node**
: Express server. Accepts TTP batches. Validates signatures. Ingests into TimescaleDB. Runs anomaly detection, cost modeling, forecasting. Exposes REST API.

**Intelligence**
: Analytical layer. Cost estimation per token/model/provider. Anomaly scoring. Spend forecasting. Behavioral clustering. Department fingerprinting.

## Deployment Modes

HIVE supports four deployment modes:

| Mode | Setup | Governance | Best For |
|------|-------|-----------|----------|
| **Solo** | Single process (Node + Scout in-memory) | Local SQLite | Prototyping, local dev |
| **Node** | Dedicated Node server + connectors | TimescaleDB | Teams, departments, governance focus |
| **Federated** | Multiple Nodes + shared governance database | Multi-tenant Postgres | Enterprise, multiple teams, audit trails |
| **Open** | Public HIVE instance (future) | Centralized | SMBs, startups, no ops burden |

## What's in the Box

HIVE ships with:

- 19 core packages (Scout, Node, Dashboard, Intelligence, Connectors, CLI, SDKs)
- 48 test suites, all passing
- Full TTP spec with Ed25519 signing and Merkle anchoring
- Prometheus metrics (`/metrics`) for monitoring
- Docker Compose setup for local development
- Production-ready deployment guides
- Zero-content guarantee auditable via code

## Getting Started

**New to HIVE?** Start here:

1. [Quickstart Guide](/getting-started/quickstart) — Get HIVE running in 5 minutes
2. [Docker Setup](/getting-started/docker) — Full containerized deployment
3. [Architecture Overview](/architecture/overview) — Understand the system

**Building a connector?**
- [Connector Overview](/connectors/overview)
- [Custom Connector Guide](/connectors/custom)

**Deploying to production?**
- [Deployment Modes](/deployment/modes)
- [Docker Compose Reference](/deployment/docker-compose)
- [Production Checklist](/deployment/production)

**Understanding the data?**
- [TTP Protocol Spec](/architecture/ttp-protocol)
- [Data Model & TimescaleDB](/architecture/data-model)
- [Governance & Compliance](/architecture/governance)

**Using the Dashboard?**
- [Dashboard Overview](/dashboard/overview)
- [Intelligence & Anomalies](/dashboard/intelligence)
- [HIVE Chat Widget](/dashboard/chat-widget)

## Key Messaging

- "Every token is a decision. HIVE makes them visible."
- "From invisible API calls to visible ROI."
- "Zero content. Full visibility. Total accountability."
- "Token Economy: See where your AI budget goes. Token Governance: Compliance is structural, not optional."

## Open Source

HIVE is built in the open. Code, issues, and roadmap are on GitHub. Contributions welcome.

---

**Ready to take control of your AI spend?** Continue to [Quickstart](/getting-started/quickstart).

Or dive deep into [Architecture](/architecture/overview) to understand how HIVE works.
