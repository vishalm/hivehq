import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ClaudeScoutConfigSchema,
  defaultConfig,
  loadConfig,
  resolveClaudeHome,
  resolveStateDir,
} from './config.js'

describe('ClaudeScoutConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const cfg = ClaudeScoutConfigSchema.parse(defaultConfig())
    expect(cfg.accounts).toHaveLength(1)
    expect(cfg.default_account).toBe('default')
  })

  it('rejects duplicate account names', () => {
    const result = ClaudeScoutConfigSchema.safeParse({
      accounts: [
        { name: 'a', account_id: 'x' },
        { name: 'a', account_id: 'y' },
      ],
      default_account: 'a',
    })
    expect(result.success).toBe(false)
  })

  it('rejects default_account that does not exist', () => {
    const result = ClaudeScoutConfigSchema.safeParse({
      accounts: [{ name: 'a', account_id: 'x' }],
      default_account: 'missing',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-slug account names', () => {
    const result = ClaudeScoutConfigSchema.safeParse({
      accounts: [{ name: 'Bad Name', account_id: 'x' }],
      default_account: 'Bad Name',
    })
    expect(result.success).toBe(false)
  })
})

describe('loadConfig', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cs-config-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('writes and loads defaults when the file does not exist', async () => {
    const path = join(dir, 'config.json')
    const cfg = await loadConfig(path)
    expect(cfg.accounts[0]?.name).toBe('default')
    const cfg2 = await loadConfig(path)
    expect(cfg2).toEqual(cfg)
  })

  it('loads a multi-account config from disk', async () => {
    const path = join(dir, 'config.json')
    const body = {
      accounts: [
        {
          name: 'personal',
          account_id: 'acct_p',
          cwd_prefix: '/Users/me/personal',
          dept_tag: 'personal',
        },
        {
          name: 'work',
          account_id: 'acct_w',
          cwd_prefix: '/Users/me/work',
          dept_tag: 'work',
          project_tag: 'main',
        },
      ],
      default_account: 'personal',
      poll_interval_ms: 3000,
    }
    await writeFile(path, JSON.stringify(body), 'utf8')
    const cfg = await loadConfig(path)
    expect(cfg.accounts).toHaveLength(2)
    expect(cfg.accounts[1]?.project_tag).toBe('main')
    expect(cfg.poll_interval_ms).toBe(3000)
  })
})

describe('resolver helpers', () => {
  it('returns a claude_home override when set', () => {
    const cfg = { ...defaultConfig(), claude_home: '/tmp/custom-claude' }
    expect(resolveClaudeHome(cfg)).toBe('/tmp/custom-claude')
  })

  it('returns a state_dir override when set', () => {
    const cfg = { ...defaultConfig(), state_dir: '/tmp/custom-state' }
    expect(resolveStateDir(cfg)).toBe('/tmp/custom-state')
  })
})
