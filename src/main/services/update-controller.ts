import { gt, valid } from 'semver'
import { isAbsolute } from 'path'
import type { UpdateMode, UpdateReleaseInfo, UpdateState } from '../types/update.types'

type UpdaterEvent = 'available' | 'not-available' | 'download-progress' | 'downloaded' | 'error'

export interface InstallableUpdateAdapter {
  configure(): void
  on(event: UpdaterEvent, listener: (value?: unknown) => void): void
  check(): Promise<unknown>
  download(): Promise<unknown>
  install(): Promise<void>
}

interface UpdateControllerOptions {
  mode: UpdateMode
  currentVersion: string
  updater?: InstallableUpdateAdapter
  releaseChecker?: () => Promise<UpdateReleaseInfo | null>
  openOfficialRelease?: () => Promise<void>
}

interface ModeDetectionOptions {
  packaged: boolean
  platform: NodeJS.Platform
  appImage?: string
  packageType?: string
  unpacked?: boolean
}

export function detectLinuxUpdateMode(options: ModeDetectionOptions): UpdateMode {
  if (!options.packaged || options.platform !== 'linux' || options.unpacked) {
    return 'disabled'
  }
  if (options.appImage && isAbsolute(options.appImage)) {
    return 'appimage'
  }
  return options.packageType === 'pacman' ? 'package-manager' : 'disabled'
}

function isReleaseInfo(value: unknown): value is UpdateReleaseInfo {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.version === 'string' &&
    typeof candidate.releaseName === 'string' &&
    typeof candidate.releaseNotes === 'string'
  )
}

export class UpdateController {
  private state: UpdateState
  private readonly listeners = new Set<(state: UpdateState) => void>()
  private readonly options: UpdateControllerOptions

  constructor(options: UpdateControllerOptions) {
    this.options = options
    this.state =
      options.mode === 'disabled'
        ? { mode: 'disabled', status: 'disabled' }
        : { mode: options.mode, status: 'idle', currentVersion: options.currentVersion }

    if (options.mode === 'appimage' || options.mode === 'nsis') {
      if (!options.updater) {
        throw new Error('Installable updater adapter is required')
      }
      options.updater.configure()
      options.updater.on('available', (value) => this.onAvailable(value))
      options.updater.on('not-available', () => this.setUpToDate())
      options.updater.on('download-progress', (value) => this.onProgress(value))
      options.updater.on('downloaded', (value) => this.onDownloaded(value))
      options.updater.on('error', () => this.setError('La vérification de mise à jour a échoué.'))
    }
  }

  getState(): UpdateState {
    return { ...this.state }
  }

  onStateChanged(listener: (state: UpdateState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async check(): Promise<void> {
    if (this.options.mode === 'disabled') {
      return
    }
    if (this.state.status === 'checking') {
      return
    }
    if (!['idle', 'up-to-date', 'error'].includes(this.state.status)) {
      throw new Error('Update check is not allowed in the current state')
    }
    this.setState({
      mode: this.options.mode,
      status: 'checking',
      currentVersion: this.options.currentVersion
    })
    try {
      if (this.options.mode === 'appimage' || this.options.mode === 'nsis') {
        await this.options.updater?.check()
        return
      }
      const release = await this.options.releaseChecker?.()
      if (release && this.isUpgrade(release.version)) {
        this.setAvailable(release)
      } else {
        this.setUpToDate()
      }
    } catch {
      this.setError('La vérification de mise à jour a échoué.')
    }
  }

  async download(): Promise<void> {
    if (this.options.mode !== 'appimage' && this.options.mode !== 'nsis') {
      throw new Error('Downloads are only available for installable updates')
    }
    if (this.state.status !== 'available') {
      throw new Error('Update is not available')
    }
    this.setState({ ...this.state, status: 'downloading', progress: 0 })
    try {
      await this.options.updater?.download()
    } catch {
      this.setError('Le téléchargement de la mise à jour a échoué.')
    }
  }

  async install(): Promise<void> {
    if (this.options.mode !== 'appimage' && this.options.mode !== 'nsis') {
      throw new Error('Installation is only available for installable updates')
    }
    if (this.state.status !== 'downloaded') {
      throw new Error('Update is not downloaded')
    }
    await this.options.updater?.install()
  }

  async openRelease(): Promise<void> {
    if (this.options.mode !== 'package-manager' || this.state.status !== 'available') {
      throw new Error('Official release is not available')
    }
    await this.options.openOfficialRelease?.()
  }

  private onAvailable(value: unknown): void {
    if (!isReleaseInfo(value) || !this.isUpgrade(value.version)) {
      this.setError('Les métadonnées de mise à jour sont invalides ou proposent un downgrade.')
      return
    }
    this.setAvailable(value)
  }

  private onProgress(value: unknown): void {
    if (this.state.status !== 'downloading') {
      return
    }
    const percent =
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { percent?: unknown }).percent === 'number'
        ? Math.max(0, Math.min(100, (value as { percent: number }).percent))
        : this.state.progress
    this.setState({ ...this.state, progress: percent })
  }

  private onDownloaded(value: unknown): void {
    if (
      this.state.status !== 'downloading' ||
      !isReleaseInfo(value) ||
      value.version !== this.state.version
    ) {
      return
    }
    this.setState({ ...this.state, status: 'downloaded', progress: 100 })
  }

  private setAvailable(release: UpdateReleaseInfo): void {
    if (this.options.mode === 'disabled') {
      return
    }
    this.setState({
      mode: this.options.mode,
      status: 'available',
      currentVersion: this.options.currentVersion,
      ...release
    })
  }

  private setUpToDate(): void {
    if (this.options.mode === 'disabled') {
      return
    }
    this.setState({
      mode: this.options.mode,
      status: 'up-to-date',
      currentVersion: this.options.currentVersion
    })
  }

  private setError(message: string): void {
    if (this.options.mode === 'disabled') {
      return
    }
    this.setState({
      mode: this.options.mode,
      status: 'error',
      currentVersion: this.options.currentVersion,
      message
    })
  }

  private isUpgrade(version: string): boolean {
    return (
      valid(version) !== null &&
      valid(this.options.currentVersion) !== null &&
      gt(version, this.options.currentVersion)
    )
  }

  private setState(state: UpdateState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener(this.getState())
    }
  }
}
