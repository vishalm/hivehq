/**
 * @hive/vault — Zero-knowledge client-side key vault.
 *
 * Design constraint: this package has ZERO server-side logic.
 * Keys never leave the device. The only thing that is ever stored
 * or transmitted is the encrypted ciphertext — which is useless
 * without the local key.
 *
 * If this package ever imports anything from @hive/node-server or
 * @hive/hive-server, the trust covenant is broken. Don't.
 */

export {
  VaultError,
  VaultSealError,
  VaultOpenError,
  VaultNotReadyError,
} from './errors.js'
export type { SealedBlob, VaultOptions, KeyMaterial } from './types.js'
export { Vault } from './vault.js'
export { generateKey, keyToBase64, keyFromBase64 } from './keys.js'
