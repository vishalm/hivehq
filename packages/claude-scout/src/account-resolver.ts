import type { Account, ClaudeScoutConfig } from './config.js'

/**
 * Resolve a Claude Code session cwd to an account using the longest-matching
 * cwd_prefix, falling back to the default account.
 */
export class AccountResolver {
  private readonly sorted: Account[]
  private readonly byName: Map<string, Account>
  private readonly fallback: Account

  constructor(private readonly config: ClaudeScoutConfig) {
    this.byName = new Map(config.accounts.map((a) => [a.name, a]))
    const fallback = this.byName.get(config.default_account)
    if (!fallback) {
      throw new Error(`default_account ${config.default_account} not found`)
    }
    this.fallback = fallback
    this.sorted = [...config.accounts].sort(
      (a, b) => (b.cwd_prefix?.length ?? 0) - (a.cwd_prefix?.length ?? 0),
    )
  }

  /** Resolve by the cwd of a Claude Code session (undefined cwd → default). */
  resolve(cwd: string | undefined): Account {
    if (!cwd) return this.fallback
    for (const account of this.sorted) {
      if (!account.cwd_prefix) continue
      if (cwd === account.cwd_prefix || cwd.startsWith(account.cwd_prefix + '/')) {
        return account
      }
    }
    return this.fallback
  }

  byNameStrict(name: string): Account {
    const acc = this.byName.get(name)
    if (!acc) throw new Error(`unknown account: ${name}`)
    return acc
  }

  all(): readonly Account[] {
    return this.config.accounts
  }
}
