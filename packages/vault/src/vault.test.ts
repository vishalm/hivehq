import { describe, expect, it } from 'vitest'
import { Vault } from './vault.js'
import { generateKey } from './keys.js'
import { VaultOpenError } from './errors.js'

describe('Vault', () => {
  it('seals and opens a round-trip string', async () => {
    const vault = new Vault()
    await vault.ready(await generateKey())
    const blob = await vault.seal('hello hive')
    const out = await vault.open(blob)
    expect(new TextDecoder().decode(out)).toBe('hello hive')
  })

  it('sealJson + openJson round-trips objects', async () => {
    const vault = new Vault()
    await vault.ready(await generateKey())
    const original = { scout_id: 'abc', count: 42 }
    const blob = await vault.sealJson(original)
    const opened = await vault.openJson<typeof original>(blob)
    expect(opened).toEqual(original)
  })

  it('rejects ciphertext sealed under a different key', async () => {
    const a = new Vault()
    const b = new Vault()
    await a.ready(await generateKey())
    await b.ready(await generateKey())
    const blob = await a.seal('secret')
    await expect(b.open(blob)).rejects.toBeInstanceOf(VaultOpenError)
  })

  it('enforces AAD binding', async () => {
    const vault = new Vault()
    await vault.ready(await generateKey())
    const blob = await vault.seal('x', { aad: 'scout-v1' })
    await expect(vault.open(blob, { aad: 'scout-v2' })).rejects.toBeInstanceOf(VaultOpenError)
  })

  it('throws before ready()', async () => {
    const vault = new Vault()
    await expect(vault.seal('x')).rejects.toThrow(/not initialised/)
  })
})
