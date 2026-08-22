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
        'src/main/services/serial-port-discovery.ts',
        'src/main/services/serial-protocol.ts',
        'src/main/services/settings-defaults.ts',
        'src/renderer/src/stores/settings.defaults.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 94.11,
        functions: 100,
        lines: 100,
        statements: 96.29,
        'src/main/services/serial-port-discovery.ts': {
          branches: 83.33,
          functions: 100,
          lines: 100,
          statements: 90.9
        },
        'src/main/services/serial-protocol.ts': {
          branches: 94.8,
          functions: 100,
          lines: 100,
          statements: 96.8
        },
        'src/main/services/settings-defaults.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/renderer/src/stores/settings.defaults.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        }
      }
    },
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
