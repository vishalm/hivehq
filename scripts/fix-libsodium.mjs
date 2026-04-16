// fix-libsodium.mjs
//
// Workaround for libsodium-wrappers 0.7.16 shipping without libsodium.mjs.
// The ESM entry imports './libsodium.mjs' relative to its own directory,
// but that file is only published inside the sibling `libsodium` package.
//
// This script copies the file into place after `npm install` so that both
// our own sandbox and clean CI runners can load the wrapper under Vitest/ESM.
//
// Safe to run repeatedly. No-op if the source is missing or the target
// already exists. Exits zero on all recoverable conditions so npm install
// never fails on this.

import { existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const src = resolve(root, 'node_modules/libsodium/dist/modules-esm/libsodium.mjs')
const dst = resolve(root, 'node_modules/libsodium-wrappers/dist/modules-esm/libsodium.mjs')

try {
  if (!existsSync(src)) {
    // Nothing to do — either libsodium is not installed or upstream fixed packaging.
    process.exit(0)
  }
  if (existsSync(dst)) {
    process.exit(0)
  }
  mkdirSync(dirname(dst), { recursive: true })
  copyFileSync(src, dst)
  console.log('[fix-libsodium] synced libsodium.mjs into libsodium-wrappers/dist/modules-esm/')
} catch (err) {
  // Non-fatal — typecheck/tests will surface a clearer error if this is actually required.
  console.warn('[fix-libsodium] skipped:', err instanceof Error ? err.message : err)
}
