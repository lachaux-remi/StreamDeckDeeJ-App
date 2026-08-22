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
        'scripts/linux-permissions.mjs',
        'src/main/handlers/hardware-permissions.contract.ts',
        'src/main/handlers/trusted-ipc-core.ts',
        'src/main/services/hardware-permissions-core.ts',
        'src/main/services/serial-protocol.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 83.05,
        functions: 100,
        lines: 95.96,
        statements: 91.91
      }
    },
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
