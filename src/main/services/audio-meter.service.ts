import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { DeeJConfig } from '../types/settings.types'
import { commandRunner, type CommandRunner } from './audio-command'
import { peakToLevel, S16PeakReader } from './audio-level'
import { loggerService } from './logger.service'
import { findPipeWireNodeByName, parsePipeWireOutputStreams } from './pipewire-streams'

const SERVICE = 'AudioMeterService'
const RESCAN_INTERVAL_MS = 5_000
const RESTART_DELAY_MS = 2_000
const BROADCAST_INTERVAL_MS = 33
const PEAK_DECAY_PER_FRAME = 0.04
const LINK_ATTEMPTS = 5
const LINK_RETRY_DELAY_MS = 200
/** Upper bound on concurrent capture processes, whatever the slider mapping. */
export const MAX_MONITORS = 16

const SAMPLE_ARGS = ['--rate=44100', '--channels=1'] as const
const PAREC_ARGS = ['--raw', ...SAMPLE_ARGS, '--format=s16le', '--latency-msec=30'] as const

type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptions
) => ChildProcess

export interface AudioMeterDependencies {
  spawn: SpawnProcess
  runner: CommandRunner
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
  setInterval: typeof setInterval
  clearInterval: typeof clearInterval
  createId(): string
}

interface MeterTarget {
  id: string
  label: string
  /** pactl sink input index (PulseAudio-compatible apps). */
  sinkInputIndex?: number
  /** PipeWire output node (PipeWire-native apps, linked to a pw-record capture). */
  pwNodeId?: number
  sliders: Set<string>
}

interface Monitor {
  target: MeterTarget
  process: ChildProcess
  reader: S16PeakReader
  level: number
}

function sinkInputPids(output: string): Map<string, number> {
  const indexes = new Map<string, number>()
  for (const block of output.split('Sink Input #')) {
    const index = block.match(/^(\d+)/)
    const pid = block.match(/application\.process\.id\s*=\s*"(\d+)"/)
    if (index && pid) {
      indexes.set(pid[1], Number(index[1]))
    }
  }
  return indexes
}

/**
 * Meters the real audio level of the sessions mapped to each DeeJ slider.
 * PulseAudio-compatible apps are captured with `parec --monitor-stream`;
 * PipeWire-native apps (no pactl sink input) with an unlinked `pw-record`
 * stream wired to their output node by `pw-link`; the master session with the
 * default sink monitor. Levels are emitted per slider at ~30 Hz.
 */
export class AudioMeterService extends EventEmitter {
  private readonly deps: AudioMeterDependencies
  private readonly monitors = new Map<string, Monitor>()
  private readonly unavailableCommands = new Set<string>()
  private config: DeeJConfig = {}
  private configKey = '{}'
  private active = true
  private stopped = false
  private rescanTimer: ReturnType<typeof setTimeout> | undefined
  private broadcastTimer: ReturnType<typeof setInterval> | undefined
  private rescanPromise: Promise<void> | undefined
  private rescanQueued = false
  private lastEmittedSilent = true

  constructor(dependencies: Partial<AudioMeterDependencies> = {}) {
    super()
    this.deps = {
      spawn: nodeSpawn,
      runner: commandRunner,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      createId: randomUUID,
      ...dependencies
    }
  }

  updateConfig(config: DeeJConfig): void {
    const key = JSON.stringify(config)
    if (key === this.configKey) {
      return
    }
    this.config = structuredClone(config)
    this.configKey = key
    this.refresh()
  }

  /** Stops every capture while the window is hidden; resumes when shown. */
  setActive(active: boolean): void {
    if (active === this.active) {
      return
    }
    this.active = active
    this.refresh()
  }

  shutdown(): void {
    this.stopped = true
    this.stopAll()
  }

  private hasMappedSessions(): boolean {
    return Object.values(this.config).some((sessions) => sessions.length > 0)
  }

  private refresh(): void {
    if (this.stopped || !this.active || !this.hasMappedSessions()) {
      this.stopAll()
      return
    }
    this.startBroadcast()
    void this.rescan()
  }

  private stopAll(): void {
    if (this.rescanTimer) {
      this.deps.clearTimeout(this.rescanTimer)
      this.rescanTimer = undefined
    }
    if (this.broadcastTimer) {
      this.deps.clearInterval(this.broadcastTimer)
      this.broadcastTimer = undefined
    }
    for (const id of [...this.monitors.keys()]) {
      this.stopMonitor(id)
    }
    if (!this.lastEmittedSilent) {
      this.lastEmittedSilent = true
      this.emit('levels', {})
    }
  }

  private isRunning(): boolean {
    return !this.stopped && this.active && this.hasMappedSessions()
  }

  private rescan(): Promise<void> {
    if (this.rescanPromise) {
      this.rescanQueued = true
      return this.rescanPromise
    }
    this.rescanPromise = this.scanOnce()
      .catch((error) => loggerService.error(`Audio meter scan failed: ${String(error)}`, SERVICE))
      .finally(() => {
        this.rescanPromise = undefined
        if (this.rescanQueued) {
          this.rescanQueued = false
          void this.rescan()
          return
        }
        this.scheduleRescan(RESCAN_INTERVAL_MS)
      })
    return this.rescanPromise
  }

  private scheduleRescan(delay: number): void {
    if (!this.isRunning()) {
      return
    }
    if (this.rescanTimer) {
      this.deps.clearTimeout(this.rescanTimer)
    }
    this.rescanTimer = this.deps.setTimeout(() => {
      this.rescanTimer = undefined
      void this.rescan()
    }, delay)
  }

  private async scanOnce(): Promise<void> {
    if (!this.isRunning()) {
      return
    }
    const wanted = await this.findTargets()
    if (!this.isRunning()) {
      return
    }

    for (const id of [...this.monitors.keys()]) {
      if (!wanted.has(id)) {
        this.stopMonitor(id)
      }
    }
    for (const target of wanted.values()) {
      const monitor = this.monitors.get(target.id)
      if (monitor) {
        monitor.target.sliders = target.sliders
      } else if (this.monitors.size < MAX_MONITORS) {
        this.startMonitor(target)
      }
    }
  }

  private async findTargets(): Promise<Map<string, MeterTarget>> {
    const targets = new Map<string, MeterTarget>()
    const add = (target: Omit<MeterTarget, 'sliders'>, slider: string): void => {
      const existing = targets.get(target.id)
      if (existing) {
        existing.sliders.add(slider)
      } else if (targets.size < MAX_MONITORS) {
        targets.set(target.id, { ...target, sliders: new Set([slider]) })
      }
    }

    const wantedNames = new Map<string, string[]>()
    for (const [slider, sessions] of Object.entries(this.config)) {
      for (const session of sessions) {
        if (session.toLowerCase() === 'master') {
          add({ id: 'master', label: 'master' }, slider)
          continue
        }
        const sliders = wantedNames.get(session.toLowerCase()) ?? []
        sliders.push(slider)
        wantedNames.set(session.toLowerCase(), sliders)
      }
    }
    if (wantedNames.size === 0) {
      return targets
    }

    let streams: ReturnType<typeof parsePipeWireOutputStreams>
    try {
      streams = parsePipeWireOutputStreams(
        await this.deps.runner.run('pw-dump', ['--no-colors'], 5_000)
      )
    } catch (error) {
      loggerService.debug(`pw-dump unavailable for audio meter: ${String(error)}`, SERVICE)
      return targets
    }

    let pidIndexes = new Map<string, number>()
    try {
      pidIndexes = sinkInputPids(
        await this.deps.runner.run('pactl', ['list', 'sink-inputs'], 5_000)
      )
    } catch {
      // Without pactl, every app is metered through pw-record + pw-link.
    }

    for (const stream of streams) {
      const sliders = wantedNames.get(stream.name.toLowerCase())
      if (!sliders) {
        continue
      }
      const sinkInputIndex = stream.pid === undefined ? undefined : pidIndexes.get(stream.pid)
      for (const slider of sliders) {
        add(
          sinkInputIndex === undefined
            ? { id: `node:${stream.pwNodeId}`, label: stream.name, pwNodeId: stream.pwNodeId }
            : { id: `sink:${sinkInputIndex}`, label: stream.name, sinkInputIndex },
          slider
        )
      }
    }
    return targets
  }

  private startMonitor(target: MeterTarget): void {
    const meterName = `StreamDeck-DeeJ - ${target.label} Meter`.replace(/["\\]/g, '')
    let command: string
    let args: string[]
    let captureNodeName: string | undefined

    if (target.pwNodeId !== undefined) {
      captureNodeName = `streamdeck-deej-meter-${this.deps.createId()}`
      command = 'pw-record'
      args = [
        '--prop=node.autoconnect=false',
        `--prop=node.name=${captureNodeName}`,
        '--raw',
        '--format=s16',
        ...SAMPLE_ARGS,
        '-'
      ]
    } else {
      command = 'parec'
      args = [
        target.sinkInputIndex === undefined
          ? '--device=@DEFAULT_MONITOR@'
          : `--monitor-stream=${target.sinkInputIndex}`,
        ...PAREC_ARGS
      ]
    }
    if (this.unavailableCommands.has(command)) {
      return
    }

    let child: ChildProcess
    try {
      child = this.deps.spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PULSE_PROP_OVERRIDE: `media.role=filter application.name="${meterName}"`
        }
      })
    } catch (error) {
      loggerService.warn(`Cannot start ${command} for the audio meter: ${String(error)}`, SERVICE)
      return
    }

    const monitor: Monitor = { target, process: child, reader: new S16PeakReader(), level: 0 }
    this.monitors.set(target.id, monitor)

    child.stdout?.on('data', (chunk: Buffer) => {
      const level = peakToLevel(monitor.reader.push(chunk))
      if (level > monitor.level) {
        monitor.level = level
      }
    })
    child.stderr?.on('data', (data: Buffer) => {
      loggerService.debug(`${command} (${target.label}): ${data.toString().trim()}`, SERVICE)
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        this.unavailableCommands.add(command)
        loggerService.warn(`${command} is not installed: audio meter disabled for it`, SERVICE)
      }
    })
    child.on('close', () => {
      if (this.monitors.get(target.id) === monitor) {
        this.monitors.delete(target.id)
        this.scheduleRescan(RESTART_DELAY_MS)
      }
    })

    if (captureNodeName && target.pwNodeId !== undefined) {
      void this.linkCapture(monitor, target.pwNodeId, captureNodeName)
    }
  }

  // pw-record is started unlinked; wire the app's output node to it once its
  // capture node, identified by the unique node.name, appears in the graph.
  private async linkCapture(
    monitor: Monitor,
    sourceNodeId: number,
    captureNodeName: string
  ): Promise<void> {
    for (let attempt = 0; attempt < LINK_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) => this.deps.setTimeout(resolve, LINK_RETRY_DELAY_MS))
      if (this.monitors.get(monitor.target.id) !== monitor) {
        return
      }
      try {
        const captureNodeId = findPipeWireNodeByName(
          await this.deps.runner.run('pw-dump', ['--no-colors'], 5_000),
          captureNodeName
        )
        if (captureNodeId === undefined) {
          continue
        }
        await this.deps.runner.run('pw-link', [String(sourceNodeId), String(captureNodeId)], 2_000)
        return
      } catch (error) {
        loggerService.debug(`pw-link failed for ${monitor.target.label}: ${String(error)}`, SERVICE)
        break
      }
    }
    // An unlinked pw-record would only ever read silence.
    if (this.monitors.get(monitor.target.id) === monitor) {
      this.stopMonitor(monitor.target.id)
    }
  }

  private stopMonitor(id: string): void {
    const monitor = this.monitors.get(id)
    if (!monitor) {
      return
    }
    this.monitors.delete(id)
    monitor.process.stdout?.removeAllListeners('data')
    if (monitor.process.exitCode === null && monitor.process.signalCode === null) {
      monitor.process.kill('SIGTERM')
    }
  }

  private startBroadcast(): void {
    if (this.broadcastTimer) {
      return
    }
    this.broadcastTimer = this.deps.setInterval(() => this.broadcast(), BROADCAST_INTERVAL_MS)
  }

  private broadcast(): void {
    const levels: Record<string, number> = {}
    for (const monitor of this.monitors.values()) {
      for (const slider of monitor.target.sliders) {
        levels[slider] = Math.max(levels[slider] ?? 0, monitor.level)
      }
      monitor.level = Math.max(0, monitor.level - PEAK_DECAY_PER_FRAME)
    }
    const silent = Object.values(levels).every((level) => level === 0)
    if (silent && this.lastEmittedSilent) {
      return
    }
    this.lastEmittedSilent = silent
    this.emit('levels', levels)
  }
}

export const audioMeterService = new AudioMeterService()
