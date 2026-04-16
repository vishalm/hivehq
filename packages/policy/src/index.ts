/**
 * @hive/policy — Declarative ABAC policy engine for HATP events.
 *
 * Governance-as-code: policies are plain JSON (or YAML → JSON), evaluated
 * at ingest. A policy decision is `allow | deny | redact | route`, with
 * an optional reason that lands in the audit log.
 *
 * Rules compose via `all`, `any`, `not` groups and primitive predicates:
 *   - eq, neq, in, notIn, matches (regex), gt, lt, gte, lte, exists
 * over a dot-path expression into the event.
 */

export * from './engine.js'
export * from './types.js'
export * from './builtins.js'
