import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { configService } from './config.service'
import { loggerService } from './logger.service'
import { sliderService } from './slider.service'

const SERVICE = 'SessionsService'
const MIN_REFRESH_TIME = 5 * 1000
const MAX_REFRESH_TIME = 45 * 1000
const CUSTOM_SESSIONS = ['master']
const REAPPLY_DELAYS = [100, 500, 1200]
const MPRIS_REFRESH_INTERVAL = 10_000

interface AudioSession {
  sinkInputIndex: number
  name: string
  volume: number
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

  constructor() {
    super()
    loggerService.debug('INIT', SERVICE)

    this.refreshSessions('initial load')
    this.runIsStaleTask()
    this.runIsFreshTask()
    this.startSubscribe()

    sliderService.on('sliders:batch', (sliders: Record<string, number>) => {
      for (const [sliderKey, value] of Object.entries(sliders)) {
        this.updateSessions(sliderKey, value)
      }
    })
  }

  public getAllSessions(): string[] {
    this.refreshSessions('client request')
    return ['master', ...this.sessions.map((s) => s.name.toLowerCase())]
  }

  private refreshSessions(_reason: string): void {
    try {
      const output = execSync('pactl list sink-inputs', { encoding: 'utf-8', timeout: 5000 })
      this.sessions = this.parsePactlOutput(output)
    } catch (error) {
      loggerService.error(`Failed to list audio sessions: ${error}`, SERVICE)
      this.sessions = []
    }

    this.isFresh = true
    this.isStale = false
    this.runIsStaleTask()
    this.runIsFreshTask()
  }

  /**
   * Returns current OS volumes for each configured slider (0–1).
   * Reads master via pactl get-sink-volume, per-app from cached sessions.
   */
  public getOsVolumes(): Record<string, number> {
    const deejConfig = configService.getConfig().deej || {}
    const volumes: Record<string, number> = {}

    this.refreshSessions('os volumes')

    for (const [sliderKey, sessionNames] of Object.entries(deejConfig)) {
      if (!sessionNames || sessionNames.length === 0) continue
      const firstSession = sessionNames[0]
      const vol = this.getSessionVolume(firstSession)
      if (vol !== null) volumes[sliderKey] = vol
    }

    return volumes
  }

  private getSessionVolume(sessionName: string): number | null {
    try {
      if (sessionName === 'master') {
        const output = execSync('pactl get-sink-volume @DEFAULT_SINK@', {
          encoding: 'utf-8',
          timeout: 2000
        })
        const match = output.match(/(\d+)%/)
        return match ? parseInt(match[1]) / 100 : null
      }

      const matching = this.sessions.find(
        (s) => s.name.toLowerCase() === sessionName.toLowerCase()
      )
      return matching ? matching.volume : null
    } catch {
      return null
    }
  }

  private parsePactlOutput(output: string): AudioSession[] {
    const sessions: AudioSession[] = []
    const blocks = output.split('Sink Input #')

    for (const block of blocks) {
      if (!block.trim()) continue

      const indexMatch = block.match(/^(\d+)/)
      const nameMatch = block.match(/application\.name\s*=\s*"([^"]+)"/)
      const volumeMatch = block.match(/Volume:.*?(\d+)%/)

      if (indexMatch && nameMatch) {
        sessions.push({
          sinkInputIndex: parseInt(indexMatch[1], 10),
          name: nameMatch[1],
          volume: volumeMatch ? parseInt(volumeMatch[1]) / 100 : 0
        })
      }
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
          this.refreshSessions('new sink-input')
          this.reapplyVolumes()
          if (delay === REAPPLY_DELAYS[REAPPLY_DELAYS.length - 1]) {
            this.reapplyTimers = []
          }
        }, delay)
      )
    }
  }

  private reapplyVolumes(): void {
    const deejConfig = configService.getConfig().deej || {}
    const sliders = sliderService.getSliders()

    for (const [sliderKey, sessionNames] of Object.entries(deejConfig)) {
      const value = sliders[sliderKey]
      if (value === undefined || !sessionNames) continue
      for (const sessionName of sessionNames) {
        this.setSessionVolume(sessionName, value)
      }
    }
  }

  private refreshMprisPlayers(): void {
    try {
      const output = execSync(
        'dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames',
        { encoding: 'utf-8', timeout: 2000 }
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

  private findMprisBusName(sessionName: string): string | null {
    if (Date.now() - this.mprisLastRefresh > MPRIS_REFRESH_INTERVAL) {
      this.refreshMprisPlayers()
    }

    const target = sessionName.toLowerCase()
    for (const busName of this.mprisPlayers) {
      // org.mpris.MediaPlayer2.spotify → spotify
      // org.mpris.MediaPlayer2.firefox.instance_12345 → firefox
      const playerPart = busName.replace('org.mpris.MediaPlayer2.', '')
      const playerName = playerPart.split('.')[0].toLowerCase()

      if (target.includes(playerName) || playerName.includes(target)) {
        return busName
      }
    }
    return null
  }

  private setMprisVolume(busName: string, value: number): void {
    try {
      execSync(
        `dbus-send --session --print-reply --dest=${busName} /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Set string:org.mpris.MediaPlayer2.Player string:Volume variant:double:${value}`,
        { timeout: 2000, stdio: 'ignore' }
      )
    } catch {
      // MPRIS volume not supported for this player
    }
  }

  private setSessionVolume(sessionName: string, value: number): void {
    const percent = Math.round(value * 100)

    try {
      this.recentlySet = true
      setTimeout(() => (this.recentlySet = false), 150)

      if (sessionName === 'master') {
        execSync(`pactl set-sink-volume @DEFAULT_SINK@ ${percent}%`, { timeout: 2000 })
      } else {
        const matching = this.sessions.filter(
          (s) => s.name.toLowerCase() === sessionName.toLowerCase()
        )
        for (const session of matching) {
          try {
            execSync(`pactl set-sink-input-volume ${session.sinkInputIndex} ${percent}%`, {
              timeout: 2000
            })
          } catch {
            this.refreshSessions('stale sink-input index')
            const fresh = this.sessions.find(
              (s) => s.name.toLowerCase() === sessionName.toLowerCase()
            )
            if (fresh) {
              execSync(`pactl set-sink-input-volume ${fresh.sinkInputIndex} ${percent}%`, {
                timeout: 2000
              })
            }
          }
        }
      }
    } catch (error) {
      loggerService.error(`Failed to set volume for ${sessionName}: ${error}`, SERVICE)
    }

    // Also set MPRIS volume so the app knows about it (prevents reset on track change)
    if (sessionName !== 'master') {
      const mprisBus = this.findMprisBusName(sessionName)
      if (mprisBus) this.setMprisVolume(mprisBus, value)
    }
  }

  private updateSessions(sliderKey: string, value: number): void {
    if (this.isStale) {
      this.refreshSessions('staled out')
    }

    const targetSessions = configService.getConfig().deej?.[sliderKey] || []

    if (
      !targetSessions
        .filter((name) => !CUSTOM_SESSIONS.includes(name))
        .every((name) => this.sessions.some((s) => s.name.toLowerCase() === name.toLowerCase())) &&
      !this.isFresh
    ) {
      this.refreshSessions('target session not found')
    }

    targetSessions.forEach((sessionName) => this.setSessionVolume(sessionName, value))
  }
}

export const sessionsService = new SessionsService()
