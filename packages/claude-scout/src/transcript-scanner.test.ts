import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from '@hive/scout'
import { TranscriptScanner } from './transcript-scanner.js'
import type { TranscriptEvent } from './transcript-parser.js'

const silent = createLogger({ component: 'test', level: 'fatal' })

function assistantLine(sessionId: string, msgId: string, inT = 10, outT = 10): string {
  return (
    JSON.stringify({
      sessionId,
      timestamp: Date.now(),
      message: {
        id: msgId,
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4-7',
        usage: { input_tokens: inT, output_tokens: outT },
      },
    }) + '\n'
  )
}

describe('TranscriptScanner', () => {
  let home: string
  let state: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'cs-home-'))
    state = await mkdtemp(join(tmpdir(), 'cs-state-'))
    await mkdir(join(home, 'projects', 'proj-1'), { recursive: true })
  })

  afterEach(async () => {
    await rm(home, { recursive: true, force: true }).catch(() => undefined)
    await rm(state, { recursive: true, force: true }).catch(() => undefined)
  })

  it('emits events on the first sweep and then nothing for unchanged files', async () => {
    const path = join(home, 'projects', 'proj-1', 'session.jsonl')
    await writeFile(path, assistantLine('s', 'm1') + assistantLine('s', 'm2'))
    const scanner = new TranscriptScanner({
      claudeHome: home,
      offsetsPath: join(state, 'offsets.json'),
      logger: silent,
    })
    const emitted: TranscriptEvent[] = []
    const first = await scanner.sweep((e) => {
      emitted.push(e)
    })
    expect(first.eventsEmitted).toBe(2)
    emitted.length = 0
    const second = await scanner.sweep((e) => {
      emitted.push(e)
    })
    expect(second.eventsEmitted).toBe(0)
  })

  it('picks up appended lines across sweeps', async () => {
    const path = join(home, 'projects', 'proj-1', 'session.jsonl')
    await writeFile(path, assistantLine('s', 'm1'))
    const scanner = new TranscriptScanner({
      claudeHome: home,
      offsetsPath: join(state, 'offsets.json'),
      logger: silent,
    })
    const emitted: TranscriptEvent[] = []
    await scanner.sweep((e) => {
      emitted.push(e)
    })
    expect(emitted).toHaveLength(1)
    await appendFile(path, assistantLine('s', 'm2'))
    await appendFile(path, assistantLine('s', 'm3'))
    await scanner.sweep((e) => {
      emitted.push(e)
    })
    expect(emitted).toHaveLength(3)
    expect(emitted.map((e) => (e.kind === 'assistant_message' ? e.messageId : ''))).toEqual(
      ['m1', 'm2', 'm3'],
    )
  })

  it('persists offsets so a new scanner continues where the old one left off', async () => {
    const path = join(home, 'projects', 'proj-1', 'session.jsonl')
    await writeFile(path, assistantLine('s', 'm1'))
    const s1 = new TranscriptScanner({
      claudeHome: home,
      offsetsPath: join(state, 'offsets.json'),
      logger: silent,
    })
    const seen1: TranscriptEvent[] = []
    await s1.sweep((e) => {
      seen1.push(e)
    })
    expect(seen1).toHaveLength(1)

    await appendFile(path, assistantLine('s', 'm2'))
    const s2 = new TranscriptScanner({
      claudeHome: home,
      offsetsPath: join(state, 'offsets.json'),
      logger: silent,
    })
    const seen2: TranscriptEvent[] = []
    await s2.sweep((e) => {
      seen2.push(e)
    })
    expect(seen2).toHaveLength(1)
    expect(seen2[0]?.kind === 'assistant_message' && seen2[0].messageId).toBe('m2')
  })

  it('restarts from 0 when a file shrinks (truncated/rotated)', async () => {
    const path = join(home, 'projects', 'proj-1', 'session.jsonl')
    await writeFile(path, assistantLine('s', 'm1') + assistantLine('s', 'm2'))
    const scanner = new TranscriptScanner({
      claudeHome: home,
      offsetsPath: join(state, 'offsets.json'),
      logger: silent,
    })
    const emitted: TranscriptEvent[] = []
    await scanner.sweep((e) => {
      emitted.push(e)
    })
    expect(emitted).toHaveLength(2)

    await writeFile(path, assistantLine('s', 'm3'))
    await scanner.sweep((e) => {
      emitted.push(e)
    })
    expect(emitted).toHaveLength(3)
    expect(emitted[2]?.kind === 'assistant_message' && emitted[2].messageId).toBe('m3')
  })

  it('fullScan re-emits every line regardless of offsets', async () => {
    const path = join(home, 'projects', 'proj-1', 'session.jsonl')
    await writeFile(path, assistantLine('s', 'm1') + assistantLine('s', 'm2'))
    const scanner = new TranscriptScanner({
      claudeHome: home,
      offsetsPath: join(state, 'offsets.json'),
      logger: silent,
    })
    await scanner.sweep(() => undefined)
    const fullEmitted: TranscriptEvent[] = []
    await scanner.fullScan((e) => {
      fullEmitted.push(e)
    })
    expect(fullEmitted).toHaveLength(2)
  })

  it('walks nested project directories', async () => {
    await mkdir(join(home, 'projects', 'nested-1'), { recursive: true })
    await mkdir(join(home, 'projects', 'nested-2'), { recursive: true })
    await writeFile(join(home, 'projects', 'nested-1', 'a.jsonl'), assistantLine('a', 'm1'))
    await writeFile(join(home, 'projects', 'nested-2', 'b.jsonl'), assistantLine('b', 'm2'))
    const scanner = new TranscriptScanner({
      claudeHome: home,
      offsetsPath: join(state, 'offsets.json'),
      logger: silent,
    })
    const emitted: TranscriptEvent[] = []
    const result = await scanner.sweep((e) => {
      emitted.push(e)
    })
    expect(result.filesScanned).toBeGreaterThanOrEqual(2)
    expect(emitted).toHaveLength(2)
  })
})
