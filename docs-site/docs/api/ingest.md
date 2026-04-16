---
sidebar_position: 1
title: "Ingest API"
description: "TTP batch ingestion endpoint"
---

# Ingest API

The primary endpoint for shipping TTP batches from Scout to HIVE Node.

## Endpoint

```
POST /api/v1/ttp/ingest
```

## Authentication

No authentication required (can be secured with firewall rules or API keys in future).

Currently:
```
# Unauthenticated
curl -X POST http://localhost:3001/api/v1/ttp/ingest \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Request

TTP batch envelope (see [TTP Protocol](/architecture/ttp-protocol)):

```json
{
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-04-16T14:30:00Z",
  "sequence_number": 123,
  "events": [
    {
      "timestamp": "2026-04-16T14:29:00Z",
      "provider": "openai",
      "model": "gpt-4",
      "tokens_prompt": 150,
      "tokens_completion": 75,
      "cost_usd": 0.0045,
      "latency_ms": 2100,
      "department": "engineering"
    }
  ],
  "event_count": 1,
  "governance": {
    "pii_asserted": false,
    "content_asserted": false,
    "regulation": "none",
    "data_residency": "us-east-1",
    "retention_days": 90,
    "purge_at": "2026-07-15T14:30:00Z"
  },
  "signature": "MEUCIQD+...",
  "signature_algorithm": "ed25519",
  "signing_key_id": "key-v1-2026-04-15",
  "merkle_anchor": "a1b2c3d4...",
  "merkle_anchor_time": "2026-04-16T14:00:00Z"
}
```

## Response

**Success (200 OK)**

```json
{
  "status": "success",
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "events_ingested": 1,
  "timestamp": "2026-04-16T14:35:00Z"
}
```

**Validation Error (400 Bad Request)**

```json
{
  "status": "error",
  "code": "SCHEMA_VALIDATION_ERROR",
  "message": "tokens_prompt must be a non-negative integer",
  "batch_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Signature Invalid (401 Unauthorized)**

```json
{
  "status": "error",
  "code": "SIGNATURE_VERIFICATION_FAILED",
  "message": "Ed25519 signature verification failed",
  "batch_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Governance Violation (403 Forbidden)**

```json
{
  "status": "error",
  "code": "GOVERNANCE_VIOLATION",
  "message": "GovernanceBlock invalid: pii_asserted must be false",
  "batch_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Rate Limited (429 Too Many Requests)**

```json
{
  "status": "error",
  "code": "RATE_LIMITED",
  "message": "Too many batches. Retry after 60 seconds.",
  "retry_after_seconds": 60
}
```

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `SCHEMA_VALIDATION_ERROR` | 400 | TTP schema mismatch or invalid values |
| `SIGNATURE_VERIFICATION_FAILED` | 401 | Ed25519 signature is invalid |
| `GOVERNANCE_VIOLATION` | 403 | GovernanceBlock compliance failure |
| `RATE_LIMITED` | 429 | Batch rate exceeded |
| `INTERNAL_ERROR` | 500 | Server error (should be rare) |

## Rate Limiting

- **Burst**: 100 batches/second
- **Sustained**: 1000 batches/minute
- **Per source**: Identified by signing key ID

When limit exceeded:
```
HTTP 429 Too Many Requests
Retry-After: 60
```

Scout automatically retries with exponential backoff.

## Examples

### Python

```python
import requests
import json
from datetime import datetime

batch = {
    "batch_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": datetime.utcnow().isoformat() + "Z",
    "sequence_number": 1,
    "events": [
        {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "provider": "openai",
            "model": "gpt-4",
            "tokens_prompt": 100,
            "tokens_completion": 50,
            "cost_usd": 0.003,
            "department": "engineering"
        }
    ],
    "event_count": 1,
    "governance": {
        "pii_asserted": False,
        "content_asserted": False,
        "regulation": "none",
        "data_residency": "us-east-1",
        "retention_days": 90
    },
    "signature": "...",
    "signature_algorithm": "ed25519",
    "signing_key_id": "key-v1"
}

response = requests.post(
    "http://localhost:3001/api/v1/ttp/ingest",
    json=batch,
    headers={"Content-Type": "application/json"}
)

print(response.json())
```

### cURL

```bash
curl -X POST http://localhost:3001/api/v1/ttp/ingest \
  -H "Content-Type: application/json" \
  -d @batch.json
```

### JavaScript

```javascript
const batch = {
  batch_id: "550e8400-e29b-41d4-a716-446655440000",
  created_at: new Date().toISOString(),
  sequence_number: 1,
  events: [...],
  ...
};

const response = await fetch('http://localhost:3001/api/v1/ttp/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(batch)
});

const result = await response.json();
console.log(result);
```

## Performance

Typical ingestion latency:
- Validation: < 10ms
- Database insert: < 50ms
- Total: < 100ms

For high-throughput scenarios:
- Batch size: 10-100 events per batch
- Rate: 100-1000 batches/min
- Throughput: 1000-100,000 events/min

---

Next: [Events API](/api/events), [Intelligence API](/api/intelligence), [Config API](/api/config).
