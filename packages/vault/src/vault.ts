/**
 * Vault — seal and open telemetry bundles with libsodium secretbox.
 *
 * Threat model:
 *   - Scout storage compromised → ciphertext useless without key
 *   - Key compromised alone → nothing to decrypt without ciphertext
 *   - Both compromised together → single-device impact only (keys are local)
 *
 * The Vault is deliberately small. Every line is a covenant commitment.
 */

import { VaultNotReadyError, VaultOpenError, VaultSealError } from './errors.js'
import { sodiumReady } from './keys.js'
import type { KeyMaterial, SealedBlob, VaultOptions } from './types.js'

export class Vault {
  private key: KeyMaterial | null = null
  private initialised = false

  /**
   * Initialise sodium and load the key material. Must be awaited before
   * seal/open can be called.
   */
  async ready(key: KeyMaterial): Promise<void> {
    await sodiumReady()
    this.key = key
    this.initialised = true
  }

  private assertReady(): KeyMaterial {
    if (!this.initialised || !this.key) throw new VaultNotReadyError()
    return this.key
  }

  /**
   * Seal a UTF-8 string or byte array into a SealedBlob.
   */
  async seal(payload: string | Uint8Array, opts: VaultOptions = {}): Promise<SealedBlob> {
    const key = this.assertReady()
    const sodium = await sodiumReady()

    try {
      const bytes =
        typeof payload === 'string' ? sodium.from_string(payload) : payload
      const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)

      // Prepend AAD length + AAD so it is bound to the ciphertext via MAC.
      const toSeal = opts.aad
        ? concatBytes(sodium.from_string(opts.aad), new Uint8Array([0]), bytes)
        : bytes

      const ciphertext = sodium.crypto_secretbox_easy(toSeal, nonce, key)

      return {
        version: 1,
        nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
        ciphertext: sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
      }
    } catch (err) {
      throw new VaultSealError('Seal failed', err)
    }
  }

  /**
   * Open a SealedBlob. Returns the original bytes (after AAD strip if used).
   * Throws if the MAC fails or the blob is malformed.
   */
  async open(blob: SealedBlob, opts: VaultOptions = {}): Promise<Uint8Array> {
    const key = this.assertReady()
    const sodium = await sodiumReady()

    try {
      if (blob.version !== 1) {
        throw new VaultOpenError(`Unsupported vault blob version: ${blob.version}`)
      }
      const nonce = sodium.from_base64(blob.nonce, sodium.base64_variants.ORIGINAL)
      const cipher = sodium.from_base64(blob.ciphertext, sodium.base64_variants.ORIGINAL)
      const plaintext = sodium.crypto_secretbox_open_easy(cipher, nonce, key)

      if (opts.aad) {
        const expected = sodium.from_string(opts.aad)
        if (plaintext.length <= expected.length + 1) {
          throw new VaultOpenError('Plaintext shorter than expected AAD')
        }
        for (let i = 0; i < expected.length; i++) {
          if (plaintext[i] !== expected[i]) {
            throw new VaultOpenError('AAD mismatch')
          }
        }
        if (plaintext[expected.length] !== 0) {
          throw new VaultOpenError('AAD separator missing')
        }
        return plaintext.slice(expected.length + 1)
      }
      return plaintext
    } catch (err) {
      if (err instanceof VaultOpenError) throw err
      throw new VaultOpenError('Open failed — MAC invalid or blob corrupted', err)
    }
  }

  /**
   * Convenience: seal a string payload, return a JSON-serialisable blob.
   */
  async sealJson(value: unknown, opts: VaultOptions = {}): Promise<SealedBlob> {
    return this.seal(JSON.stringify(value), opts)
  }

  /**
   * Convenience: open a blob and parse JSON.
   */
  async openJson<T = unknown>(blob: SealedBlob, opts: VaultOptions = {}): Promise<T> {
    const bytes = await this.open(blob, opts)
    const sodium = await sodiumReady()
    return JSON.parse(sodium.to_string(bytes)) as T
  }
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}
