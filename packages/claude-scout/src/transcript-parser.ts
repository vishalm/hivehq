/**
 * Transcript line parser — metadata-only.
 *
 * Claude Code appends JSON lines of different `type` values to each transcript
 * file. This parser extracts ONLY allowlisted fields from assistant messages —
 * never content, thinking, or text.
 *
 * Rejected fields (must never propagate downstream):
 *   - message.content[*].text
 *   - message.content[*].thinking
 *   - message.content[*].signature
 *   - message.content[*].input (tool call inputs may hold prompts)
 *   - anything else not in the allowlist
 */

export interface TranscriptMessageEvent {
  kind: 'assistant_message'
  sessionId: string
  messageId: string
  model: string
  stopReason: string | null
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  reasoningTokens: number
  toolUseCount: number
  /** Optional line timestamp (ms) if the outer record carries one. */
  timestamp: number | null
}

export type TranscriptEvent = TranscriptMessageEvent

interface RawMessageLine {
  type?: string
  sessionId?: string
  timestamp?: string | number
  message?: {
    id?: string
    type?: string
    role?: string
    model?: string
    stop_reason?: string | null
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
      reasoning_tokens?: number
    }
    content?: Array<{ type?: string }>
  }
}

/**
 * Parse a single transcript line. Returns a TranscriptEvent if it's an
 * assistant message with usage data, or null for any other line type.
 */
export function parseLine(line: string): TranscriptEvent | null {
  if (!line || line[0] !== '{') return null
  let raw: RawMessageLine
  try {
    raw = JSON.parse(line) as RawMessageLine
  } catch {
    return null
  }

  if (!raw.sessionId) return null
  const msg = raw.message
  if (!msg || msg.role !== 'assistant' || msg.type !== 'message') return null
  if (!msg.id || !msg.model || !msg.usage) return null

  const usage = msg.usage
  let toolUseCount = 0
  if (Array.isArray(msg.content)) {
    for (const c of msg.content) {
      if (c && c.type === 'tool_use') toolUseCount += 1
    }
  }

  return {
    kind: 'assistant_message',
    sessionId: raw.sessionId,
    messageId: msg.id,
    model: msg.model,
    stopReason: msg.stop_reason ?? null,
    inputTokens: numOrZero(usage.input_tokens),
    outputTokens: numOrZero(usage.output_tokens),
    cacheReadTokens: numOrZero(usage.cache_read_input_tokens),
    cacheCreationTokens: numOrZero(usage.cache_creation_input_tokens),
    reasoningTokens: numOrZero(usage.reasoning_tokens),
    toolUseCount,
    timestamp: parseTimestamp(raw.timestamp),
  }
}

function numOrZero(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

function parseTimestamp(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const parsed = Date.parse(v)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Sum total billable tokens for a message. */
export function totalTokens(e: TranscriptMessageEvent): number {
  return (
    e.inputTokens +
    e.outputTokens +
    e.cacheReadTokens +
    e.cacheCreationTokens +
    e.reasoningTokens
  )
}
