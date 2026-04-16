---
sidebar_position: 3
title: "Governance & Compliance"
description: "Zero Content Principle, GovernanceBlock, regulation tags, data residency, and retention"
---

# Governance & Compliance

Governance is not optional. It is structural. Every TTP event carries immutable compliance guarantees.

## Zero Content Principle

The foundation of HIVE's trustworthiness.

### What HIVE Reads

HIVE reads **only metadata**:

- Timestamp
- Provider name (OpenAI, Anthropic, etc.)
- Model name (gpt-4, claude-opus, etc.)
- Token counts (prompt + completion)
- Cost (USD)
- Latency (milliseconds)
- Department/team ID
- Request ID (for tracing)
- Error type (if applicable)

### What HIVE Never Reads

- Prompts (user input)
- Completions (LLM output)
- API keys or credentials
- User data or PII from requests
- System prompts or instructions
- Cached content or context

This is enforced at three levels:

1. **Connector level** — Connectors strip content before creating events
2. **Scout level** — Scout never opens request/response bodies
3. **Node level** — TTP schema has no content fields

### Example

A user calls OpenAI:

```python
response = openai.ChatCompletion.create(
  model="gpt-4",
  messages=[
    {"role": "user", "content": "What is the capital of France?"}  # NEVER captured
  ]
)
```

The connector captures:
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "tokens_prompt": 25,
  "tokens_completion": 10,
  "cost_usd": 0.001
}
```

The prompt ("What is the capital of France?") is never written anywhere. HIVE has no knowledge of it.

### Audit: Verify Zero Content

HIVE code is open source. You can audit:

1. All connector implementations (filter out content)
2. Scout's fetch wrapper (never reads body)
3. TTP schema (no content fields defined)
4. Node database schema (no content columns)
5. Dashboard (never displays prompts/completions)

This is verifiable by code review.

## GovernanceBlock

Every TTP batch carries a GovernanceBlock — an immutable compliance label.

```typescript
interface GovernanceBlock {
  // Privacy Guarantees (structurally immutable)
  pii_asserted: false;
  content_asserted: false;
  
  // Regulation
  regulation: "none" | "hipaa" | "gdpr" | "sox" | "sox-hipaa" | "ccpa";
  
  // Data Residency
  data_residency: string;  // e.g., "us-east-1", "eu-west-1"
  
  // Retention
  retention_days: number;  // 30-365
  purge_at: string;        // ISO 8601 timestamp
}
```

### Immutability via Zod

The `pii_asserted` and `content_asserted` fields use `z.literal(false)`:

```typescript
const GovernanceBlock = z.object({
  pii_asserted: z.literal(false),      // Only accepts false, no runtime override
  content_asserted: z.literal(false),  // Only accepts false, no runtime override
  regulation: z.enum([...]),
  data_residency: z.string(),
  retention_days: z.number().min(30).max(365),
  purge_at: z.string().datetime(),
});
```

This prevents:
- Accidental typos (`pii_asserted: True`)
- Malicious modifications at runtime
- Future refactoring mistakes

### Setting GovernanceBlock

Scout sets GovernanceBlock when creating a batch. Defaults come from configuration:

```typescript
const batch = {
  // ... events ...
  governance: {
    pii_asserted: false,  // Always
    content_asserted: false,  // Always
    regulation: config.defaultRegulation,      // From .hive/config.json or env
    data_residency: config.defaultDataResidency,
    retention_days: config.defaultRetentionDays,
    purge_at: addDays(now(), config.defaultRetentionDays),
  }
};
```

Configure defaults in the Setup UI (Dashboard) or `.env`:

```bash
export HIVE_GOVERNANCE_REGULATION=hipaa
export HIVE_GOVERNANCE_DATA_RESIDENCY=us-east-1
export HIVE_GOVERNANCE_RETENTION_DAYS=365
```

## Regulation Tags

Regulation tags identify compliance frameworks. They affect data handling:

| Tag | Framework | Implications |
|-----|-----------|--------------|
| `none` | No regulation | Default, minimal restrictions |
| `hipaa` | Health Insurance Portability and Accountability Act | Phi data; requires audit logs, encryption, access controls |
| `gdpr` | General Data Protection Regulation (EU) | Personal data; requires consent, right to erasure, data minimization |
| `sox` | Sarbanes-Oxley Act | Financial controls; requires audit trails, access controls, retention |
| `sox-hipaa` | Both SOX and HIPAA | Strictest: financial + health data |
| `ccpa` | California Consumer Privacy Act | Personal data; requires opt-out, disclosure |

Node enforces compliance:
- **HIPAA**: Restrict access to encrypted storage; audit all queries
- **GDPR**: Enable right-to-erasure; anonymize identifiers; limit retention to EU
- **SOX**: Immutable audit logs; access controls; retention >= 7 years
- **CCPA**: Explicit opt-out tracking; allow data deletion

Example HIPAA config:

```bash
export HIVE_GOVERNANCE_REGULATION=hipaa
export HIVE_GOVERNANCE_DATA_RESIDENCY=us-east-1  # HIPAA Business Associate Agreement
export HIVE_GOVERNANCE_RETENTION_DAYS=365        # 1 year retention
```

## Data Residency

Specifies where data can be stored and processed.

| Region | Location | Common Use |
|--------|----------|------------|
| `us-east-1` | US East (N. Virginia) | Default, US-based |
| `us-west-2` | US West (Oregon) | US-based, West Coast |
| `eu-west-1` | EU (Ireland) | GDPR compliance |
| `eu-central-1` | EU (Frankfurt) | GDPR, Germany |
| `ap-southeast-1` | Asia Pacific (Singapore) | APAC region |
| `ca-central-1` | Canada | Canadian data residency |

Node enforces residency:
- Events tagged `eu-west-1` are stored only in EU infrastructure
- Queries attempting to move data across regions are rejected
- Audit logs record all residency-related operations

Configure:

```bash
export HIVE_GOVERNANCE_DATA_RESIDENCY=eu-west-1
```

## Retention Policies

Retention defines how long HIVE stores events before automatic deletion.

### Retention Days

Range: 30-365 days. Default: 90 days.

Events are soft-deleted after retention period expires (marked as deleted, not immediately purged).

Hard deletion (physical removal from storage) occurs:
- 30 days after soft deletion (GDPR safe harbor)
- Or immediately if user requests deletion (right-to-erasure)

Configure:

```bash
export HIVE_GOVERNANCE_RETENTION_DAYS=180  # 6 months
```

### Purge Schedule

Node runs a purge job daily at 02:00 UTC:

```
Purge Timeline:
├─ 02:00 UTC: Job starts
├─ Query: events where purge_at <= now()
├─ Soft delete: mark deleted=true
├─ Log: audit table records purge event
└─ 02:30 UTC: Job completes
```

Check scheduled purges:

```bash
curl http://localhost:3001/api/v1/retention/schedule
```

Response:

```json
{
  "next_purge": "2026-04-17T02:00:00Z",
  "events_eligible": 1234,
  "last_purge": "2026-04-16T02:00:00Z",
  "last_purge_deleted": 567
}
```

### Right-to-Erasure

GDPR and CCPA grant users the right to erasure. Node supports this:

```bash
# Delete all events for user_id=alice@company.com
curl -X POST http://localhost:3001/api/v1/users/alice@company.com/delete \
  -H "Authorization: Bearer admin_token"
```

Response:

```json
{
  "status": "deleted",
  "user_id": "alice@company.com",
  "events_deleted": 456,
  "deletion_timestamp": "2026-04-16T12:34:56Z",
  "audit_log": "deletion-2026-04-16-12-34-56"
}
```

Deleted events are immediately soft-deleted and removed from all dashboards and reports.

## Admission Control

Node validates every batch against governance rules:

### At Ingest

When Scout sends a batch:

```typescript
// Node validates GovernanceBlock
if (batch.governance.pii_asserted !== false) {
  throw new Error('PII assertion must be false');
}

if (batch.governance.content_asserted !== false) {
  throw new Error('Content assertion must be false');
}

// Verify regulation is supported
if (!['none', 'hipaa', 'gdpr', 'sox', 'ccpa'].includes(batch.governance.regulation)) {
  throw new Error('Unknown regulation tag');
}

// Verify data residency
if (!isValidResidency(batch.governance.data_residency)) {
  throw new Error('Invalid data residency');
}

// Verify retention is in valid range
if (batch.governance.retention_days < 30 || batch.governance.retention_days > 365) {
  throw new Error('Retention must be 30-365 days');
}
```

### At Query

When Dashboard or API queries data:

```typescript
// Check data residency
const userResidency = req.user.organization.residency;  // e.g., "eu-west-1"
const query = "SELECT * FROM events WHERE provider='openai'";

// If user is in EU but events are in US, reject
const eventsResidency = db.query(
  "SELECT DISTINCT data_residency FROM events LIMIT 1"
);

if (eventsResidency !== userResidency) {
  throw new Error('Cross-residency queries not allowed');
}

// Execute query
const results = db.execute(query);
```

## Audit Logging

Every governance-relevant action is logged:

| Action | Log |
|--------|-----|
| Batch ingested | `{"action": "ingest", "batch_id": "...", "regulation": "none", "timestamp": "..."}`  |
| Query executed | `{"action": "query", "user": "alice", "residency": "eu-west-1", "timestamp": "..."}` |
| Deletion request | `{"action": "delete_user", "user_id": "alice", "events": 456, "timestamp": "..."}` |
| Purge job | `{"action": "purge", "deleted_count": 1234, "timestamp": "..."}` |
| Configuration change | `{"action": "config_update", "regulation": "hipaa", "timestamp": "..."}` |

Access audit logs:

```bash
curl http://localhost:3001/api/v1/audit/logs?action=ingest&limit=100
```

## Compliance Checklists

### HIPAA Compliance

- Regulation tag: `hipaa` ✓
- Data residency: US (e.g., `us-east-1`) ✓
- Retention: >= 6 years (set to 365 days) ✓
- Encryption: TLS in transit, at-rest (storage layer) ✓
- Access controls: Dashboard requires authentication ✓
- Audit logs: All queries logged ✓
- No content: HIVE never reads request/response data ✓

Verify:

```bash
curl http://localhost:3001/api/v1/compliance/hipaa
```

### GDPR Compliance

- Regulation tag: `gdpr` ✓
- Data residency: EU (e.g., `eu-west-1`) ✓
- Retention: <= 1 year (typically 90 days) ✓
- Right-to-erasure: Support deletion endpoint ✓
- Data minimization: No content, only metadata ✓
- Consent: Documented in Setup UI ✓
- Audit logs: All processing logged ✓

Verify:

```bash
curl http://localhost:3001/api/v1/compliance/gdpr
```

### SOX Compliance

- Regulation tag: `sox` ✓
- Retention: >= 7 years ✓
- Immutable audit logs: Ed25519 signatures + Merkle anchors ✓
- Access controls: Role-based access (dashboard auth) ✓
- Change logs: Configuration changes tracked ✓
- Error handling: All errors logged ✓

Verify:

```bash
curl http://localhost:3001/api/v1/compliance/sox
```

## Configuration Example: HIPAA Setup

```bash
# .env.hipaa
NODE_ENV=production
DATABASE_URL=postgresql://hive:password@hive-db.us-east-1.rds.amazonaws.com/hive
HIVE_GOVERNANCE_REGULATION=hipaa
HIVE_GOVERNANCE_DATA_RESIDENCY=us-east-1
HIVE_GOVERNANCE_RETENTION_DAYS=365
LOG_LEVEL=info
ENABLE_METRICS=true
TLS_CERT=/etc/hive/certs/cert.pem
TLS_KEY=/etc/hive/certs/key.pem
```

Start:

```bash
source .env.hipaa
docker-compose up -d
```

Verify:

```bash
curl https://node.hive.mycompany.com/api/v1/compliance/hipaa
# Output:
# {
#   "framework": "hipaa",
#   "compliant": true,
#   "checks": [
#     { "name": "pii_asserted_false", "pass": true },
#     { "name": "content_asserted_false", "pass": true },
#     { "name": "regulation_tag", "pass": true },
#     { "name": "data_residency_us", "pass": true },
#     { "name": "retention_years", "pass": true },
#     { "name": "audit_logs", "pass": true }
#   ]
# }
```

---

Next: [Data Model & TimescaleDB](/architecture/data-model) or [Connectors](/connectors/overview).
