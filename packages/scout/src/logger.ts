import pino, { type Logger, type LoggerOptions } from 'pino'

export type { Logger } from 'pino'

export interface CreateLoggerOptions {
  component: string
  level?: string
  scoutId?: string
}

/**
 * Create a pino logger for Scout components. JSON-per-line to stdout.
 * Operators who want pretty output can pipe through `pino-pretty`.
 * Level can be overridden via HIVE_LOG_LEVEL env (default: info).
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const config: LoggerOptions = {
    level: opts.level ?? process.env.HIVE_LOG_LEVEL ?? 'info',
    base: {
      component: opts.component,
      ...(opts.scoutId && { scout_id: opts.scoutId }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'msg',
  }
  return pino(config)
}
