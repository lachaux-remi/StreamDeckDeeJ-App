import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { HardwareDiagnostic } from '../shared/hardware-diagnostic'
import type { PlatformRuntime } from './platform-runtime'
import { hardwarePermissionsService } from './services/hardware-permissions.service'
import { setLinuxAutostart } from './services/linux-autostart'
import { linuxUpdateService } from './services/linux-update.service'
import { micService } from './services/mic.service'
import { sessionsService } from './services/sessions.service'

const AUTOSTART_FILE = join(homedir(), '.config', 'autostart', 'streamdeck-deej.desktop')

function withLinuxPlatform<T extends object>(diagnostic: T): T & { platform: 'linux' } {
  return { platform: 'linux', ...diagnostic }
}

export function createLinuxPlatformRuntime(): PlatformRuntime {
  const appIcon = app.isPackaged
    ? join(process.resourcesPath, 'logo.png')
    : join(__dirname, '../../resources/logo.png')

  return {
    audio: {
      available: true,
      sessions: {
        getAllSessions: () => sessionsService.getAllSessions(),
        getOsVolumes: () => sessionsService.getOsVolumes(),
        shutdown: () => sessionsService.shutdown()
      },
      microphone: {
        init: () => micService.init(),
        isMuted: () => micService.isMuted(),
        on(event, listener) {
          micService.on(event, listener)
          return this
        },
        shutdown: () => micService.shutdown()
      }
    },
    hardwarePermissions: {
      async diagnose() {
        return withLinuxPlatform(await hardwarePermissionsService.diagnose()) as HardwareDiagnostic
      },
      async install() {
        const result = await hardwarePermissionsService.install()
        return {
          result: result.result,
          diagnostic: withLinuxPlatform(result.diagnostic) as HardwareDiagnostic
        }
      }
    },
    updater: linuxUpdateService,
    async setAutostart(enabled) {
      await setLinuxAutostart({
        enabled,
        appName: app.getName(),
        autostartFile: AUTOSTART_FILE,
        executablePath: process.execPath,
        appImagePath: process.env.APPIMAGE,
        packagedIconPath: appIcon,
        persistentIconPath: join(app.getPath('userData'), 'autostart-icon.png')
      })
    },
    async shutdown() {
      await Promise.all([sessionsService.shutdown(), micService.shutdown()])
    }
  }
}
