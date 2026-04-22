import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { z } from 'zod'

export const AccountSchema = z
  .object({
    /** Short unique name. Becomes the scout tag. */
    name: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-_]*$/, 'account names must be slug-like'),
    /** Stable account identifier (surfaced on every TTP event as dept metadata). */
    account_id: z.string().min(1),
    /** Longest-matching prefix of session.cwd routes sessions to this account. */
    cwd_prefix: z.string().optional(),
    /** Dept/project tags copied into every event from this account. */
    dept_tag: z.string().optional(),
    project_tag: z.string().optional(),
    env_tag: z.enum(['production', 'staging', 'development', 'ci']).optional(),
  })
  .strict()

export type Account = z.infer<typeof AccountSchema>

export const ClaudeScoutConfigSchema = z
  .object({
    accounts: z.array(AccountSchema).min(1),
    default_account: z.string().min(1),
    /** Path to Claude Code's state dir. Default ~/.claude */
    claude_home: z.string().optional(),
    /** Poll interval for tailing transcripts, ms. Default 2000. */
    poll_interval_ms: z.number().int().positive().default(2_000),
    /** Where claude-scout keeps its own state (offsets, pid). Default ~/.claude-scout */
    state_dir: z.string().optional(),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    const names = new Set(cfg.accounts.map((a) => a.name))
    if (names.size !== cfg.accounts.length) {
      ctx.addIssue({ code: 'custom', message: 'duplicate account name' })
    }
    if (!names.has(cfg.default_account)) {
      ctx.addIssue({
        code: 'custom',
        message: `default_account "${cfg.default_account}" is not in accounts[]`,
      })
    }
  })

export type ClaudeScoutConfig = z.infer<typeof ClaudeScoutConfigSchema>

export const DEFAULT_CONFIG_PATH = join(homedir(), '.claude-scout', 'config.json')

export function defaultConfig(): ClaudeScoutConfig {
  return {
    accounts: [
      {
        name: 'default',
        account_id: 'acct_default',
      },
    ],
    default_account: 'default',
    poll_interval_ms: 2_000,
  }
}

/** Load the config from disk. If missing, write defaults and return them. */
export async function loadConfig(
  path: string = resolveConfigPath(),
): Promise<ClaudeScoutConfig> {
  try {
    const raw = await fs.readFile(path, 'utf8')
    return ClaudeScoutConfigSchema.parse(JSON.parse(raw))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      const cfg = defaultConfig()
      await fs.mkdir(dirname(path), { recursive: true })
      await fs.writeFile(path, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
      return cfg
    }
    throw err
  }
}

export function resolveConfigPath(): string {
  return process.env.CLAUDE_SCOUT_CONFIG
    ? resolve(process.env.CLAUDE_SCOUT_CONFIG)
    : DEFAULT_CONFIG_PATH
}

export function resolveClaudeHome(cfg: ClaudeScoutConfig): string {
  return cfg.claude_home ? resolve(cfg.claude_home) : join(homedir(), '.claude')
}

export function resolveStateDir(cfg: ClaudeScoutConfig): string {
  return cfg.state_dir ? resolve(cfg.state_dir) : join(homedir(), '.claude-scout')
}
