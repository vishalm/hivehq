import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Logger } from '@hive/scout'
import { parseLine, type TranscriptEvent } from './transcript-parser.js'

export interface ScannerOptions {
  /** Path to ~/.claude (parent of 'projects'). */
  claudeHome: string
  /** Path to the offsets state file. */
  offsetsPath: string
  logger: Logger
}

export interface OffsetsFile {
  version: 1
  offsets: Record<string, OffsetEntry>
}

export interface OffsetEntry {
  /** Byte offset fully processed. */
  bytes: number
  /** File size at last scan (used to detect truncation / rotation). */
  size: number
}

export interface ScanResult {
  filesScanned: number
  linesSeen: number
  eventsEmitted: number
}

export type TranscriptSink = (
  event: TranscriptEvent,
  ctx: { file: string },
) => Promise<void> | void

const BUFFER_FLUSH_BYTES = 64 * 1024

/**
 * Tails all transcript files under ~/.claude/projects recursively, emitting
 * one TranscriptEvent per new assistant message. Offsets are persisted so a
 * restart never re-emits already-shipped events.
 */
export class TranscriptScanner {
  private offsets: Record<string, OffsetEntry> = {}
  private loaded = false

  constructor(private readonly opts: ScannerOptions) {}

  async init(): Promise<void> {
    await fs.mkdir(dirname(this.opts.offsetsPath), { recursive: true })
    try {
      const raw = await fs.readFile(this.opts.offsetsPath, 'utf8')
      const parsed = JSON.parse(raw) as OffsetsFile
      if (parsed && parsed.version === 1 && parsed.offsets) {
        this.offsets = parsed.offsets
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.opts.logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'could not load offsets file; starting from the beginning',
        )
      }
    }
    this.loaded = true
  }

  async sweep(sink: TranscriptSink): Promise<ScanResult> {
    if (!this.loaded) await this.init()
    const projectsDir = join(this.opts.claudeHome, 'projects')
    const files = await this.listTranscriptFiles(projectsDir)
    let linesSeen = 0
    let eventsEmitted = 0
    for (const file of files) {
      const result = await this.tailFile(file, sink)
      linesSeen += result.linesSeen
      eventsEmitted += result.eventsEmitted
    }
    await this.persistOffsets()
    return { filesScanned: files.length, linesSeen, eventsEmitted }
  }

  /** Backfill: ignore stored offsets, re-read everything (but don't overwrite them until done). */
  async fullScan(sink: TranscriptSink): Promise<ScanResult> {
    const projectsDir = join(this.opts.claudeHome, 'projects')
    const files = await this.listTranscriptFiles(projectsDir)
    let linesSeen = 0
    let eventsEmitted = 0
    for (const file of files) {
      const result = await this.readFromOffset(file, 0, sink)
      linesSeen += result.linesSeen
      eventsEmitted += result.eventsEmitted
    }
    return { filesScanned: files.length, linesSeen, eventsEmitted }
  }

  async snapshot(): Promise<{ trackedFiles: number; totalBytesSeen: number }> {
    const trackedFiles = Object.keys(this.offsets).length
    const totalBytesSeen = Object.values(this.offsets).reduce(
      (acc, o) => acc + (o.bytes ?? 0),
      0,
    )
    return { trackedFiles, totalBytesSeen }
  }

  private async tailFile(file: string, sink: TranscriptSink): Promise<ScanResult> {
    let stat
    try {
      stat = await fs.stat(file)
    } catch {
      return { filesScanned: 0, linesSeen: 0, eventsEmitted: 0 }
    }
    const prior = this.offsets[file]
    let startAt = 0
    if (prior) {
      if (stat.size < prior.size) {
        this.opts.logger.warn(
          { file, prior_size: prior.size, now_size: stat.size },
          'transcript file shrank; restarting from 0',
        )
      } else {
        startAt = prior.bytes
      }
    }
    if (startAt >= stat.size) {
      this.offsets[file] = { bytes: stat.size, size: stat.size }
      return { filesScanned: 1, linesSeen: 0, eventsEmitted: 0 }
    }
    return this.readFromOffset(file, startAt, sink)
  }

  private async readFromOffset(
    file: string,
    startAt: number,
    sink: TranscriptSink,
  ): Promise<ScanResult> {
    const handle = await fs.open(file, 'r')
    try {
      const { size } = await handle.stat()
      let pos = startAt
      let pending = ''
      let linesSeen = 0
      let eventsEmitted = 0
      const buf = Buffer.alloc(BUFFER_FLUSH_BYTES)
      while (pos < size) {
        const { bytesRead } = await handle.read(buf, 0, buf.length, pos)
        if (bytesRead === 0) break
        pending += buf.toString('utf8', 0, bytesRead)
        pos += bytesRead
        let newlineAt = pending.indexOf('\n')
        while (newlineAt !== -1) {
          const line = pending.slice(0, newlineAt)
          pending = pending.slice(newlineAt + 1)
          linesSeen += 1
          const ev = parseLine(line)
          if (ev) {
            try {
              await sink(ev, { file })
              eventsEmitted += 1
            } catch (err) {
              this.opts.logger.warn(
                { err: err instanceof Error ? err.message : String(err), file },
                'transcript sink failed on event',
              )
            }
          }
          newlineAt = pending.indexOf('\n')
        }
      }
      this.offsets[file] = { bytes: pos - pending.length, size }
      return { filesScanned: 1, linesSeen, eventsEmitted }
    } finally {
      await handle.close()
    }
  }

  private async persistOffsets(): Promise<void> {
    const payload: OffsetsFile = { version: 1, offsets: this.offsets }
    const tmp = this.opts.offsetsPath + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    await fs.rename(tmp, this.opts.offsetsPath)
  }

  private async listTranscriptFiles(projectsDir: string): Promise<string[]> {
    const out: string[] = []
    await walk(projectsDir, out)
    return out.filter((p) => p.endsWith('.jsonl'))
  }
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(path, out)
    } else if (entry.isFile()) {
      out.push(path)
    }
  }
}
