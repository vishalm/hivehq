import { describe, expect, it } from 'vitest'
import { AccountResolver } from './account-resolver.js'
import type { ClaudeScoutConfig } from './config.js'

const cfg: ClaudeScoutConfig = {
  accounts: [
    { name: 'personal', account_id: 'acct_p', cwd_prefix: '/home/me/personal' },
    { name: 'work', account_id: 'acct_w', cwd_prefix: '/home/me/work' },
    {
      name: 'work-secret',
      account_id: 'acct_w_secret',
      cwd_prefix: '/home/me/work/secret',
    },
  ],
  default_account: 'personal',
  poll_interval_ms: 2000,
}

describe('AccountResolver', () => {
  it('resolves exact cwd_prefix match', () => {
    const r = new AccountResolver(cfg)
    expect(r.resolve('/home/me/work').name).toBe('work')
  })

  it('resolves descendant paths', () => {
    const r = new AccountResolver(cfg)
    expect(r.resolve('/home/me/work/project-a').name).toBe('work')
  })

  it('prefers longest-match', () => {
    const r = new AccountResolver(cfg)
    expect(r.resolve('/home/me/work/secret/project').name).toBe('work-secret')
  })

  it('falls back to default for unmatched cwd', () => {
    const r = new AccountResolver(cfg)
    expect(r.resolve('/opt/other').name).toBe('personal')
  })

  it('falls back to default for undefined cwd', () => {
    const r = new AccountResolver(cfg)
    expect(r.resolve(undefined).name).toBe('personal')
  })

  it('treats /home/me/worker as non-matching', () => {
    const r = new AccountResolver(cfg)
    expect(r.resolve('/home/me/worker').name).toBe('personal')
  })

  it('throws on default_account that is missing from accounts', () => {
    expect(
      () =>
        new AccountResolver({
          ...cfg,
          default_account: 'ghost',
        }),
    ).toThrow()
  })
})
