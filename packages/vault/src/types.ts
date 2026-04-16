/** Opaque bytes representing a secret key. Never serialise to disk unencrypted. */
export type KeyMaterial = Uint8Array

/**
 * A sealed payload — safe to write to disk, send over the wire, or log.
 * Useless without the key that sealed it.
 */
export interface SealedBlob {
  /** Protocol tag. Distinguishes vault formats across versions. */
  version: 1
  /** Random nonce, base64. */
  nonce: string
  /** Encrypted ciphertext + MAC, base64. */
  ciphertext: string
}

export interface VaultOptions {
  /** Optional associated data (AAD) bound to the ciphertext. */
  aad?: string
}
