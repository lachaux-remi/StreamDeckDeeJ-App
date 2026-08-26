import { app } from 'electron'
import { basename, dirname } from 'node:path'
import { loggerService } from './logger.service'
import { createElectronUpdateAdapter, type InstallUpdate } from './electron-update-adapter'
import { requireSignedWindowsSetup } from './signed-update'
import { UpdateController } from './update-controller'
import type { UpdateState } from '../types/update.types'

class WindowsUpdateService {
  private controller: UpdateController | undefined

  init(installUpdate: InstallUpdate): void {
    if (this.controller) {
      return
    }
    const installed =
      app.isPackaged &&
      process.platform === 'win32' &&
      basename(dirname(process.resourcesPath)) !== 'win-unpacked'
    const mode = installed ? 'nsis' : 'disabled'
    this.controller = new UpdateController({
      mode,
      currentVersion: app.getVersion(),
      updater:
        mode === 'nsis'
          ? createElectronUpdateAdapter(installUpdate, requireSignedWindowsSetup)
          : undefined
    })
    loggerService.info(`Windows updater mode: ${mode}`, 'WindowsUpdate')
  }

  getState(): UpdateState {
    return this.requireController().getState()
  }

  onStateChanged(listener: (state: UpdateState) => void): () => void {
    return this.requireController().onStateChanged(listener)
  }

  async check(): Promise<void> {
    await this.requireController().check()
  }

  async download(): Promise<void> {
    await this.requireController().download()
  }

  async install(): Promise<void> {
    await this.requireController().install()
  }

  async openRelease(): Promise<void> {
    await this.requireController().openRelease()
  }

  private requireController(): UpdateController {
    if (!this.controller) {
      throw new Error('Windows update service is not initialized')
    }
    return this.controller
  }
}

export const windowsUpdateService = new WindowsUpdateService()
