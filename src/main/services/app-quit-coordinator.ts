interface BeforeQuitEvent {
  preventDefault(): void
}

interface AppQuitCoordinatorOptions {
  shutdown(): Promise<void>
  exit(): void
  shutdownTimeoutMs?: number
  onShutdownTimeout?(): void
}

export class AppQuitCoordinator {
  private shutdownPromise: Promise<void> | undefined
  private ordinaryQuitStarted = false
  private updateInstallPreparing = false
  private updateQuitAllowed = false

  constructor(private readonly options: AppQuitCoordinatorOptions) {}

  async installUpdate(quitAndInstall: () => void | Promise<void>): Promise<void> {
    if (this.ordinaryQuitStarted) {
      throw new Error('Application quit is already in progress')
    }
    this.updateInstallPreparing = true
    try {
      await this.shutdownOnce()
    } catch (error) {
      this.updateInstallPreparing = false
      throw error
    }
    this.updateQuitAllowed = true
    this.updateInstallPreparing = false
    try {
      await quitAndInstall()
    } catch (error) {
      this.updateQuitAllowed = false
      throw error
    }
  }

  handleBeforeQuit(event: BeforeQuitEvent): void {
    if (this.updateQuitAllowed) {
      return
    }
    event.preventDefault()
    if (this.updateInstallPreparing) {
      return
    }
    if (this.ordinaryQuitStarted) {
      return
    }
    this.ordinaryQuitStarted = true
    void this.shutdownOnce()
      .catch(() => {})
      .finally(() => this.options.exit())
  }

  private shutdownOnce(): Promise<void> {
    this.shutdownPromise ??= this.shutdownWithDeadline()
    return this.shutdownPromise
  }

  private shutdownWithDeadline(): Promise<void> {
    const shutdown = this.options.shutdown()
    const timeoutMs = this.options.shutdownTimeoutMs
    if (timeoutMs === undefined) {
      return shutdown
    }

    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        try {
          this.options.onShutdownTimeout?.()
        } finally {
          resolve()
        }
      }, timeoutMs)
    })
    return Promise.race([shutdown, deadline]).finally(() => clearTimeout(timer))
  }
}
