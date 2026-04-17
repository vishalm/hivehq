import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from './middleware.js'
import type { AuthContext } from './types.js'

function mockReq(auth?: AuthContext): Request {
  return { auth } as unknown as Request
}

function mockRes(): Response & { _status: number; _body: unknown } {
  const res = {
    _status: 200,
    _body: null,
    status(code: number) {
      res._status = code
      return res
    },
    json(body: unknown) {
      res._body = body
      return res
    },
  }
  return res as unknown as Response & { _status: number; _body: unknown }
}

describe('requireRole middleware', () => {
  it('passes when user has the required role', () => {
    const req = mockReq({
      user_id: 'u1',
      email: 'admin@hive.local',
      name: 'Admin',
      roles: ['admin'],
      tenant_id: '00000000-0000-0000-0000-000000000001',
      tenant_type: 'company',
      deployment_mode: 'bespoke',
      auth_method: 'oidc',
    })
    const res = mockRes()
    const next = vi.fn()

    requireRole('admin')(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res._status).toBe(200)
  })

  it('passes when user has a higher role (inheritance)', () => {
    const req = mockReq({
      user_id: 'u1',
      email: 'admin@hive.local',
      name: 'Admin',
      roles: ['admin'],
      tenant_id: '00000000-0000-0000-0000-000000000001',
      tenant_type: 'company',
      deployment_mode: 'bespoke',
      auth_method: 'oidc',
    })
    const res = mockRes()
    const next = vi.fn()

    requireRole('viewer')(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('rejects when user lacks the required role', () => {
    const req = mockReq({
      user_id: 'u1',
      email: 'viewer@hive.local',
      name: 'Viewer',
      roles: ['viewer'],
      tenant_id: '00000000-0000-0000-0000-000000000001',
      tenant_type: 'company',
      deployment_mode: 'bespoke',
      auth_method: 'oidc',
    })
    const res = mockRes()
    const next = vi.fn()

    requireRole('admin')(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res._status).toBe(403)
    expect(res._body).toHaveProperty('error', 'forbidden')
  })

  it('returns 401 when no auth context', () => {
    const req = mockReq(undefined)
    const res = mockRes()
    const next = vi.fn()

    requireRole('viewer')(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res._status).toBe(401)
  })

  it('accepts any of multiple required roles', () => {
    const req = mockReq({
      user_id: 'u1',
      email: 'auditor@hive.local',
      name: 'Auditor',
      roles: ['gov_auditor'],
      tenant_id: '00000000-0000-0000-0000-000000000001',
      tenant_type: 'company',
      deployment_mode: 'bespoke',
      auth_method: 'oidc',
    })
    const res = mockRes()
    const next = vi.fn()

    requireRole('admin', 'gov_auditor')(req, res, next)
    expect(next).toHaveBeenCalled()
  })
})
