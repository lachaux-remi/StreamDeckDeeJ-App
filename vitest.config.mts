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
        'src/main/services/app-quit-coordinator.ts',
        'src/main/services/audio-command.ts',
        'src/main/services/audio-subscription.ts',
        'src/main/services/config-transfer.ts',
        'src/main/services/hardware-permissions-core.ts',
        'src/main/services/linux-autostart.ts',
        'src/main/services/linux-update-controller.ts',
        'src/main/services/linux-update-policy.ts',
        'src/main/services/renderer-settings.ts',
        'src/main/services/secret-storage.ts',
        'src/main/services/serial-port-discovery.ts',
        'src/main/services/serial-protocol.ts',
        'src/main/services/settings-defaults.ts',
        'src/main/services/update-command.ts',
        'src/main/services/window-close-handler.ts',
        'src/main/types/update.types.ts',
        'src/renderer/src/stores/settings.defaults.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        branches: 86.26,
        functions: 92.85,
        lines: 95.12,
        statements: 91.38,
        '{scripts/linux-permissions.mjs,src/main/handlers/{hardware-permissions.contract,trusted-ipc-core}.ts,src/main/services/{audio-command,config-transfer,hardware-permissions-core,renderer-settings,secret-storage,serial-port-discovery,serial-protocol,settings-defaults}.ts,src/renderer/src/stores/settings.defaults.ts}':
          {
            branches: 90.1,
            functions: 97.05,
            lines: 98,
            statements: 95.03
          },
        'scripts/linux-permissions.mjs': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/handlers/{hardware-permissions.contract,trusted-ipc-core}.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
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
        'src/main/services/audio-subscription.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/services/app-quit-coordinator.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/services/config-transfer.ts': {
          branches: 95.74,
          functions: 100,
          lines: 98.75,
          statements: 97.67
        },
        'src/main/services/hardware-permissions-core.ts': {
          branches: 95.74,
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
          branches: 94.8,
          functions: 100,
          lines: 100,
          statements: 96.8
        },
        'src/main/services/serial-port-discovery.ts': {
          branches: 83.33,
          functions: 100,
          lines: 100,
          statements: 90.9
        },
        'src/main/services/settings-defaults.ts': {
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
    include: ['tests/**/*.test.ts']
  }
})
