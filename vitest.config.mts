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
        'src/main/services/app-quit-coordinator.ts',
        'src/main/services/linux-update-controller.ts',
        'src/main/services/linux-update-policy.ts',
        'src/main/services/update-command.ts',
        'src/main/types/update.types.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 81.81,
        functions: 86.27,
        lines: 90.52,
        statements: 85.02,
        'src/main/services/serial-protocol.ts': {
          branches: 91.04,
          functions: 100,
          lines: 97.01,
          statements: 93.15
        },
        'src/main/services/app-quit-coordinator.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/services/linux-update-controller.ts': {
          branches: 76.71,
          functions: 69.56,
          lines: 81.81,
          statements: 72.09
        },
        'src/main/services/linux-update-policy.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/services/update-command.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/types/update.types.ts': {
          branches: 69.04,
          functions: 100,
          lines: 76.47,
          statements: 75
        }
      }
    },
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
