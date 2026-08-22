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
        'src/main/services/serial-protocol.ts',
        'src/main/services/linux-update-controller.ts',
        'src/main/services/linux-update-policy.ts',
        'src/main/services/update-command.ts',
        'src/main/types/update.types.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 80,
        functions: 84,
        lines: 89,
        statements: 82
      }
    },
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
