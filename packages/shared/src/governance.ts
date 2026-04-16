/**
 * HATP GovernanceBlock — the compliance layer.
 *
 * Every HATPEvent carries a GovernanceBlock. This is not optional.
 * `pii_asserted: false` and `content_asserted: false` are protocol-enforced
 * constants — they cannot be set to true. Compliance is structural.
 */

import { z } from 'zod'

export const ConsentBasisSchema = z.enum([
  'legitimate_interest',
  'org_policy',
  'explicit',
  'not_applicable',
])
export type ConsentBasis = z.infer<typeof ConsentBasisSchema>

export const KNOWN_REGULATION_TAGS = [
  'GDPR',
  'CCPA',
  'UAE_AI_LAW',
  'EU_AI_ACT',
  'PDPL',
  'HIPAA',
  'SOC2',
  'ISO27001',
] as const

export type KnownRegulationTag = (typeof KNOWN_REGULATION_TAGS)[number]
export type CustomRegulationTag = `custom:${string}`
export type RegulationTag = KnownRegulationTag | CustomRegulationTag

export const RegulationTagSchema = z.union([
  z.enum(KNOWN_REGULATION_TAGS),
  z.custom<CustomRegulationTag>(
    (val) => typeof val === 'string' && /^custom:[A-Za-z0-9][A-Za-z0-9-_]{0,63}$/.test(val),
  ),
])

/**
 * The governance block. pii_asserted and content_asserted are frozen `false`
 * literals — attempting to set them to true will fail validation.
 */
export const GovernanceBlockSchema = z
  .object({
    consent_basis: ConsentBasisSchema,
    data_residency: z.string().min(2).max(8),
    retention_days: z.number().int().min(-1),
    regulation_tags: z.array(RegulationTagSchema),
    pii_asserted: z.literal(false),
    content_asserted: z.literal(false),
  })
  .strict()

export type GovernanceBlock = z.infer<typeof GovernanceBlockSchema>

/**
 * Default governance block for UAE-hosted deployments.
 */
export function defaultUAEGovernance(overrides: Partial<GovernanceBlock> = {}): GovernanceBlock {
  // Strip frozen literals from the override set so they cannot be flipped.
  const {
    pii_asserted: _piiIgnored,
    content_asserted: _contentIgnored,
    ...safeOverrides
  } = overrides
  void _piiIgnored
  void _contentIgnored
  return {
    consent_basis: 'org_policy',
    data_residency: 'AE',
    retention_days: 90,
    regulation_tags: ['UAE_AI_LAW', 'GDPR'],
    ...safeOverrides,
    // Protocol invariants — always false, always last.
    pii_asserted: false,
    content_asserted: false,
  }
}
