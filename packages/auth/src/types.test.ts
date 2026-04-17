import { describe, it, expect } from 'vitest'
import {
  hasRole,
  ROLES,
  ROLE_HIERARCHY,
  TenantCreateSchema,
  ApiKeyCreateSchema,
  AuthEnvSchema,
} from './types.js'

describe('RBAC — hasRole', () => {
  it('viewer has viewer', () => {
    expect(hasRole(['viewer'], 'viewer')).toBe(true)
  })

  it('viewer does NOT have operator', () => {
    expect(hasRole(['viewer'], 'operator')).toBe(false)
  })

  it('operator inherits viewer', () => {
    expect(hasRole(['operator'], 'viewer')).toBe(true)
  })

  it('admin inherits operator and viewer', () => {
    expect(hasRole(['admin'], 'viewer')).toBe(true)
    expect(hasRole(['admin'], 'operator')).toBe(true)
  })

  it('super_admin inherits all regular roles', () => {
    expect(hasRole(['super_admin'], 'viewer')).toBe(true)
    expect(hasRole(['super_admin'], 'operator')).toBe(true)
    expect(hasRole(['super_admin'], 'admin')).toBe(true)
  })

  it('gov_auditor does NOT inherit regular roles', () => {
    expect(hasRole(['gov_auditor'], 'viewer')).toBe(false)
    expect(hasRole(['gov_auditor'], 'admin')).toBe(false)
  })

  it('empty roles fail', () => {
    expect(hasRole([], 'viewer')).toBe(false)
  })

  it('multiple roles — any match suffices', () => {
    expect(hasRole(['viewer', 'gov_auditor'], 'gov_auditor')).toBe(true)
  })
})

describe('ROLES constant', () => {
  it('has 5 roles', () => {
    expect(ROLES).toHaveLength(5)
  })

  it('hierarchy keys match ROLES', () => {
    for (const role of ROLES) {
      expect(ROLE_HIERARCHY).toHaveProperty(role)
    }
  })
})

describe('TenantCreateSchema', () => {
  it('validates a minimal tenant', () => {
    const result = TenantCreateSchema.safeParse({
      tenant_type: 'company',
      name: 'Test Co',
      slug: 'test-co',
      country_code: 'AE',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.plan).toBe('community')
      expect(result.data.data_residency).toBe('AE')
    }
  })

  it('rejects invalid slug', () => {
    const result = TenantCreateSchema.safeParse({
      tenant_type: 'company',
      name: 'Bad Slug',
      slug: 'Bad Slug!',
      country_code: 'AE',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid country code', () => {
    const result = TenantCreateSchema.safeParse({
      tenant_type: 'company',
      name: 'Test',
      slug: 'test',
      country_code: 'ae', // lowercase
    })
    expect(result.success).toBe(false)
  })
})

describe('ApiKeyCreateSchema', () => {
  it('validates with defaults', () => {
    const result = ApiKeyCreateSchema.safeParse({ name: 'My Key' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.roles).toEqual(['operator'])
      expect(result.data.expires_at).toBeNull()
    }
  })

  it('validates with custom roles', () => {
    const result = ApiKeyCreateSchema.safeParse({
      name: 'Admin Key',
      roles: ['admin', 'operator'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = ApiKeyCreateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('AuthEnvSchema', () => {
  it('accepts minimal env with defaults', () => {
    const result = AuthEnvSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.HIVE_AUTH_MODE).toBe('keycloak')
      expect(result.data.HIVE_DEPLOYMENT_MODE).toBe('bespoke')
      expect(result.data.KEYCLOAK_REALM).toBe('hive')
    }
  })

  it('accepts auth mode none', () => {
    const result = AuthEnvSchema.safeParse({ HIVE_AUTH_MODE: 'none' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid auth mode', () => {
    const result = AuthEnvSchema.safeParse({ HIVE_AUTH_MODE: 'magic' })
    expect(result.success).toBe(false)
  })
})
