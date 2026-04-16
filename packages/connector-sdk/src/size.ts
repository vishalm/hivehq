/**
 * Byte-level payload measurement — the only thing connectors observe about
 * bodies. Never parsed, never logged.
 */

/** Size a string or bytes view. No structural inspection. */
export function measureBody(body: string | Uint8Array | ArrayBuffer | null | undefined): number {
  if (body == null) return 0
  if (typeof body === 'string') {
    // UTF-8 byte length without copying the string content anywhere.
    return new TextEncoder().encode(body).byteLength
  }
  if (body instanceof Uint8Array) return body.byteLength
  if (body instanceof ArrayBuffer) return body.byteLength
  return 0
}

/**
 * Streaming body size observer. Accumulates byte counts without retaining
 * chunks, so streaming responses can be measured without buffering content.
 */
export class BodySizeObserver {
  private bytes = 0
  private firstByteAt: number | null = null
  private startedAt: number

  constructor(startedAt = Date.now()) {
    this.startedAt = startedAt
  }

  observe(chunk: Uint8Array): void {
    if (this.firstByteAt === null && chunk.byteLength > 0) {
      this.firstByteAt = Date.now()
    }
    this.bytes += chunk.byteLength
  }

  get totalBytes(): number {
    return this.bytes
  }

  get ttfbMs(): number | undefined {
    return this.firstByteAt === null ? undefined : this.firstByteAt - this.startedAt
  }
}
