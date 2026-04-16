import { z } from 'zod'

export type Decision = 'allow' | 'deny' | 'redact' | 'route'

export const DecisionSchema = z.enum(['allow', 'deny', 'redact', 'route'])

// ── Primitive predicates ────────────────────────────────────────────────────

const PathSchema = z.string().min(1)

export const PrimitivePredicateSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('eq'), path: PathSchema, value: z.unknown() }),
  z.object({ op: z.literal('neq'), path: PathSchema, value: z.unknown() }),
  z.object({ op: z.literal('in'), path: PathSchema, values: z.array(z.unknown()).min(1) }),
  z.object({ op: z.literal('notIn'), path: PathSchema, values: z.array(z.unknown()).min(1) }),
  z.object({ op: z.literal('matches'), path: PathSchema, pattern: z.string() }),
  z.object({ op: z.literal('gt'), path: PathSchema, value: z.number() }),
  z.object({ op: z.literal('lt'), path: PathSchema, value: z.number() }),
  z.object({ op: z.literal('gte'), path: PathSchema, value: z.number() }),
  z.object({ op: z.literal('lte'), path: PathSchema, value: z.number() }),
  z.object({ op: z.literal('exists'), path: PathSchema }),
  z.object({ op: z.literal('contains'), path: PathSchema, value: z.unknown() }),
])

export type PrimitivePredicate = z.infer<typeof PrimitivePredicateSchema>

// ── Predicate tree (lazy for recursion) ─────────────────────────────────────

export type Predicate =
  | PrimitivePredicate
  | { op: 'all'; rules: Predicate[] }
  | { op: 'any'; rules: Predicate[] }
  | { op: 'not'; rule: Predicate }

export const PredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    PrimitivePredicateSchema,
    z.object({ op: z.literal('all'), rules: z.array(PredicateSchema).min(1) }),
    z.object({ op: z.literal('any'), rules: z.array(PredicateSchema).min(1) }),
    z.object({ op: z.literal('not'), rule: PredicateSchema }),
  ]),
)

// ── Rules ────────────────────────────────────────────────────────────────────

export const PolicyRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  when: PredicateSchema,
  decision: DecisionSchema,
  reason: z.string().optional(),
  /** Optional tags for routing decisions (e.g. destination node region). */
  route: z.string().optional(),
  /** Optional paths to redact — only meaningful when decision === 'redact'. */
  redact: z.array(z.string()).optional(),
  /** Rule priority — higher wins. Defaults to 0. */
  priority: z.number().int().optional(),
  /** Disable the rule without deleting it. */
  enabled: z.boolean().optional(),
})

export type PolicyRule = z.infer<typeof PolicyRuleSchema>

export const PolicyDocumentSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  default_decision: DecisionSchema,
  rules: z.array(PolicyRuleSchema),
})

export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>

// ── Evaluation result ────────────────────────────────────────────────────────

export interface PolicyResult {
  decision: Decision
  matchedRuleId?: string
  reason?: string
  route?: string
  redactPaths?: string[]
}
