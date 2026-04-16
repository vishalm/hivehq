# HATP — Hive AI Telemetry Protocol

**Version:** 0.1 (Draft · April 2026)
**Status:** Reference implementation: [`@hive/shared`](../packages/shared)
**License:** MIT. No CLA required.

HATP is an open wire protocol for AI-consumption telemetry. It is designed to
be emitted by any client (Scout, SDK, proxy, agent, sidecar), verified by any
receiver (self-hosted Node, federated Hive, independent auditor), and audited
by any third party without requiring access to model inputs, outputs, or keys.

HATP is the covenant: **content is architecturally excluded from the protocol.
There is no prompt, no completion, no user payload, ever.**

---

## 1. Design Goals

1. **Zero content.** No request body, no response body, no system prompt. Only
   sizes, timings, model hints, and governance metadata. Content exclusion is
   *structural*: the canonical schema cannot express content fields.
2. **One event shape.** Scouts, SDKs, proxies, bridges — all emit the same
   `HATPEvent`. Receivers never need a per-emitter adapter.
3. **Open by default.** Versioned Zod schema + published schema hash. Any
   implementation in any language can parse and produce HATP.
4. **Verifiable provenance.** Every batch is signed with Ed25519; receivers
   verify against a published key directory and reject unsigned batches at
   federation boundaries.
5. **Governance-native.** Consent basis, data residency, retention, and
   regulation tags travel with every event. Filtering happens at ingest, not
   in downstream ETL.
6. **Tamper-evident.** Events are stored in a hash-chained audit log; daily
   Merkle roots are published so auditors can detect retroactive edits.

---

## 2. Wire Schema

### 2.1 HATPEvent

The canonical event. See `HATPEventSchema` in
[`packages/shared/src/hatp.ts`](../packages/shared/src/hatp.ts).

```
HATPEvent := {
  hatp_version:     "0.1"
  event_id:         UUIDv4
  schema_hash:      "sha256:<64 hex>"

  timestamp:        unix_ms_int          # when the call happened
  observed_at:      unix_ms_int          # when the scout observed it

  emitter_id:       string               # rotating id — never raw PII
  emitter_type:     "scout" | "sdk" | "proxy" | "agent" | "sidecar"
  org_node_id:      string?              # the node this event eventually lands on
  session_hash:     string               # hash of (device + session salt + day)

  provider:         enum(CORE_PROVIDERS) | "custom:<slug>"
  provider_version: string?
  endpoint:         string               # path only, no query
  model_hint:       string               # e.g. "gpt-4o-2024-08-06"
  model_family:     string?

  direction:        "request" | "response" | "stream_chunk" | "stream_end" | "error"
  payload_bytes:    int>=0
  latency_ms:       number>=0?
  ttfb_ms:          number>=0?
  status_code:      int
  estimated_tokens: int>=0
  token_breakdown:  { prompt_tokens?, completion_tokens?, cached_tokens?, reasoning_tokens? }?

  dept_tag:         string?
  project_tag:      string?
  env_tag:          "production" | "staging" | "development" | "ci"?
  use_case_tag:     string?

  deployment:       "solo" | "node" | "federated" | "open"
  node_region:      /^[A-Z]{2}$/?

  governance:       GovernanceBlock      # see §2.2

  signature:        string?              # reserved for per-event signing
}
```

### 2.2 GovernanceBlock

Every event carries a governance block. The protocol freezes two fields:

```
GovernanceBlock := {
  consent_basis:     "contract" | "legitimate_interest" | "consent" | "org_policy"
  data_residency:    ISO-3166-1-alpha-2 country code
  retention_days:    int (1..3650)
  regulation_tags:   string[]            # e.g. "UAE_AI_LAW", "GDPR", "HIPAA"
  pii_asserted:      false               # structurally false — cannot be set true
  content_asserted:  false               # structurally false — cannot be set true
}
```

`pii_asserted` and `content_asserted` use `z.literal(false)` — any event
setting them `true` is rejected at parse time. This is the protocol's promise
to auditors: HATP events never carry PII or model content.

### 2.3 HATPBatch

Events are shipped in batches of 1–500. The batch wrapper carries a short
`batch_id`, the `emitter_id`, and (recommended) a `SignedBatchEnvelope`.

```
HATPBatch := {
  batch_id:    string
  emitter_id:  string
  events:      HATPEvent[]     (1..500)
  signature:   SignedBatchEnvelope?
}
```

### 2.4 SignedBatchEnvelope

```
SignedBatchEnvelope := {
  hatp_version:   "0.1"
  schema_hash:    "sha256:<64 hex>"
  events_digest:  sha256(sorted-canonical-events), hex
  signature:      Ed25519(surface), base64url
  kid:            key fingerprint, 16 hex chars
  signed_at:      unix_ms_int
}
```

The **signing surface** is the UTF-8 bytes of:

```
<hatp_version> "." <schema_hash> "." <events_digest>
```

`events_digest` is the sha256 of canonicalised events, sorted
lexicographically so the digest is independent of batch ordering.

Receivers MUST verify the signature before any downstream processing when
configured with a non-empty trust store.

---

## 3. Audit Chain

The Node Hub stores every accepted event in a hash-chained audit log:

```
event_hash_i = sha256( event_hash_{i-1} || canonicalize(event_i) )
```

`canonicalize` produces key-sorted JSON with undefined fields omitted — the
same form used for Merkle aggregation. `event_hash_0` uses the genesis
constant `"0" × 64`. Auditors verify the chain by recomputing hashes.

Daily Merkle roots are published:

```
DailyAnchor := {
  date:              YYYY-MM-DD
  region:            ISO-3166-1-alpha-2
  seq_start:         int
  seq_end:           int
  merkle_root:       64 hex
  head_event_hash:   64 hex
  published_at:      unix_ms_int
}
```

Anchors SHOULD be cross-posted to a transparency log (Sigstore/Rekor, a git
commit, or a public webhook) so no operator can silently rewrite history.

---

## 4. Canonical JSON

Signing and hashing use a deterministic JSON form:

1. Fields with `undefined` values are omitted.
2. Keys are sorted lexicographically (ASCII code-point order).
3. No trailing whitespace, no indentation.
4. UTF-8, strict.

Reference implementation: `canonicalize()` in
[`packages/shared/src/hatp.ts`](../packages/shared/src/hatp.ts).

---

## 5. Provider Identifiers

Core providers are enumerated in
[`packages/shared/src/providers.ts`](../packages/shared/src/providers.ts):

```
openai | anthropic | google | azure_openai | bedrock |
mistral | cohere | groq | together | ollama
```

Any other provider is represented as `custom:<slug>` where `slug` is
`[a-z0-9_-]+`. Non-registered providers MUST NOT claim core identifiers.

---

## 6. Deployment Modes

| Mode        | Description                                                    | Residency enforcement |
|-------------|----------------------------------------------------------------|------------------------|
| `solo`      | Scout-only. No network egress. Events buffer in memory.        | n/a                   |
| `node`      | Scout → org-owned Node Hub. Private.                           | governance.data_residency |
| `federated` | Nodes exchange rollups with peers. Still private by default.   | node_region must match ingest region |
| `open`      | Public-interest Hive. Fully signed + aggregated research data. | node_region required + signed |

---

## 7. Versioning

- `hatp_version` is a dotted major.minor string.
- Breaking changes bump the major. Additive, optional fields bump minor.
- Receivers MUST reject events with a major version they do not implement.
- `schema_hash` is regenerated on every schema change and serves as a
  tripwire: if a sender and receiver disagree on schema_hash, neither trusts
  the other until the hash directory is reconciled.

---

## 8. Governance & Compliance

HATP is compatible with, but not bound to, specific regulatory regimes.
Built-in recognisers include:

- `UAE_AI_LAW` — Federal Decree-Law on the responsible use of AI (UAE)
- `PDPL` — UAE Personal Data Protection Law
- `GDPR` — EU General Data Protection Regulation
- `EU_AI_ACT` — EU Artificial Intelligence Act
- `CCPA` — California Consumer Privacy Act
- `HIPAA` — US Health Insurance Portability and Accountability Act
- `SOC2`, `ISO27001` — operational compliance frameworks

Tags are free-form strings; regulators MAY publish canonical tag lists.

---

## 9. Conformance

A conforming HATP implementation:

1. Produces events that parse cleanly against `HATPEventSchema`.
2. Rejects events that attempt `pii_asserted: true` or `content_asserted: true`.
3. Implements canonicalisation identical to §4.
4. Signs batches with Ed25519 when operating in `federated` or `open` mode.
5. Publishes a JWKS-lite key directory for each `kid`.
6. Honours residency constraints on ingest.

The `@hive/shared`, `@hive/node-server`, and `@hive/scout` packages are the
reference implementation. Third-party implementations in Python, Go, Rust,
Java, and .NET are welcome and should version-align on `hatp_version`.

---

## 10. Open Questions (v0.2+)

- **PSI-based cross-org aggregates.** Private set intersection over session
  hashes so multiple orgs can compute shared token totals without revealing
  per-org identities.
- **Differential privacy** on public aggregates shared via `open` deployment.
- **Per-event signatures** (the reserved `signature` field) for receivers
  that can't trust their ingest path.
- **Structured error taxonomy** beyond string codes.

---

## 11. Governance of the Protocol

HATP is developed in public at `github.com/vishalm/hivehq`. Breaking changes
require:

1. A published RFC on the repo
2. Two independent reference implementations
3. 90 days of comment period
4. A published migration note covering `schema_hash` transition

No single company controls HATP. Anyone can fork, ship, and audit.
