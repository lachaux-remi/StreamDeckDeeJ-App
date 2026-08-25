import { EventEmitter } from 'node:events'
import { commandRunner, LatestValueExecutor } from './audio-command'
import { PactlSubscription } from './audio-subscription'
import { loggerService } from './logger.service'

const SERVICE = 'MicService'

class MicService extends EventEmitter {
  private muted = false
  private readonly queryExecutor = new LatestValueExecutor<string, true>(1, () =>
    this.queryMuteState()
  )
  private readonly subscription = new PactlSubscription({
    onData: (chunk) => this.handleSubscriptionData(chunk),
    onUnavailable: (error) =>
      loggerService.warn(`pactl subscribe unavailable: ${String(error)}`, SERVICE)
  })

  async init(): Promise<void> {
    this.queryExecutor.submit('default-source', true)
    await this.queryExecutor.onIdle()
    this.subscription.start()
    loggerService.info('MicService initialisé', SERVICE)
  }

  isMuted(): boolean {
    return this.muted
  }

  shutdown(): void {
    this.subscription.stop()
  }

  private async queryMuteState(): Promise<void> {
    try {
      const out = await commandRunner.run('pactl', ['get-source-mute', '@DEFAULT_SOURCE@'], 2000)
      const muted = out.includes('Mute: yes')
      if (muted !== this.muted) {
        this.muted = muted
        this.emit('change', muted)
      }
    } catch {
      // pactl unavailable or no default source
    }
  }

  private handleSubscriptionData(chunk: Buffer): void {
    for (const line of chunk.toString().split('\n')) {
      if (line.includes("'change'") && line.includes('source')) {
        this.queryExecutor.submit('default-source', true)
      }
    }
  }
}

export const micService = new MicService()
