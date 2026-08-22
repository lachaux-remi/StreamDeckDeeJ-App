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
        'src/main/services/audio-command.ts',
        'src/main/services/config-transfer.ts',
        'src/main/services/renderer-settings.ts',
        'src/main/services/secret-storage.ts',
        'src/main/services/serial-protocol.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 85.47,
        functions: 95,
        lines: 95.83,
        statements: 91.92,
        'src/main/services/{audio-command,serial-protocol}.ts': {
          branches: 87.95,
          functions: 95.83,
          lines: 95.09,
          statements: 91.22
        },
        'src/main/services/{renderer-settings,secret-storage,serial-protocol}.ts': {
          branches: 87.12,
          functions: 96.42,
          lines: 97.24,
          statements: 93.33
        },
        'src/main/services/audio-command.ts': {
          branches: 75,
          functions: 91.66,
          lines: 91.42,
          statements: 87.8
        },
        'src/main/services/config-transfer.ts': {
          branches: 95.74,
          functions: 100,
          lines: 98.75,
          statements: 97.67
        },
        'src/main/services/renderer-settings.ts': {
          branches: 50,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/services/secret-storage.ts': {
          branches: 81.25,
          functions: 93.33,
          lines: 97.5,
          statements: 93.33
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
