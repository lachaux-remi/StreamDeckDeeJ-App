import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@main': fileURLToPath(new URL('./src/main', import.meta.url)),
      '@renderer': fileURLToPath(new URL('./src/renderer/src', import.meta.url))
    }
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/main/services/config-transfer.ts', 'src/main/services/serial-protocol.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        'src/main/services/config-transfer.ts': {
          branches: 91.48,
          functions: 100,
          lines: 91.25,
          statements: 90.69
        },
        'src/main/services/serial-protocol.ts': {
          branches: 91.04,
          functions: 100,
          lines: 97.01,
          statements: 93.15
        }
      }
    },
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
