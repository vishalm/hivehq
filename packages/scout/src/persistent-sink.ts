import { promises as fs } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { CollectorSink } from '@hive/connector'
import type { TTPEvent } from '@hive/shared'
import type { Logger } from './logger.js'
import { counterInc, gaugeSet, scoutMetrics } from './metrics.js'

export interface PersistentSinkOptions {
  /** The underlying sink the WAL ships to. Usually HttpSink. */
  upstream: CollectorSink
  /** Directory for pending batches. Default: ".hive/scout/queue" */
  dir: string
  /** Max bytes stored on disk before oldest files are evicted. Default: 500 MB */
  maxBytes?: number
  /** Replay sweep interval in ms. Default: 15 s. */
  replayIntervalMs?: number
  logger: Logger
}

interface BatchFile {
  path: string
  size: number
  mtimeMs: number
}

/**
 * Write-ahead log wrapper around an upstream sink.
 *
 * On emit(): append the batch to disk first, THEN attempt upstream ship.
 * If ship succeeds, delete the WAL file. If it fails, the file stays and a
 * background replay loop retries forever with backoff. On startup, call
 * replayAll() before installing the fetch hook so old batches get a chance.
 *
 * Bounded at maxBytes: once exceeded, oldest-first files are evicted and
 * scout_events_dropped_total{reason="wal_full"} is bumped.
 */
export class PersistentSink implements CollectorSink {
  private readonly upstream: CollectorSink
  private readonly dir: string
  private readonly maxBytes: number
  private readonly replayIntervalMs: number
  private readonly logger: Logger
  private replayTimer: NodeJS.Timeout | null = null
  private replaying = false
  private ready = false

  constructor(opts: PersistentSinkOptions) {
    this.upstream = opts.upstream
    this.dir = opts.dir
    this.maxBytes = opts.maxBytes ?? 500 * 1024 * 1024
    this.replayIntervalMs = opts.replayIntervalMs ?? 15_000
    this.logger = opts.logger
  }

  /** Prepare the WAL directory. Idempotent. */
  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
    await this.refreshGauges()
    this.ready = true
  }

  /** Start the background replay loop. */
  start(): void {
    if (this.replayTimer) return
    this.replayTimer = setInterval(() => {
      void this.replayAll().catch((err) =>
        this.logger.warn({ err: serializeErr(err) }, 'wal replay sweep failed'),
      )
    }, this.replayIntervalMs)
    if (typeof this.replayTimer.unref === 'function') this.replayTimer.unref()
  }

  /** Stop the background replay loop and flush pending events. */
  async stop(): Promise<void> {
    if (this.replayTimer) {
      clearInterval(this.replayTimer)
      this.replayTimer = null
    }
    await this.replayAll()
  }

  async emit(events: TTPEvent[]): Promise<void> {
    if (events.length === 0) return
    if (!this.ready) await this.init()

    const file = await this.append(events)
    try {
      const started = Date.now()
      await this.upstream.emit(events)
      const elapsed = Date.now() - started
      await this.deleteFile(file.path)
      counterInc(scoutMetrics.eventsShipped, {}, events.length)
      counterInc(scoutMetrics.shipAttempts, { result: 'ok' })
      counterInc(scoutMetrics.shipLatencySum, {}, elapsed)
      counterInc(scoutMetrics.shipLatencyCount, {}, 1)
      gaugeSet(scoutMetrics.lastShipTimestamp, Math.floor(Date.now() / 1000))
      gaugeSet(scoutMetrics.nodeReachable, 1)
      await this.refreshGauges()
    } catch (err) {
      counterInc(scoutMetrics.shipAttempts, { result: 'fail' })
      gaugeSet(scoutMetrics.nodeReachable, 0)
      this.logger.warn(
        { err: serializeErr(err), path: file.path, events: events.length },
        'upstream emit failed; batch retained in WAL',
      )
      await this.refreshGauges()
    }
  }

  /** Try to ship every pending WAL file once. Safe to call concurrently. */
  async replayAll(): Promise<void> {
    if (this.replaying) return
    this.replaying = true
    try {
      const files = await this.listFiles()
      for (const file of files) {
        try {
          const raw = await fs.readFile(file.path, 'utf8')
          const events = raw
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line) as TTPEvent)
          if (events.length === 0) {
            await this.deleteFile(file.path)
            continue
          }
          const started = Date.now()
          await this.upstream.emit(events)
          const elapsed = Date.now() - started
          await this.deleteFile(file.path)
          counterInc(scoutMetrics.eventsShipped, {}, events.length)
          counterInc(scoutMetrics.shipAttempts, { result: 'replay_ok' })
          counterInc(scoutMetrics.shipLatencySum, {}, elapsed)
          counterInc(scoutMetrics.shipLatencyCount, {}, 1)
          gaugeSet(scoutMetrics.lastShipTimestamp, Math.floor(Date.now() / 1000))
          gaugeSet(scoutMetrics.nodeReachable, 1)
        } catch (err) {
          counterInc(scoutMetrics.shipAttempts, { result: 'replay_fail' })
          gaugeSet(scoutMetrics.nodeReachable, 0)
          this.logger.debug(
            { err: serializeErr(err), path: file.path },
            'wal replay failed; will retry',
          )
          break
        }
      }
      await this.refreshGauges()
    } finally {
      this.replaying = false
    }
  }

  private async append(events: TTPEvent[]): Promise<BatchFile> {
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
    const hash = createHash('sha256').update(lines).digest('hex').slice(0, 8)
    const filename = `${Date.now()}-${randomUUID()}-${hash}.ndjson`
    const path = join(this.dir, filename)
    const tmp = path + '.tmp'
    await fs.writeFile(tmp, lines, { encoding: 'utf8', flag: 'wx' })
    await fs.rename(tmp, path)
    await this.enforceBudget(Buffer.byteLength(lines))
    return { path, size: Buffer.byteLength(lines), mtimeMs: Date.now() }
  }

  private async deleteFile(path: string): Promise<void> {
    await fs.unlink(path).catch(() => undefined)
  }

  private async listFiles(): Promise<BatchFile[]> {
    let entries: string[]
    try {
      entries = await fs.readdir(this.dir)
    } catch {
      return []
    }
    const files: BatchFile[] = []
    for (const name of entries) {
      if (!name.endsWith('.ndjson')) continue
      const path = join(this.dir, name)
      try {
        const stat = await fs.stat(path)
        files.push({ path, size: stat.size, mtimeMs: stat.mtimeMs })
      } catch {
        continue
      }
    }
    files.sort((a, b) => a.mtimeMs - b.mtimeMs)
    return files
  }

  private async enforceBudget(incomingSize: number): Promise<void> {
    const files = await this.listFiles()
    let total = files.reduce((acc, f) => acc + f.size, 0) + incomingSize
    if (total <= this.maxBytes) return
    for (const file of files) {
      if (total <= this.maxBytes) break
      try {
        const lines = (await fs.readFile(file.path, 'utf8'))
          .split('\n')
          .filter(Boolean).length
        counterInc(scoutMetrics.eventsDropped, { reason: 'wal_full' }, lines)
      } catch {
        /* ignore */
      }
      await this.deleteFile(file.path)
      total -= file.size
      this.logger.warn({ path: file.path }, 'wal over budget; evicting oldest batch')
    }
  }

  private async refreshGauges(): Promise<void> {
    const files = await this.listFiles()
    gaugeSet(scoutMetrics.walFiles, files.length)
    gaugeSet(scoutMetrics.walBytes, files.reduce((acc, f) => acc + f.size, 0))
  }

  /** Snapshot for /status. */
  async snapshot(): Promise<{ files: number; bytes: number }> {
    const files = await this.listFiles()
    return { files: files.length, bytes: files.reduce((acc, f) => acc + f.size, 0) }
  }
}

function serializeErr(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack }
  return { message: String(err) }
}
