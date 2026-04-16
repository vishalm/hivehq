---
sidebar_position: 2
title: "TTP Protocol Specification"
description: "Token Telemetry Protocol - Wire format, batching, signing, and schema"
---

# TTP Protocol Specification

TTP (Token Telemetry Protocol) is the wire format for AI consumption events. It is stateless, JSON-based, signed, and schema-validated.

## Overview

TTP is designed to:
- Be language-agnostic (JSON)
- Enable batch processing (reduce overhead)
- Provide cryptographic guarantees (Ed25519)
- Freeze governance compliance (immutable GovernanceBlock)
- Support audit chains (Merkle anchoring)

Version: **0.1** (as of 2026-04-16)

## Event Schema

A single TTP event represents one AI provider API call.

```typescript
interface TTPEvent {
  // Timing
  timestamp: string;              // ISO 8601, UTC (e.g., "2026-04-16T12:34:56Z")
  
  // Provider and Model
  provider: "openai" | "anthropic" | "ollama" | "google" | "mistral" | "bedrock" | "azure";
  model: string;                  // e.g., "gpt-4", "claude-opus", "llama2"
  
  // Tokens (required)
  tokens_prompt: number;          // Tokens in the prompt/input
  tokens_completion?: number;     // Tokens in the completion/output (optional for embedding)
  tokens_total?: number;          // Total tokens used (optional, computed if not provided)
  
  // Cost (USD, optional but recommended)
  cost_usd?: number;              // Total cost in USD for this call
  cost_prompt_usd?: number;       // Cost for prompt tokens
  cost_completion_usd?: number;   // Cost for completion tokens
  
  // Performance
  latency_ms?: number;            // Request latency in milliseconds
  error?: string;                 // Error message if request failed (e.g., "rate_limit")
  
  // Metadata
  department?: string;            // Cost center or team ID (e.g., "eng", "mkt")
  request_id?: string;            // Unique request identifier (for tracing)
  trace_id?: string;              // Distributed trace ID
  user_id?: string;               // User/role identifier (hashed, not plaintext)
  
  // Resource Usage (optional)
  cache_tokens_read?: number;     // Tokens served from cache (if applicable)
  cache_hit?: boolean;            // Whether cache was hit
}
```

### Notes

- **Timestamps** must be valid ISO 8601 format, preferably UTC. Node rejects malformed dates.
- **Provider** must be one of the enum values. Unknown providers are rejected.
- **Model** is a free string (allows flexibility for new models).
- **Tokens** are integers. Negative values are rejected.
- **Cost** is decimal precision (USD). HIVE stores as NUMERIC(10,6) in the database.
- **Department** is optional but highly recommended for cost allocation.
- **No content fields**: Prompts, completions, API keys, or any sensitive data are **not** included.

## Batch Envelope

Events are shipped in batches. Scout creates a batch envelope:

```typescript
interface TTPBatch {
  // Metadata
  batch_id: string;               // Unique batch identifier (UUID)
  created_at: string;             // ISO 8601 timestamp
  sequence_number: number;        // Monotonically increasing per Scout instance
  
  // Events
  events: TTPEvent[];             // Array of events (1-1000 per batch)
  event_count: number;            // Length of events array
  
  // Governance (immutable)
  governance: GovernanceBlock;
  
  // Cryptography
  signature: string;              // Ed25519 signature (base64 or hex)
  signature_algorithm: "ed25519"; // Only algorithm supported
  signing_key_id: string;         // Public key identifier (for key rotation)
  
  // Audit Chain
  merkle_anchor?: string;         // Root of Merkle tree (for tamper detection)
  merkle_anchor_time?: string;    // When anchor was computed
}
```

### GovernanceBlock (Immutable)

```typescript
interface GovernanceBlock {
  // Privacy Guarantees (frozen to false)
  pii_asserted: false;            // Always false. Cannot be changed.
  content_asserted: false;        // Always false. Cannot be changed.
  
  // Regulation
  regulation: "none" | "hipaa" | "gdpr" | "sox" | "sox-hipaa" | "ccpa";
  
  // Data Residency
  data_residency: string;         // e.g., "us-east-1", "eu-west-1", "ap-southeast-1"
  
  // Retention Policy
  retention_days: number;         // Auto-purge after N days (30-365)
  purge_at: string;               // ISO 8601 timestamp of scheduled deletion
}
```

The `pii_asserted: false` and `content_asserted: false` are enforced at the TypeScript type level using `z.literal(false)` in Zod:

```typescript
const GovernanceBlock = z.object({
  pii_asserted: z.literal(false),
  content_asserted: z.literal(false),
  // ...
});
```

This prevents accidental or malicious modifications.

## Wire Format

TTP batches are sent as JSON via HTTPS POST:

```bash
POST /api/v1/ttp/ingest HTTP/1.1
Host: node.hive.mycompany.com
Content-Type: application/json
Content-Length: 2048

{
  "batch_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "created_at": "2026-04-16T12:34:56Z",
  "sequence_number": 42,
  "events": [
    {
      "timestamp": "2026-04-16T12:34:00Z",
      "provider": "openai",
      "model": "gpt-4",
      "tokens_prompt": 100,
      "tokens_completion": 50,
      "cost_usd": 0.003,
      "latency_ms": 1234,
      "department": "engineering"
    },
    {
      "timestamp": "2026-04-16T12:34:15Z",
      "provider": "anthropic",
      "model": "claude-opus",
      "tokens_prompt": 200,
      "tokens_completion": 100,
      "cost_usd": 0.008,
      "latency_ms": 2100,
      "department": "engineering"
    }
  ],
  "event_count": 2,
  "governance": {
    "pii_asserted": false,
    "content_asserted": false,
    "regulation": "none",
    "data_residency": "us-east-1",
    "retention_days": 90,
    "purge_at": "2026-07-15T12:34:56Z"
  },
  "signature": "signature_base64_...",
  "signature_algorithm": "ed25519",
  "signing_key_id": "key-v1-2026-04-15",
  "merkle_anchor": "abcd1234ef5678...",
  "merkle_anchor_time": "2026-04-16T12:00:00Z"
}
```

## Signing (Ed25519)

Scout signs each batch before shipping. Node verifies the signature.

### Key Generation

Scout generates an Ed25519 keypair on first run:

```bash
$ npm install @hive/scout
$ node -e "const scout = require('@hive/scout'); scout.generateKeys();"
# Outputs:
# Keys written to .hive/keys/ed25519_secret.pem
# Public key: 8F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A
```

### Signature Computation

TTP payload (all fields except `signature` and `signature_algorithm`) is signed:

```typescript
const payload = {
  batch_id: "a1b2c3d4-...",
  created_at: "2026-04-16T12:34:56Z",
  sequence_number: 42,
  events: [...],
  event_count: 2,
  governance: {...},
  signing_key_id: "key-v1-...",
  merkle_anchor: "abcd1234...",
  merkle_anchor_time: "2026-04-16T12:00:00Z"
};

const message = JSON.stringify(payload, null, 0);  // Deterministic JSON
const signature = ed25519.sign(message, secretKey);
const signatureBase64 = signature.toString('base64');
```

### Signature Verification (Node)

Node verifies before ingestion:

```typescript
const publicKey = keyRegistry.get(batch.signing_key_id);
const payload = batch;
delete payload.signature;  // Exclude signature from verification

const message = JSON.stringify(payload, null, 0);
const verified = ed25519.verify(
  Buffer.from(batch.signature, 'base64'),
  message,
  publicKey
);

if (!verified) {
  throw new Error('Invalid signature');
}
```

Batches with invalid or missing signatures are rejected with HTTP 401.

## Merkle Anchoring

Scout optionally computes Merkle anchors to create audit chains. This enables tamper detection and historical verification.

### Merkle Tree Construction

A Merkle tree is built from a sequence of events:

```
                       root_hash
                          |
            ┌───────────────┴───────────────┐
            |                               |
         hash_0_1                        hash_2_3
            |                               |
      ┌─────┴─────┐                   ┌─────┴─────┐
      |           |                   |           |
   event_0    event_1              event_2    event_3
```

Each leaf is `SHA256(event_json)`. Parent nodes are `SHA256(left_hash + right_hash)`.

The root hash is the `merkle_anchor` included in the batch.

### Anchor Verification

Node stores the Merkle anchor with each batch. Later, any query can verify:

```typescript
const batch = db.getBatch('a1b2c3d4-...');
const events = batch.events;

let tree = events.map(e => sha256(JSON.stringify(e)));
while (tree.length > 1) {
  const nextLevel = [];
  for (let i = 0; i < tree.length; i += 2) {
    const left = tree[i];
    const right = tree[i + 1] || left;  // Odd tree, duplicate last
    nextLevel.push(sha256(left + right));
  }
  tree = nextLevel;
}

const computedRoot = tree[0];
if (computedRoot !== batch.merkle_anchor) {
  throw new Error('Merkle anchor mismatch! Batch was tampered with.');
}
```

## Error Handling

### Request Validation

Node validates each batch:

| Check | Error | HTTP |
|-------|-------|------|
| TTP schema mismatch | `"Invalid TTP schema: [details]"` | 400 |
| Invalid timestamp | `"Timestamp out of acceptable range"` | 400 |
| Negative tokens | `"Tokens must be non-negative"` | 400 |
| Unknown provider | `"Unknown provider: xyz"` | 400 |
| Missing signature | `"Signature required"` | 401 |
| Invalid signature | `"Signature verification failed"` | 401 |
| GovernanceBlock violation | `"GovernanceBlock invalid: pii_asserted=true"` | 403 |

### Response

Successful ingestion:

```json
{
  "status": "success",
  "batch_id": "a1b2c3d4-...",
  "events_ingested": 2,
  "timestamp": "2026-04-16T12:35:00Z"
}
```

Error response:

```json
{
  "status": "error",
  "code": "SCHEMA_VALIDATION_ERROR",
  "message": "tokens_prompt must be a non-negative integer",
  "batch_id": "a1b2c3d4-..."
}
```

## Rate Limiting

Scout is backoff-aware. Node applies rate limits:

- **Burst**: 100 batches per second
- **Sustained**: 1000 batches per minute
- **Per-source**: Identified by signing key ID

Exceeding limits returns HTTP 429 (Too Many Requests).

Scout automatically retries with exponential backoff (1s, 2s, 4s, 8s, max 60s).

## Backward Compatibility

TTP spec is versioned. Future versions may add optional fields. Node gracefully ignores unknown fields.

Required fields must always be present. If a required field is removed in a future version, it will be marked deprecated but still accepted.

## Example: Complete Batch

Here's a realistic multi-event batch:

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
      "department": "engineering",
      "request_id": "req-001",
      "cache_hit": false
    },
    {
      "timestamp": "2026-04-16T14:29:30Z",
      "provider": "anthropic",
      "model": "claude-opus",
      "tokens_prompt": 200,
      "tokens_completion": 120,
      "cost_usd": 0.0096,
      "latency_ms": 1800,
      "department": "engineering",
      "request_id": "req-002",
      "cache_hit": false
    },
    {
      "timestamp": "2026-04-16T14:29:45Z",
      "provider": "ollama",
      "model": "mistral",
      "tokens_prompt": 100,
      "tokens_completion": 50,
      "cost_usd": 0.0,
      "latency_ms": 500,
      "department": "engineering",
      "request_id": "req-003",
      "cache_hit": false
    }
  ],
  "event_count": 3,
  "governance": {
    "pii_asserted": false,
    "content_asserted": false,
    "regulation": "none",
    "data_residency": "us-east-1",
    "retention_days": 90,
    "purge_at": "2026-07-15T14:30:00Z"
  },
  "signature": "MEUCIQD+QxNnqR8PQ...truncated...AQECQF1qoILz8=",
  "signature_algorithm": "ed25519",
  "signing_key_id": "key-prod-2026-04-15",
  "merkle_anchor": "a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a",
  "merkle_anchor_time": "2026-04-16T14:00:00Z"
}
```

---

Next: [Governance & Compliance](/architecture/governance) or [Data Model](/architecture/data-model).
