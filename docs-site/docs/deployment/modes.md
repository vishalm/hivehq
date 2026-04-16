---
sidebar_position: 1
title: "Deployment Modes"
description: "Solo, Node, Federated, Open - choose your deployment model"
---

# Deployment Modes

HIVE supports four deployment modes. Choose based on your needs.

## Solo Mode

Single-process deployment. Scout and Node in one process.

**Best for:** Prototyping, local dev, single-team testing

**Setup:**

```typescript
import { createScout } from '@hive/scout';
import { createNode } from '@hive/node';

const node = await createNode({
  database: 'sqlite:./hive.db',  // Local SQLite
});

const scout = createScout({
  nodeUrl: 'http://localhost:3001',  // Same process
});
```

**Characteristics:**
- Zero external dependencies
- No database setup needed
- Events persisted to local SQLite
- Full intelligence features available
- Not suitable for production

**Limits:**
- Single machine only
- No distributed tracking
- Limited scaling

## Node Mode

Dedicated Node server. Multiple Scout instances can connect.

**Best for:** Teams, departments, governance focus

**Setup:**

Start Node:
```bash
docker run -d \
  -e DATABASE_URL=postgresql://... \
  -p 3001:3001 \
  hive:node-latest
```

Configure Scout:
```typescript
const scout = createScout({
  nodeUrl: 'http://hive-node.mycompany.com:3001',
  department: 'engineering',
});
```

**Characteristics:**
- Centralized data store (Postgres/TimescaleDB)
- Multiple applications can connect
- Full governance and compliance
- Dashboard accessible to team
- Intelligence running continuously
- Scales to 1000s of events/min

**Limits:**
- Requires Postgres setup
- Single point of failure (mitigated with HA Postgres)
- No multi-region support

## Federated Mode

Multiple HIVE Nodes with shared governance database.

**Best for:** Enterprise, multiple teams, audit trails

**Setup:**

```
┌─────────────────────────────────────┐
│ Shared Governance DB (Postgres)     │
│ (retention policies, compliance)    │
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
  Node 1      Node 2    Node 3
(eng team)  (mkt team) (sales team)
    │          │          │
    └──────────┼──────────┘
               │
        Dashboard
        (unified view)
```

Each team has their own Node. Governance is shared.

**Configuration:**

All Nodes share a governance database:

```bash
# Node 1 (Engineering)
docker run -d \
  -e DATABASE_URL=postgresql://hive-prod:pass@db.company.com/hive_eng \
  -e GOVERNANCE_DB_URL=postgresql://hive-prod:pass@db.company.com/hive_governance \
  -p 3001:3001 \
  hive:node-latest

# Node 2 (Marketing)
docker run -d \
  -e DATABASE_URL=postgresql://hive-prod:pass@db.company.com/hive_mkt \
  -e GOVERNANCE_DB_URL=postgresql://hive-prod:pass@db.company.com/hive_governance \
  -p 3002:3001 \
  hive:node-latest
```

**Characteristics:**
- Data separation by team
- Unified governance policies
- Unified Dashboard with cross-team view
- Full compliance auditing
- Each team can access their own data
- Central cost visibility

**Limits:**
- More complex setup
- Requires shared database
- Cross-team queries require special permissions

## Open Mode

Public HIVE instance (future). SMBs and startups use shared infrastructure.

**Best for:** No ops burden, quick time-to-value

**Status:** Coming 2026 Q3

## Comparison

| Aspect | Solo | Node | Federated | Open |
|--------|------|------|-----------|------|
| Setup time | 5 min | 15 min | 30 min | 1 min |
| Database | SQLite | Postgres | Shared Postgres | Managed |
| Scaling | Single machine | 1 machine | Multiple machines | Unlimited |
| Teams | 1 | 1+ | 1+ | 1+ |
| Governance | Basic | Full | Full + shared | Full |
| Cost | Free | Postgres | Postgres | SaaS |
| Self-hosted | Yes | Yes | Yes | No |

## Migration Path

```
Solo (dev)
  ↓ (add team)
Node (single server)
  ↓ (grow org)
Federated (multi-team)
  ↓ (outsource ops)
Open (SaaS)
```

You can upgrade from one mode to another:

**Solo → Node:**
1. Spin up Postgres
2. Point Node at Postgres
3. Reconfigure Scout to point to Node
4. Done (no data loss)

**Node → Federated:**
1. Create shared governance database
2. Provision new Node instances
3. Configure to share governance DB
4. Migrate departments to new nodes
5. Update Dashboard to show all Nodes

---

Next: [Docker Compose Reference](/deployment/docker-compose) or [Production Checklist](/deployment/production).
