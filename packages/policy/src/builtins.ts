import type { PolicyDocument } from './types.js'

/**
 * UAE data-residency policy — deny events that aren't produced in AE
 * and aren't tagged with UAE_AI_LAW. Matches HIVE's default deployment.
 */
export const uaeResidencyPolicy: PolicyDocument = {
  version: 1,
  name: 'uae-residency-v1',
  default_decision: 'allow',
  rules: [
    {
      id: 'deny-non-ae-residency',
      priority: 100,
      decision: 'deny',
      reason: 'RESIDENCY_VIOLATION: governance.data_residency must be AE',
      when: {
        op: 'not',
        rule: { op: 'eq', path: 'governance.data_residency', value: 'AE' },
      },
    },
    {
      id: 'warn-missing-uae-tag',
      priority: 50,
      decision: 'route',
      route: 'audit-review',
      reason: 'Missing UAE_AI_LAW regulation tag',
      when: {
        op: 'not',
        rule: { op: 'contains', path: 'governance.regulation_tags', value: 'UAE_AI_LAW' },
      },
    },
  ],
}

/**
 * Shadow AI detection — any request hitting a non-sanctioned provider
 * is routed to security review.
 */
export function buildShadowAIPolicy(sanctioned: string[]): PolicyDocument {
  return {
    version: 1,
    name: 'shadow-ai-v1',
    default_decision: 'allow',
    rules: [
      {
        id: 'route-unsanctioned-provider',
        priority: 100,
        decision: 'route',
        route: 'security-review',
        reason: 'Shadow AI: unsanctioned provider',
        when: {
          op: 'notIn',
          path: 'provider',
          values: sanctioned,
        },
      },
    ],
  }
}

/**
 * Retention-window policy — deny events asking for retention > maxDays.
 */
export function buildRetentionPolicy(maxDays: number): PolicyDocument {
  return {
    version: 1,
    name: `retention-max-${maxDays}d-v1`,
    default_decision: 'allow',
    rules: [
      {
        id: 'deny-excess-retention',
        priority: 100,
        decision: 'deny',
        reason: `retention_days exceeds organisational max of ${maxDays}`,
        when: { op: 'gt', path: 'governance.retention_days', value: maxDays },
      },
    ],
  }
}

/**
 * Compose multiple policies into a first-deny-wins chain.
 */
export function composePolicies(...docs: PolicyDocument[]): PolicyDocument {
  const rules = docs.flatMap((d, idx) =>
    d.rules.map((r) => ({
      ...r,
      id: `${d.name}:${r.id}`,
      priority: (r.priority ?? 0) + (docs.length - idx) * 1000,
    })),
  )
  return {
    version: 1,
    name: docs.map((d) => d.name).join('+'),
    default_decision: 'allow',
    rules,
  }
}
