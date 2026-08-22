interface BeforeQuitEvent {
  preventDefault(): void
}

interface AppQuitCoordinatorOptions {
  shutdown(): Promise<void>
  exit(): void
}

export class AppQuitCoordinator {
  private shutdownPromise: Promise<void> | undefined
  private ordinaryQuitStarted = false
  private updateInstallPreparing = false
  private updateQuitAllowed = false

  constructor(private readonly options: AppQuitCoordinatorOptions) {}

  async installUpdate(quitAndInstall: () => void): Promise<void> {
    if (this.ordinaryQuitStarted) throw new Error('Application quit is already in progress')
    this.updateInstallPreparing = true
    try {
      await this.shutdownOnce()
    } catch (error) {
      this.updateInstallPreparing = false
      throw error
    }
    this.updateQuitAllowed = true
    this.updateInstallPreparing = false
    quitAndInstall()
  }

  handleBeforeQuit(event: BeforeQuitEvent): void {
    if (this.updateQuitAllowed) return
    event.preventDefault()
    if (this.updateInstallPreparing) return
    if (this.ordinaryQuitStarted) return
    this.ordinaryQuitStarted = true
    void this.shutdownOnce()
      .catch(() => {})
      .finally(() => this.options.exit())
  }

  private shutdownOnce(): Promise<void> {
    this.shutdownPromise ??= this.options.shutdown()
    return this.shutdownPromise
  }
}
