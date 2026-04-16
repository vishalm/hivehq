import sodium from 'libsodium-wrappers'
import type { KeyMaterial } from './types.js'
import { VaultNotReadyError } from './errors.js'

let ready = false

async function ensureReady(): Promise<void> {
  if (ready) return
  await sodium.ready
  ready = true
}

/** Generate a fresh 256-bit secret-stream key. Call ensureReady first if not inside Vault. */
export async function generateKey(): Promise<KeyMaterial> {
  await ensureReady()
  return sodium.crypto_secretbox_keygen()
}

export async function keyToBase64(key: KeyMaterial): Promise<string> {
  await ensureReady()
  return sodium.to_base64(key, sodium.base64_variants.ORIGINAL)
}

export async function keyFromBase64(encoded: string): Promise<KeyMaterial> {
  await ensureReady()
  const key = sodium.from_base64(encoded, sodium.base64_variants.ORIGINAL)
  if (key.length !== sodium.crypto_secretbox_KEYBYTES) {
    throw new VaultNotReadyError(
      `Invalid key length: expected ${sodium.crypto_secretbox_KEYBYTES}, got ${key.length}`,
    )
  }
  return key
}

export async function sodiumReady(): Promise<typeof sodium> {
  await ensureReady()
  return sodium
}
