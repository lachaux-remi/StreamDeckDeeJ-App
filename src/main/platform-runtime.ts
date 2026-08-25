import { EventEmitter } from 'node:events'
import type { HardwareDiagnostic } from '../shared/hardware-diagnostic'
import type { LinuxUpdateState } from './types/update.types'

export interface AudioSessionsCapability {
  getAllSessions(): Promise<string[]>
  getOsVolumes(): Promise<Record<string, number>>
  shutdown(): void | Promise<void>
}

export interface MicrophoneCapability {
  init(): Promise<void>
  isMuted(): boolean
  on(event: 'change', listener: () => void): this
  shutdown(): void | Promise<void>
}

export interface HardwarePermissionsCapability {
  diagnose(): Promise<HardwareDiagnostic>
  install(): Promise<{
    result: 'installed' | 'cancelled' | 'failed'
    diagnostic: HardwareDiagnostic
  }>
}

export interface UpdateCapability {
  init(installUpdate: (quitAndInstall: () => void | Promise<void>) => Promise<void>): void
  getState(): LinuxUpdateState
  onStateChanged(listener: (state: LinuxUpdateState) => void): void
  check(): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  openRelease(): Promise<void>
}

export interface PlatformRuntime {
  audio: {
    available: boolean
    sessions: AudioSessionsCapability
    microphone: MicrophoneCapability
  }
  hardwarePermissions: HardwarePermissionsCapability
  updater: UpdateCapability
  setAutostart(enabled: boolean): Promise<void>
  shutdown(): Promise<void>
}

interface PlatformRuntimeDependencies {
  loadLinux: () => Promise<PlatformRuntime>
  loadWindowsAudio: () => Promise<AudioSessionsCapability>
  diagnoseWindowsHardware: () => Promise<Extract<HardwareDiagnostic, { platform: 'windows' }>>
  setLoginItemSettings: (settings: { openAtLogin: boolean }) => void
}

class UnavailableMicrophone extends EventEmitter implements MicrophoneCapability {
  init(): Promise<void> {
    return Promise.resolve()
  }
  isMuted(): boolean {
    return false
  }
  shutdown(): Promise<void> {
    return Promise.resolve()
  }
}

const disabledUpdater: UpdateCapability = {
  init: () => undefined,
  getState: () => ({ mode: 'disabled', status: 'disabled' }),
  onStateChanged: () => undefined,
  check: () => Promise.resolve(),
  download: () => Promise.resolve(),
  install: () => Promise.resolve(),
  openRelease: () => Promise.resolve()
}

const defaultDependencies: PlatformRuntimeDependencies = {
  loadLinux: async () => (await import('./platform-linux')).createLinuxPlatformRuntime(),
  loadWindowsAudio: async () =>
    (await import('./services/windows-audio.service')).createWindowsAudioSessions(),
  diagnoseWindowsHardware: async () =>
    (await import('./services/windows-hardware.service')).diagnoseWindowsHardware(),
  setLoginItemSettings: () => {
    throw new Error('Windows login item settings adapter is unavailable')
  }
}

export async function createPlatformRuntime(
  platform: NodeJS.Platform,
  dependencies: Partial<PlatformRuntimeDependencies> = {}
): Promise<PlatformRuntime> {
  const adapters = { ...defaultDependencies, ...dependencies }
  if (platform === 'linux') {
    return adapters.loadLinux()
  }
  if (platform !== 'win32') {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  const microphone = new UnavailableMicrophone()
  const sessions = await adapters.loadWindowsAudio()
  return {
    audio: { available: true, sessions, microphone },
    hardwarePermissions: {
      diagnose: adapters.diagnoseWindowsHardware,
      async install() {
        throw new Error('Hardware permission installation is not applicable on Windows')
      }
    },
    updater: disabledUpdater,
    async setAutostart(enabled) {
      adapters.setLoginItemSettings({ openAtLogin: enabled })
    },
    async shutdown() {
      await Promise.all([sessions.shutdown(), microphone.shutdown()])
    }
  }
}
