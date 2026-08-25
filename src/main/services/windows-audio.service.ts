import { createRequire } from 'node:module'
import { configService } from './config.service'
import { loggerService } from './logger.service'
import { sliderService } from './slider.service'

const require = createRequire(import.meta.url)

export type WindowsAudioTarget = { kind: 'master' } | { kind: 'process'; processId: number }

interface WindowsAudioLevel {
  volume: number
  muted: boolean
}

interface WindowsAudioSession extends WindowsAudioLevel {
  processId: number
  name: string
}

export interface WindowsAudioSnapshot {
  master: WindowsAudioLevel
  sessions: WindowsAudioSession[]
}

export interface WindowsAudioNativeBinding {
  snapshot(): WindowsAudioSnapshot
  setVolume(target: WindowsAudioTarget, volume: number): void
  setMuted(target: WindowsAudioTarget, muted: boolean): void
}

interface WindowsAudioSessionsOptions {
  getAssignments: () => Record<string, string[]>
  getSliders: () => Record<string, number>
  onSlidersUpdated: (listener: (sliders: Record<string, number>) => void) => () => void
  pollIntervalMs: number
  onError: (error: unknown) => void
}

const MASTER = 'master'
const SERVICE = 'WindowsAudioSessions'
const MIN_POLL_INTERVAL_MS = 250
const MAX_POLL_INTERVAL_MS = 5_000
const defaultOptions: WindowsAudioSessionsOptions = {
  getAssignments: () => ({}),
  getSliders: () => ({}),
  onSlidersUpdated: () => () => undefined,
  pollIntervalMs: 1_000,
  onError: () => undefined
}

function nameOf(session: WindowsAudioSession): string {
  return (session.name || `pid: ${session.processId}`).toLowerCase()
}

function assertVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new RangeError('volume must be a finite number from 0 to 1')
  }
}

export class WindowsAudioSessions {
  private readonly options: WindowsAudioSessionsOptions
  private readonly pollTimer: NodeJS.Timeout
  private readonly unsubscribeFromSliders: () => void
  private sessionSignature = ''

  constructor(
    private readonly native: WindowsAudioNativeBinding,
    options: Partial<WindowsAudioSessionsOptions> = {}
  ) {
    this.options = { ...defaultOptions, ...options }
    if (
      this.options.pollIntervalMs < MIN_POLL_INTERVAL_MS ||
      this.options.pollIntervalMs > MAX_POLL_INTERVAL_MS
    ) {
      throw new RangeError('poll interval must be between 250 and 5000 milliseconds')
    }
    this.pollTimer = setInterval(() => this.poll(), this.options.pollIntervalMs)
    this.pollTimer.unref()
    this.unsubscribeFromSliders = this.options.onSlidersUpdated((sliders) =>
      this.updateSliders(sliders)
    )
  }

  async getAllSessions(): Promise<string[]> {
    return [MASTER, ...new Set(this.native.snapshot().sessions.map(nameOf))]
  }

  async getOsVolumes(): Promise<Record<string, number>> {
    const snapshot = this.native.snapshot()
    const volumes: Record<string, number> = {}
    for (const [sliderKey, names] of Object.entries(this.options.getAssignments())) {
      const name = names[0]?.toLowerCase()
      if (!name) {
        continue
      }
      if (name === MASTER) {
        volumes[sliderKey] = snapshot.master.volume
        continue
      }
      const session = snapshot.sessions.find((candidate) => nameOf(candidate) === name)
      if (session) {
        volumes[sliderKey] = session.volume
      }
    }
    return volumes
  }

  async setVolume(name: string, volume: number): Promise<void> {
    assertVolume(volume)
    this.setVolumeInSnapshot(name, volume, this.native.snapshot())
  }

  async setMuted(name: string, muted: boolean): Promise<void> {
    this.forEachTarget(name, (target) => this.native.setMuted(target, muted))
  }

  updateSliders(sliders: Record<string, number>, snapshot?: WindowsAudioSnapshot): void {
    let currentSnapshot: WindowsAudioSnapshot
    try {
      currentSnapshot = snapshot ?? this.native.snapshot()
    } catch (error) {
      this.options.onError(error)
      return
    }
    for (const [sliderKey, volume] of Object.entries(sliders)) {
      for (const name of this.options.getAssignments()[sliderKey] ?? []) {
        try {
          this.setVolumeInSnapshot(name, volume, currentSnapshot)
        } catch (error) {
          this.options.onError(error)
        }
      }
    }
  }

  shutdown(): void {
    clearInterval(this.pollTimer)
    this.unsubscribeFromSliders()
  }

  private forEachTarget(name: string, operation: (target: WindowsAudioTarget) => void): void {
    this.forEachTargetInSnapshot(name, this.native.snapshot(), operation)
  }

  private setVolumeInSnapshot(name: string, volume: number, snapshot: WindowsAudioSnapshot): void {
    assertVolume(volume)
    this.forEachTargetInSnapshot(name, snapshot, (target) => this.native.setVolume(target, volume))
  }

  private forEachTargetInSnapshot(
    name: string,
    snapshot: WindowsAudioSnapshot,
    operation: (target: WindowsAudioTarget) => void
  ): void {
    const normalized = name.toLowerCase()
    if (normalized === MASTER) {
      operation({ kind: 'master' })
      return
    }

    const processIds = new Set(
      snapshot.sessions
        .filter((session) => nameOf(session) === normalized)
        .map((session) => session.processId)
    )
    for (const processId of processIds) {
      operation({ kind: 'process', processId })
    }
  }

  private poll(): void {
    try {
      const snapshot = this.native.snapshot()
      const signature = snapshot.sessions
        .map((session) => `${session.processId}:${nameOf(session)}`)
        .sort()
        .join('|')
      if (signature !== this.sessionSignature) {
        this.sessionSignature = signature
        this.updateSliders(this.options.getSliders(), snapshot)
      }
    } catch (error) {
      this.options.onError(error)
    }
  }
}

function loadNativeBinding(): WindowsAudioNativeBinding {
  return require('@streamdeck-deej/windows-audio-native') as WindowsAudioNativeBinding
}

export function createWindowsAudioSessions(
  native: WindowsAudioNativeBinding = loadNativeBinding()
): WindowsAudioSessions {
  const sessions = new WindowsAudioSessions(native, {
    getAssignments: () => configService.getConfig().deej ?? {},
    getSliders: () => sliderService.getSliders(),
    onSlidersUpdated: (listener) => sliderService.onUpdated(listener),
    onError: (error) =>
      loggerService.error(`Windows audio polling failed: ${String(error)}`, SERVICE)
  })
  return sessions
}
