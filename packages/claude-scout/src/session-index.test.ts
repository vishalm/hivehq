import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SessionIndex } from './session-index.js'

describe('SessionIndex', () => {
  let home: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'cs-home-'))
    await mkdir(join(home, 'sessions'), { recursive: true })
  })

  afterEach(async () => {
    await rm(home, { recursive: true, force: true }).catch(() => undefined)
  })

  it('returns undefined when the sessions dir is empty', async () => {
    const idx = new SessionIndex(home)
    await idx.refresh()
    expect(await idx.lookup('missing')).toBeUndefined()
  })

  it('indexes by sessionId across multiple session files', async () => {
    await writeFile(
      join(home, 'sessions', '1.json'),
      JSON.stringify({
        pid: 1,
        sessionId: 'ses-A',
        cwd: '/a',
        startedAt: 1,
        entrypoint: 'cli',
      }),
    )
    await writeFile(
      join(home, 'sessions', '2.json'),
      JSON.stringify({
        pid: 2,
        sessionId: 'ses-B',
        cwd: '/b',
        startedAt: 2,
      }),
    )
    const idx = new SessionIndex(home)
    await idx.refresh()
    expect(idx.size()).toBe(2)
    const a = await idx.lookup('ses-A')
    const b = await idx.lookup('ses-B')
    expect(a?.cwd).toBe('/a')
    expect(b?.cwd).toBe('/b')
  })

  it('ignores malformed session files', async () => {
    await writeFile(join(home, 'sessions', 'good.json'), JSON.stringify({
      pid: 1,
      sessionId: 'ses',
      cwd: '/ok',
      startedAt: 1,
    }))
    await writeFile(join(home, 'sessions', 'bad.json'), '{')
    await writeFile(join(home, 'sessions', 'empty.json'), '{}')
    const idx = new SessionIndex(home)
    await idx.refresh()
    expect(idx.size()).toBe(1)
  })
})
