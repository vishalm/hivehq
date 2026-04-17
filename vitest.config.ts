import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@hive/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
      '@hive/intelligence': path.resolve(__dirname, 'packages/intelligence/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'connectors/*/src/**/*.test.ts'],
  },
})
