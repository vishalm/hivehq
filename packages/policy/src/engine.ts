import type { HATPEvent } from '@hive/shared'
import {
  PolicyDocumentSchema,
  type PolicyDocument,
  type PolicyResult,
  type Predicate,
  type PrimitivePredicate,
} from './types.js'

// ── Path resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a dot-path like `governance.data_residency` or `token_breakdown.completion_tokens`
 * against an event. Returns `undefined` if any segment is missing.
 */
export function resolvePath(event: HATPEvent, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = event
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[seg]
  }
  return current
}

// ── Predicate evaluation ─────────────────────────────────────────────────────

function isPrimitive(p: Predicate): p is PrimitivePredicate {
  return p.op !== 'all' && p.op !== 'any' && p.op !== 'not'
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => sameValue(v, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object' && a && b) {
    const aKeys = Object.keys(a as Record<string, unknown>).sort()
    const bKeys = Object.keys(b as Record<string, unknown>).sort()
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(
      (k, i) =>
        k === bKeys[i] &&
        sameValue(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    )
  }
  return false
}

export function evaluatePredicate(event: HATPEvent, p: Predicate): boolean {
  if (!isPrimitive(p)) {
    switch (p.op) {
      case 'all':
        return p.rules.every((r) => evaluatePredicate(event, r))
      case 'any':
        return p.rules.some((r) => evaluatePredicate(event, r))
      case 'not':
        return !evaluatePredicate(event, p.rule)
    }
  }

  const v = resolvePath(event, p.path)
  switch (p.op) {
    case 'eq':
      return sameValue(v, p.value)
    case 'neq':
      return !sameValue(v, p.value)
    case 'in':
      return p.values.some((target) => sameValue(v, target))
    case 'notIn':
      return p.values.every((target) => !sameValue(v, target))
    case 'matches':
      return typeof v === 'string' && new RegExp(p.pattern).test(v)
    case 'gt':
      return typeof v === 'number' && v > p.value
    case 'lt':
      return typeof v === 'number' && v < p.value
    case 'gte':
      return typeof v === 'number' && v >= p.value
    case 'lte':
      return typeof v === 'number' && v <= p.value
    case 'exists':
      return v !== undefined
    case 'contains':
      return Array.isArray(v) && v.some((item) => sameValue(item, p.value))
  }
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class PolicyEngine {
  private readonly sortedRules: PolicyDocument['rules']

  constructor(private readonly doc: PolicyDocument) {
    const parsed = PolicyDocumentSchema.parse(doc)
    this.sortedRules = [...parsed.rules].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    )
  }

  get name(): string {
    return this.doc.name
  }

  /**
   * Evaluate the policy against an event. First rule to match wins
   * (rules are sorted by priority). Falls through to `default_decision`.
   */
  evaluate(event: HATPEvent): PolicyResult {
    for (const rule of this.sortedRules) {
      if (rule.enabled === false) continue
      if (evaluatePredicate(event, rule.when)) {
        return {
          decision: rule.decision,
          matchedRuleId: rule.id,
          reason: rule.reason,
          route: rule.route,
          redactPaths: rule.redact,
        }
      }
    }
    return { decision: this.doc.default_decision }
  }

  /**
   * Evaluate many events at once. Useful for batch admission control.
   */
  evaluateBatch(events: HATPEvent[]): PolicyResult[] {
    return events.map((e) => this.evaluate(e))
  }
}

/**
 * Validate + load a policy doc from untrusted input.
 */
export function loadPolicy(doc: unknown): PolicyEngine {
  return new PolicyEngine(PolicyDocumentSchema.parse(doc))
}
