import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InMemorySink, type CollectorSink } from '@hive/connector'
import type { TTPEvent } from '@hive/shared'
import { createLogger } from '@hive/scout'
import { ClaudeScout, CLAUDE_CODE_PROVIDER } from './claude-scout.js'
import type { ClaudeScoutConfig } from './config.js'

const silent = createLogger({ component: 'test', level: 'fatal' })

function writeSession(home: string, pid: number, sessionId: string, cwd: string) {
  return writeFile(
    join(home, 'sessions', `${pid}.json`),
    JSON.stringify({ pid, sessionId, cwd, startedAt: Date.now(), entrypoint: 'test' }),
  )
}

function assistantLine(sessionId: string, msgId: string, tokens = 10): string {
  return (
    JSON.stringify({
      sessionId,
      timestamp: Date.now(),
      message: {
        id: msgId,
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4-7',
        usage: { input_tokens: tokens, output_tokens: tokens },
      },
    }) + '\n'
  )
}

class CapturingSink implements CollectorSink {
  readonly events: TTPEvent[] = []
  async emit(events: TTPEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

describe('ClaudeScout', () => {
  let home: string
  let state: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'cs-home-'))
    state = await mkdtemp(join(tmpdir(), 'cs-state-'))
    await mkdir(join(home, 'projects', 'proj'), { recursive: true })
    await mkdir(join(home, 'sessions'), { recursive: true })
  })

  afterEach(async () => {
    await rm(home, { recursive: true, force: true }).catch(() => undefined)
    await rm(state, { recursive: true, force: true }).catch(() => undefined)
  })

  const buildConfig = (): ClaudeScoutConfig => ({
    accounts: [
      {
        name: 'personal',
        account_id: 'acct_personal',
        cwd_prefix: '/workspaces/personal',
        dept_tag: 'personal',
      },
      {
        name: 'work',
        account_id: 'acct_work',
        cwd_prefix: '/workspaces/work',
        dept_tag: 'work',
        project_tag: 'main',
      },
    ],
    default_account: 'personal',
    claude_home: home,
    state_dir: state,
    poll_interval_ms: 60_000,
  })

  it('tags events with the account resolved from session cwd', async () => {
    await writeSession(home, 100, 'sess-work', '/workspaces/work/project-a')
    await writeFile(
      join(home, 'projects', 'proj', 'sess-work.jsonl'),
      assistantLine('sess-work', 'm1', 100),
    )
    const captured = new CapturingSink()
    const scout = new ClaudeScout({
      config: buildConfig(),
      logger: silent,
      disableAdminServer: true,
      sinkOverride: captured,
    })
    await scout.scanner.init()
    await scout.sessionIndex.refresh()
    await scout.runSweep()
    await scout.collector.flush()

    expect(captured.events).toHaveLength(1)
    const e = captured.events[0]!
    expect(e.provider).toBe(CLAUDE_CODE_PROVIDER)
    expect(e.dept_tag).toBe('work')
    expect(e.project_tag).toBe('main')
    expect(e.model_hint).toBe('claude-opus-4-7')
    expect(e.estimated_tokens).toBe(200)
    expect(e.use_case_tag).toBe('claude_code:acct_work')
    expect(e.governance.pii_asserted).toBe(false)
    expect(e.governance.content_asserted).toBe(false)
  })

  it('falls back to the default account when cwd does not match any prefix', async () => {
    await writeSession(home, 101, 'sess-other', '/opt/other/thing')
    await writeFile(
      join(home, 'projects', 'proj', 'sess-other.jsonl'),
      assistantLine('sess-other', 'm1'),
    )
    const captured = new CapturingSink()
    const scout = new ClaudeScout({
      config: buildConfig(),
      logger: silent,
      disableAdminServer: true,
      sinkOverride: captured,
    })
    await scout.scanner.init()
    await scout.sessionIndex.refresh()
    await scout.runSweep()
    await scout.collector.flush()

    expect(captured.events).toHaveLength(1)
    expect(captured.events[0]?.dept_tag).toBe('personal')
  })

  it('falls back to default when no matching session file exists', async () => {
    await writeFile(
      join(home, 'projects', 'proj', 'orphan.jsonl'),
      assistantLine('no-session', 'm1'),
    )
    const captured = new CapturingSink()
    const scout = new ClaudeScout({
      config: buildConfig(),
      logger: silent,
      disableAdminServer: true,
      sinkOverride: captured,
    })
    await scout.scanner.init()
    await scout.sessionIndex.refresh()
    await scout.runSweep()
    await scout.collector.flush()

    expect(captured.events).toHaveLength(1)
    expect(captured.events[0]?.dept_tag).toBe('personal')
  })

  it('handles multiple accounts in the same sweep', async () => {
    await writeSession(home, 1, 'sess-p', '/workspaces/personal/a')
    await writeSession(home, 2, 'sess-w', '/workspaces/work/b')
    await writeFile(
      join(home, 'projects', 'proj', 'p.jsonl'),
      assistantLine('sess-p', 'mp'),
    )
    await writeFile(
      join(home, 'projects', 'proj', 'w.jsonl'),
      assistantLine('sess-w', 'mw'),
    )
    const captured = new CapturingSink()
    const scout = new ClaudeScout({
      config: buildConfig(),
      logger: silent,
      disableAdminServer: true,
      sinkOverride: captured,
    })
    await scout.scanner.init()
    await scout.sessionIndex.refresh()
    await scout.runSweep()
    await scout.collector.flush()
    expect(captured.events).toHaveLength(2)
    const personal = captured.events.find((e) => e.dept_tag === 'personal')
    const work = captured.events.find((e) => e.dept_tag === 'work')
    expect(personal).toBeDefined()
    expect(work).toBeDefined()
  })

  it('never emits content in TTPEvents', async () => {
    await writeSession(home, 3, 'sess-content', '/workspaces/personal/a')
    const malicious = {
      sessionId: 'sess-content',
      timestamp: Date.now(),
      message: {
        id: 'm-content',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4-7',
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: 'text', text: 'DO-NOT-LEAK-42' }],
      },
    }
    await writeFile(
      join(home, 'projects', 'proj', 'x.jsonl'),
      JSON.stringify(malicious) + '\n',
    )
    const sink = new InMemorySink()
    const scout = new ClaudeScout({
      config: buildConfig(),
      logger: silent,
      disableAdminServer: true,
      sinkOverride: sink,
    })
    await scout.scanner.init()
    await scout.sessionIndex.refresh()
    await scout.runSweep()
    await scout.collector.flush()

    const serialized = JSON.stringify(sink.events)
    expect(serialized).not.toContain('DO-NOT-LEAK-42')
  })
})
