import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { loggerService } from './logger.service'

const SERVICE = 'MicService'

class MicService extends EventEmitter {
  private muted = false
  private subscribeProcess: ChildProcess | null = null

  async init(): Promise<void> {
    this.queryMuteState()
    this.startSubscribe()
    loggerService.info('MicService initialisé', SERVICE)
  }

  isMuted(): boolean {
    return this.muted
  }

  private queryMuteState(): void {
    try {
      const out = execFileSync('pactl', ['get-source-mute', '@DEFAULT_SOURCE@'], {
        encoding: 'utf-8',
        timeout: 2000
      })
      const muted = out.includes('Mute: yes')
      if (muted !== this.muted) {
        this.muted = muted
        this.emit('change', muted)
      }
    } catch {
      // pactl unavailable or no default source
    }
  }

  private startSubscribe(): void {
    try {
      this.subscribeProcess = spawn('pactl', ['subscribe'], {
        stdio: ['ignore', 'pipe', 'ignore']
      })

      this.subscribeProcess.stdout?.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split('\n')) {
          if (line.includes("'change'") && line.includes('source')) {
            this.queryMuteState()
          }
        }
      })

      this.subscribeProcess.on('close', () => {
        this.subscribeProcess = null
        setTimeout(() => this.startSubscribe(), 5000)
      })
    } catch {
      loggerService.warn('MicService: pactl subscribe non disponible', SERVICE)
    }
  }
}

export const micService = new MicService()
