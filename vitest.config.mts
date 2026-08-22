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
      include: ['src/main/services/audio-command.ts', 'src/main/services/serial-protocol.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 87.95,
        functions: 95.83,
        lines: 95.09,
        statements: 91.22
      }
    },
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
