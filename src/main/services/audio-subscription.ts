import { spawn, type ChildProcess } from 'node:child_process'

const RETRY_DELAY_MS = 5_000

interface PactlSubscriptionOptions {
  onData: (chunk: Buffer) => void
  onUnavailable: (error: unknown) => void
}

export class PactlSubscription {
  private process: ChildProcess | null = null
  private retryTimer: NodeJS.Timeout | null = null
  private unavailableReported = false
  private stopped = false

  constructor(private readonly options: PactlSubscriptionOptions) {}

  start(): void {
    if (this.stopped || this.process || this.retryTimer) {
      return
    }

    try {
      const process = spawn('pactl', ['subscribe'], { stdio: ['ignore', 'pipe', 'ignore'] })
      this.process = process
      let handled = false

      process.stdout?.on('data', (chunk: Buffer) => {
        this.unavailableReported = false
        this.options.onData(chunk)
      })

      const handleStop = (error?: Error): void => {
        if (handled) {
          return
        }
        handled = true
        this.process = null
        if (this.stopped) {
          return
        }
        if (!this.unavailableReported) {
          this.unavailableReported = true
          this.options.onUnavailable(error ?? new Error('pactl subscribe closed'))
        }
        this.scheduleRetry()
      }

      process.on('error', handleStop)
      process.on('close', () => handleStop())
    } catch (error) {
      if (!this.unavailableReported) {
        this.unavailableReported = true
        this.options.onUnavailable(error)
      }
      this.scheduleRetry()
    }
  }

  private scheduleRetry(): void {
    if (this.stopped) {
      return
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.start()
    }, RETRY_DELAY_MS)
  }

  stop(): void {
    this.stopped = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    const process = this.process
    this.process = null
    process?.kill()
  }
}
