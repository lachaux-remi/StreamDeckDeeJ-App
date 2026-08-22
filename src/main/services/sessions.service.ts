import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { configService } from './config.service'
import { loggerService } from './logger.service'
import { sliderService } from './slider.service'
import { commandRunner, LatestValueExecutor, runCommandWithFallback } from './audio-command'

const SERVICE = 'SessionsService'
const MIN_REFRESH_TIME = 5 * 1000
const MAX_REFRESH_TIME = 45 * 1000
const CUSTOM_SESSIONS = ['master']
const REAPPLY_DELAYS = [100, 500, 1200]
const MPRIS_REFRESH_INTERVAL = 10_000

interface AudioSession {
  pwNodeId: number
  name: string
  volume: number
}

interface PwDumpObject {
  id: number
  type: string
  info?: {
    props?: Record<string, unknown>
    params?: {
      Props?: Array<{
        channelVolumes?: number[]
        volume?: number
      }>
    }
  }
}

class SessionsService extends EventEmitter {
  private isStale: boolean = false
  private isStaleTask: NodeJS.Timeout | null = null
  private isFresh: boolean = false
  private isFreshTask: NodeJS.Timeout | null = null
  private sessions: AudioSession[] = []
  private mprisPlayers: string[] = []
  private mprisLastRefresh: number = 0
  private subscribeProcess: ChildProcess | null = null
  private reapplyTimers: NodeJS.Timeout[] = []
  private recentlySet: boolean = false
  private activeVolumeSets: number = 0
  private recentlySetTimer: NodeJS.Timeout | null = null
  private refreshPromise: Promise<void> | null = null
  private mprisRefreshPromise: Promise<void> | null = null
  private readonly volumeExecutor = new LatestValueExecutor<string, number>(
    4,
    (sessionName, value) => this.setSessionVolume(sessionName, value)
  )

  constructor() {
    super()
    loggerService.debug('INIT', SERVICE)

    void this.refreshSessions()
    this.runIsStaleTask()
    this.runIsFreshTask()
    this.startSubscribe()

    sliderService.on('sliders:batch', (sliders: Record<string, number>) => {
      for (const [sliderKey, value] of Object.entries(sliders)) {
        void this.updateSessions(sliderKey, value)
      }
    })
  }

  public async getAllSessions(): Promise<string[]> {
    await this.refreshSessions()
    const names = new Set(this.sessions.map((s) => s.name.toLowerCase()))
    return ['master', ...names]
  }

  private refreshSessions(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = this.loadSessions().finally(() => {
      this.refreshPromise = null
    })
    return this.refreshPromise
  }

  private async loadSessions(): Promise<void> {
    try {
      const raw = await commandRunner.run('pw-dump', ['--no-colors'], 5000)
      this.sessions = this.parsePwDump(raw)
    } catch {
      try {
        const output = await commandRunner.run('pactl', ['list', 'sink-inputs'], 5000)
        this.sessions = this.parsePactlOutput(output)
      } catch (error) {
        loggerService.error(`Failed to list audio sessions: ${error}`, SERVICE)
        this.sessions = []
      }
    }

    this.isFresh = true
    this.isStale = false
    this.runIsStaleTask()
    this.runIsFreshTask()
  }

  /**
   * Returns current OS volumes for each configured slider (0–1).
   * Reads master via wpctl, per-app from cached sessions.
   */
  public async getOsVolumes(): Promise<Record<string, number>> {
    const deejConfig = configService.getConfig().deej || {}
    const volumes: Record<string, number> = {}

    await this.refreshSessions()

    for (const [sliderKey, sessionNames] of Object.entries(deejConfig)) {
      if (!sessionNames || sessionNames.length === 0) continue
      const firstSession = sessionNames[0]
      const vol = await this.getSessionVolume(firstSession)
      if (vol !== null) volumes[sliderKey] = vol
    }

    return volumes
  }

  private async getSessionVolume(sessionName: string): Promise<number | null> {
    try {
      if (sessionName === 'master') {
        try {
          const output = await commandRunner.run(
            'wpctl',
            ['get-volume', '@DEFAULT_AUDIO_SINK@'],
            2000
          )
          const match = output.match(/Volume:\s+([\d.]+)/)
          return match ? parseFloat(match[1]) : null
        } catch {
          const output = await commandRunner.run(
            'pactl',
            ['get-sink-volume', '@DEFAULT_SINK@'],
            2000
          )
          const match = output.match(/(\d+)%/)
          return match ? parseInt(match[1]) / 100 : null
        }
      }

      const matching = this.sessions.find((s) => s.name.toLowerCase() === sessionName.toLowerCase())
      return matching ? matching.volume : null
    } catch {
      return null
    }
  }

  /**
   * Fallback parser using pactl (for systems without PipeWire).
   */
  private parsePactlOutput(output: string): AudioSession[] {
    const sessions: AudioSession[] = []
    const blocks = output.split('Sink Input #')

    for (const block of blocks) {
      if (!block.trim()) continue

      const indexMatch = block.match(/^(\d+)/)
      const nameMatch = block.match(/application\.name\s*=\s*"([^"]+)"/)
      const binaryMatch = block.match(/application\.process\.binary\s*=\s*"([^"]+)"/)
      const volumeMatch = block.match(/Volume:.*?(\d+)%/)

      const name = nameMatch?.[1] ?? binaryMatch?.[1]

      if (indexMatch && name) {
        sessions.push({
          pwNodeId: parseInt(indexMatch[1], 10),
          name,
          volume: volumeMatch ? parseInt(volumeMatch[1]) / 100 : 0
        })
      }
    }

    return sessions
  }

  /**
   * Uses pw-dump (PipeWire JSON) to discover audio streams.
   * Resolves application names through the client.id → client object lookup,
   * which is required for PipeWire-native apps (e.g. Spotify) whose stream
   * node does NOT carry application.name itself.
   */
  private parsePwDump(raw: string): AudioSession[] {
    const objects: PwDumpObject[] = JSON.parse(raw)

    const clientMap = new Map<number, Record<string, unknown>>()
    for (const obj of objects) {
      if (obj.type === 'PipeWire:Interface:Client' && obj.info?.props) {
        clientMap.set(obj.id, obj.info.props)
      }
    }

    const sessions: AudioSession[] = []

    for (const obj of objects) {
      const props = obj.info?.props
      if (!props) continue
      if (obj.type !== 'PipeWire:Interface:Node') continue
      if (props['media.class'] !== 'Stream/Output/Audio') continue

      let name = props['application.name'] as string | undefined

      if (!name) {
        const clientId = props['client.id'] as number | undefined
        if (clientId !== undefined) {
          const clientProps = clientMap.get(clientId)
          if (clientProps) {
            name =
              (clientProps['application.name'] as string) ??
              (clientProps['application.process.binary'] as string)
          }
        }
      }

      if (!name) {
        name = (props['application.process.binary'] as string) ?? (props['node.name'] as string)
      }

      if (!name) continue

      const paramsProps = obj.info?.params?.Props
      let volume = 0
      if (paramsProps && paramsProps.length > 0) {
        const p = paramsProps[0]
        if (p.channelVolumes && p.channelVolumes.length > 0) {
          volume = Math.max(...p.channelVolumes)
        } else if (p.volume !== undefined) {
          volume = p.volume
        }
      }

      sessions.push({
        pwNodeId: obj.id,
        name,
        volume
      })
    }

    return sessions
  }

  private runIsStaleTask(): void {
    if (this.isStale) return
    if (this.isStaleTask) clearTimeout(this.isStaleTask)
    this.isStaleTask = setTimeout(() => (this.isStale = true), MAX_REFRESH_TIME)
  }

  private runIsFreshTask(): void {
    if (!this.isFresh) return
    if (this.isFreshTask) clearTimeout(this.isFreshTask)
    this.isFreshTask = setTimeout(() => (this.isFresh = false), MIN_REFRESH_TIME)
  }

  private startSubscribe(): void {
    try {
      this.subscribeProcess = spawn('pactl', ['subscribe'], { stdio: ['ignore', 'pipe', 'ignore'] })

      this.subscribeProcess.stdout?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n')
        for (const line of lines) {
          if (!line.includes('sink-input')) continue
          if (line.includes("'new'") || (line.includes("'change'") && !this.recentlySet)) {
            this.scheduleReapply()
          }
        }
      })

      this.subscribeProcess.on('close', () => {
        this.subscribeProcess = null
        setTimeout(() => this.startSubscribe(), 5000)
      })
    } catch (error) {
      loggerService.error(`Failed to start pactl subscribe: ${error}`, SERVICE)
    }
  }

  private scheduleReapply(): void {
    if (this.reapplyTimers.length > 0) return
    for (const delay of REAPPLY_DELAYS) {
      this.reapplyTimers.push(
        setTimeout(() => {
          void this.refreshSessions()
            .then(() => this.reapplyVolumes())
            .then(() => {
              if (delay === REAPPLY_DELAYS[REAPPLY_DELAYS.length - 1]) {
                this.reapplyTimers = []
              }
            })
        }, delay)
      )
    }
  }

  private reapplyVolumes(): Promise<void> {
    const deejConfig = configService.getConfig().deej || {}
    const sliders = sliderService.getSliders()

    for (const [sliderKey, sessionNames] of Object.entries(deejConfig)) {
      const value = sliders[sliderKey]
      if (value === undefined || !sessionNames) continue
      for (const sessionName of sessionNames) {
        this.volumeExecutor.submit(sessionName.toLowerCase(), value)
      }
    }

    return this.volumeExecutor.onIdle()
  }

  private refreshMprisPlayers(): Promise<void> {
    if (this.mprisRefreshPromise) return this.mprisRefreshPromise

    this.mprisRefreshPromise = this.loadMprisPlayers().finally(() => {
      this.mprisRefreshPromise = null
    })
    return this.mprisRefreshPromise
  }

  private async loadMprisPlayers(): Promise<void> {
    try {
      const output = await commandRunner.run(
        'dbus-send',
        [
          '--session',
          '--dest=org.freedesktop.DBus',
          '--type=method_call',
          '--print-reply',
          '/org/freedesktop/DBus',
          'org.freedesktop.DBus.ListNames'
        ],
        2000
      )
      this.mprisPlayers = []
      for (const line of output.split('\n')) {
        const match = line.match(/"(org\.mpris\.MediaPlayer2\..+)"/)
        if (match) this.mprisPlayers.push(match[1])
      }
      this.mprisLastRefresh = Date.now()
    } catch (error) {
      loggerService.error(`Failed to list MPRIS players: ${error}`, SERVICE)
      this.mprisPlayers = []
    }
  }

  private async findMprisBusName(sessionName: string): Promise<string | null> {
    if (Date.now() - this.mprisLastRefresh > MPRIS_REFRESH_INTERVAL) {
      await this.refreshMprisPlayers()
    }

    const target = sessionName.toLowerCase()
    for (const busName of this.mprisPlayers) {
      const playerPart = busName.replace('org.mpris.MediaPlayer2.', '')
      const playerName = playerPart.split('.')[0].toLowerCase()

      if (target.includes(playerName) || playerName.includes(target)) {
        return busName
      }
    }
    return null
  }

  private async setMprisVolume(busName: string, value: number): Promise<void> {
    try {
      await commandRunner.run(
        'dbus-send',
        [
          '--session',
          '--print-reply',
          `--dest=${busName}`,
          '/org/mpris/MediaPlayer2',
          'org.freedesktop.DBus.Properties.Set',
          'string:org.mpris.MediaPlayer2.Player',
          'string:Volume',
          `variant:double:${value}`
        ],
        2000
      )
    } catch {
      // MPRIS volume not supported for this player
    }
  }

  private async setSessionVolume(sessionName: string, value: number): Promise<void> {
    const percent = Math.round(value * 100)

    this.activeVolumeSets += 1
    if (this.recentlySetTimer) {
      clearTimeout(this.recentlySetTimer)
      this.recentlySetTimer = null
    }
    this.recentlySet = true

    try {
      if (sessionName === 'master') {
        await runCommandWithFallback(
          commandRunner,
          {
            file: 'wpctl',
            args: ['set-volume', '@DEFAULT_AUDIO_SINK@', `${percent}%`],
            timeout: 2000
          },
          {
            file: 'pactl',
            args: ['set-sink-volume', '@DEFAULT_SINK@', `${percent}%`],
            timeout: 2000
          }
        )
      } else {
        const matching = this.sessions.filter(
          (s) => s.name.toLowerCase() === sessionName.toLowerCase()
        )
        if (matching.length > 0) {
          for (const session of matching) {
            try {
              await commandRunner.run(
                'wpctl',
                ['set-volume', String(session.pwNodeId), `${percent}%`],
                2000
              )
            } catch {
              await this.refreshSessions()
              const fresh = this.sessions.find(
                (s) => s.name.toLowerCase() === sessionName.toLowerCase()
              )
              if (fresh) {
                await commandRunner.run(
                  'wpctl',
                  ['set-volume', String(fresh.pwNodeId), `${percent}%`],
                  2000
                )
              }
            }
          }
        } else {
          // No PipeWire session found — fall back to MPRIS (e.g. native players bypassing PipeWire)
          const mprisBus = await this.findMprisBusName(sessionName)
          if (mprisBus) await this.setMprisVolume(mprisBus, value)
        }
      }
    } catch (error) {
      loggerService.error(`Failed to set volume for ${sessionName}: ${error}`, SERVICE)
    } finally {
      this.activeVolumeSets -= 1
      if (this.activeVolumeSets === 0) {
        this.recentlySetTimer = setTimeout(() => {
          this.recentlySet = false
          this.recentlySetTimer = null
        }, 150)
      }
    }
  }

  private async updateSessions(sliderKey: string, value: number): Promise<void> {
    if (this.isStale) {
      await this.refreshSessions()
    }

    const targetSessions = configService.getConfig().deej?.[sliderKey] || []

    if (
      !targetSessions
        .filter((name) => !CUSTOM_SESSIONS.includes(name))
        .every((name) => this.sessions.some((s) => s.name.toLowerCase() === name.toLowerCase())) &&
      !this.isFresh
    ) {
      await this.refreshSessions()
    }

    targetSessions.forEach((sessionName) =>
      this.volumeExecutor.submit(sessionName.toLowerCase(), value)
    )
  }
}

export const sessionsService = new SessionsService()
