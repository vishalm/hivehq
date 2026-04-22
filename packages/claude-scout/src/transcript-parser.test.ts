import { describe, expect, it } from 'vitest'
import { parseLine, totalTokens } from './transcript-parser.js'

describe('parseLine', () => {
  it('returns null for non-JSON input', () => {
    expect(parseLine('')).toBeNull()
    expect(parseLine('not json')).toBeNull()
    expect(parseLine('[]')).toBeNull()
  })

  it('ignores non-assistant lines', () => {
    expect(
      parseLine(
        JSON.stringify({
          type: 'permission-mode',
          sessionId: 's1',
          permissionMode: 'bypass',
        }),
      ),
    ).toBeNull()
  })

  it('extracts usage metadata from an assistant message', () => {
    const line = JSON.stringify({
      parentUuid: 'abc',
      sessionId: 'session-1',
      timestamp: '2026-04-17T00:00:00.000Z',
      message: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4-7',
        stop_reason: 'end_turn',
        content: [
          { type: 'text', text: 'SECRET — should be dropped' },
          { type: 'thinking', thinking: 'SECRET — should be dropped' },
          { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
        ],
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 50,
          cache_read_input_tokens: 200,
          output_tokens: 30,
        },
      },
    })
    const event = parseLine(line)
    expect(event).not.toBeNull()
    if (!event) return
    expect(event.sessionId).toBe('session-1')
    expect(event.messageId).toBe('msg_123')
    expect(event.model).toBe('claude-opus-4-7')
    expect(event.stopReason).toBe('end_turn')
    expect(event.inputTokens).toBe(100)
    expect(event.outputTokens).toBe(30)
    expect(event.cacheReadTokens).toBe(200)
    expect(event.cacheCreationTokens).toBe(50)
    expect(event.toolUseCount).toBe(1)
    expect(event.timestamp).toBe(Date.parse('2026-04-17T00:00:00.000Z'))
  })

  it('never leaks content, text, thinking, or input fields', () => {
    const line = JSON.stringify({
      sessionId: 's',
      timestamp: Date.now(),
      message: {
        id: 'msg_x',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4-7',
        usage: { input_tokens: 1, output_tokens: 2 },
        content: [
          { type: 'text', text: 'leak-1' },
          { type: 'thinking', thinking: 'leak-2' },
          { type: 'tool_use', input: { secret: 'leak-3' } },
        ],
      },
    })
    const event = parseLine(line)
    expect(event).not.toBeNull()
    const serialized = JSON.stringify(event)
    expect(serialized).not.toContain('leak-1')
    expect(serialized).not.toContain('leak-2')
    expect(serialized).not.toContain('leak-3')
    expect(serialized).not.toContain('thinking')
    expect(serialized).not.toContain('text":')
  })

  it('tolerates missing stop_reason', () => {
    const line = JSON.stringify({
      sessionId: 's',
      timestamp: 0,
      message: {
        id: 'msg_y',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku',
        usage: { input_tokens: 5, output_tokens: 5 },
      },
    })
    const event = parseLine(line)
    expect(event?.stopReason).toBeNull()
  })

  it('rejects negative or non-numeric token counts', () => {
    const line = JSON.stringify({
      sessionId: 's',
      message: {
        id: 'm',
        type: 'message',
        role: 'assistant',
        model: 'claude',
        usage: { input_tokens: -5, output_tokens: 'bogus' },
      },
    })
    const event = parseLine(line)
    expect(event).not.toBeNull()
    expect(event?.inputTokens).toBe(0)
    expect(event?.outputTokens).toBe(0)
  })
})

describe('totalTokens', () => {
  it('sums all token buckets', () => {
    expect(
      totalTokens({
        kind: 'assistant_message',
        sessionId: 's',
        messageId: 'm',
        model: 'c',
        stopReason: null,
        inputTokens: 1,
        outputTokens: 2,
        cacheReadTokens: 3,
        cacheCreationTokens: 4,
        reasoningTokens: 5,
        toolUseCount: 0,
        timestamp: null,
      }),
    ).toBe(15)
  })
})
