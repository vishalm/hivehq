import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export interface SessionMeta {
  sessionId: string
  cwd: string
  entrypoint: string
  startedAt: number
  pid: number
}

const SessionSchema = z
  .object({
    sessionId: z.string().min(1),
    cwd: z.string().min(1),
    entrypoint: z.string().optional().default('unknown'),
    startedAt: z.number().int().nonnegative(),
    pid: z.number().int().nonnegative(),
  })
  .passthrough()

/**
 * Reads ~/.claude/sessions/*.json and indexes by sessionId.
 *
 * Claude Code writes one file per process (filename is the pid) containing
 * the sessionId, cwd, entrypoint, and startedAt. We cache the index and
 * refresh lazily when asked for a sessionId that isn't known.
 */
export class SessionIndex {
  private readonly sessionsDir: string
  private bySessionId = new Map<string, SessionMeta>()
  private lastScannedAt = 0

  constructor(claudeHome: string) {
    this.sessionsDir = join(claudeHome, 'sessions')
  }

  async refresh(): Promise<void> {
    let entries: string[]
    try {
      entries = await fs.readdir(this.sessionsDir)
    } catch {
      return
    }
    const next = new Map<string, SessionMeta>()
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      const path = join(this.sessionsDir, entry)
      try {
        const raw = await fs.readFile(path, 'utf8')
        const parsed = SessionSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) continue
        next.set(parsed.data.sessionId, {
          sessionId: parsed.data.sessionId,
          cwd: parsed.data.cwd,
          entrypoint: parsed.data.entrypoint,
          startedAt: parsed.data.startedAt,
          pid: parsed.data.pid,
        })
      } catch {
        continue
      }
    }
    this.bySessionId = next
    this.lastScannedAt = Date.now()
  }

  async lookup(sessionId: string): Promise<SessionMeta | undefined> {
    const hit = this.bySessionId.get(sessionId)
    if (hit) return hit
    if (Date.now() - this.lastScannedAt > 1000) {
      await this.refresh()
    }
    return this.bySessionId.get(sessionId)
  }

  size(): number {
    return this.bySessionId.size
  }
}
