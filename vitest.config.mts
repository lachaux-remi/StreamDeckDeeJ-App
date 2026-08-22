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
      include: [
        'src/main/services/renderer-settings.ts',
        'src/main/services/secret-storage.ts',
        'src/main/services/serial-protocol.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 87.12,
        functions: 96.42,
        lines: 97.24,
        statements: 93.33
      }
    },
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
