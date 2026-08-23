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
        'src/shared/input-limits.ts',
        'src/main/libs/home-assistant/HomeAssistantAPI.ts',
        'src/main/handlers/app.handlers.ts',
        'src/main/handlers/conditions.handlers.ts',
        'src/main/handlers/deej.handlers.ts',
        'src/main/handlers/hardware-permissions.handlers.ts',
        'src/main/handlers/hardware-permissions.contract.ts',
        'src/main/handlers/index.ts',
        'src/main/handlers/serial.handlers.ts',
        'src/main/handlers/settings.handlers.ts',
        'src/main/handlers/streamdeck.handlers.ts',
        'src/main/handlers/trusted-ipc.ts',
        'src/main/handlers/trusted-ipc-core.ts',
        'src/main/handlers/update.handlers.ts',
        'src/main/services/app-quit-coordinator.ts',
        'src/main/services/audio-command.ts',
        'src/main/services/audio-subscription.ts',
        'src/main/services/config-transfer.ts',
        'src/main/services/discord.service.ts',
        'src/main/services/discord-rpc-codec.ts',
        'src/main/services/hardware-permissions-core.ts',
        'src/main/services/home-assistant-state-sync.ts',
        'src/main/services/linux-autostart.ts',
        'src/main/services/linux-update-controller.ts',
        'src/main/services/linux-update-policy.ts',
        'src/main/services/linux-update.service.ts',
        'src/main/services/led.service.ts',
        'src/main/services/renderer-settings.ts',
        'src/main/services/secret-storage.ts',
        'src/main/services/serial-port-discovery.ts',
        'src/main/services/serial-protocol.ts',
        'src/main/services/serial.service.ts',
        'src/main/services/sessions.service.ts',
        'src/main/services/settings-defaults.ts',
        'src/main/services/update-command.ts',
        'src/main/services/window-close-handler.ts',
        'src/main/types/settings.types.ts',
        'src/main/types/update.types.ts',
        'src/renderer/src/lib/icon-file.ts',
        'src/preload/index.ts',
        'src/renderer/src/types/settings.types.ts',
        'src/renderer/src/stores/settings.defaults.ts'
      ],
      reporter: ['text', 'html'],
      thresholds: {
        '{scripts/linux-permissions.mjs,src/shared/input-limits.ts,src/main/handlers/{hardware-permissions.contract,streamdeck.handlers,trusted-ipc-core}.ts,src/main/services/{app-quit-coordinator,audio-command,audio-subscription,config-transfer,discord-rpc-codec,hardware-permissions-core,home-assistant-state-sync,linux-autostart,linux-update-controller,linux-update-policy,renderer-settings,secret-storage,serial-port-discovery,serial-protocol,settings-defaults,update-command,window-close-handler}.ts,src/main/types/{settings,update}.types.ts,src/renderer/src/lib/icon-file.ts,src/renderer/src/types/settings.types.ts,src/renderer/src/stores/settings.defaults.ts}':
          {
            branches: 86.26,
            functions: 92.85,
            lines: 95.12,
            statements: 91.38
          },
        'src/main/libs/home-assistant/HomeAssistantAPI.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/handlers/{app,conditions,deej,hardware-permissions,serial}.handlers.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/handlers/index.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/handlers/trusted-ipc.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/main/handlers/settings.handlers.ts': {
          branches: 50,
          functions: 100,
          lines: 93.75,
          statements: 94.73
        },
        'src/main/handlers/update.handlers.ts': {
          branches: 31.25,
          functions: 80,
          lines: 62.5,
          statements: 63.15
        },
        'src/main/services/discord.service.ts': {
          branches: 45.55,
          functions: 80,
          lines: 73.59,
          statements: 69.58
        },
        'src/main/services/led.service.ts': {
          branches: 68.75,
          functions: 52.63,
          lines: 88,
          statements: 83.03
        },
        'src/main/services/linux-update.service.ts': {
          branches: 79.59,
          functions: 81.48,
          lines: 91.66,
          statements: 84.12
        },
        'src/main/services/serial.service.ts': {
          branches: 66.66,
          functions: 85.71,
          lines: 81.67,
          statements: 79.86
        },
        'src/main/services/sessions.service.ts': {
          branches: 48.71,
          functions: 61.53,
          lines: 70.09,
          statements: 67.4
        },
        'src/preload/index.ts': {
          branches: 50,
          functions: 100,
          lines: 97.67,
          statements: 98.11
        },
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
        'src/main/services/home-assistant-state-sync.ts': {
          branches: 90,
          functions: 100,
          lines: 100,
          statements: 100
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
