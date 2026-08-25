import { app, net, shell } from 'electron'
import { readFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo
} from 'electron-updater'
import { loggerService } from './logger.service'
import {
  LinuxUpdateController,
  detectLinuxUpdateMode,
  type AppImageUpdateAdapter
} from './linux-update-controller'
import {
  configureSecureAppImageUpdater,
  OFFICIAL_GITHUB_RELEASE_API,
  OFFICIAL_GITHUB_RELEASE_PAGE
} from './linux-update-policy'
import {
  fetchSignedUpdateManifest,
  requireSignedAppImage,
  verifyDownloadedUpdateArtifact,
  type SignedUpdateArtifact
} from './signed-update'
import type { LinuxReleaseInfo, LinuxUpdateState } from '@main/types/update.types'

const MAX_RELEASE_NOTES_LENGTH = 20_000

type InstallUpdate = (quitAndInstall: () => void | Promise<void>) => Promise<void>

function packageType(): string | undefined {
  try {
    return readFileSync(join(process.resourcesPath, 'package-type'), 'utf8').trim()
  } catch {
    return undefined
  }
}

function releaseNotes(info: UpdateInfo): string {
  if (typeof info.releaseNotes === 'string') {
    return info.releaseNotes.slice(0, MAX_RELEASE_NOTES_LENGTH)
  }
  if (Array.isArray(info.releaseNotes)) {
    return info.releaseNotes
      .map((note) => `${note.version}\n${note.note ?? ''}`)
      .join('\n\n')
      .slice(0, MAX_RELEASE_NOTES_LENGTH)
  }
  return ''
}

function updateInfo(info: UpdateInfo): LinuxReleaseInfo {
  return {
    version: info.version,
    releaseName: info.releaseName || `Version ${info.version}`,
    releaseNotes: releaseNotes(info)
  }
}

function createAppImageUpdater(installUpdate: InstallUpdate): AppImageUpdateAdapter {
  let reportError = (): void => {}
  let signedArtifact: SignedUpdateArtifact | undefined
  let signedVersion: string | undefined
  let downloadedFile: string | undefined

  return {
    configure(): void {
      configureSecureAppImageUpdater(autoUpdater)
    },
    on(event, listener): void {
      if (event === 'available') {
        autoUpdater.on('update-available', (info) => {
          void (async (): Promise<void> => {
            try {
              const manifest = await fetchSignedUpdateManifest(info.version, (url) =>
                net.fetch(url)
              )
              signedArtifact = requireSignedAppImage(manifest, info)
              signedVersion = manifest.version
              listener(updateInfo(info))
            } catch {
              signedArtifact = undefined
              signedVersion = undefined
              downloadedFile = undefined
              reportError()
            }
          })()
        })
      } else if (event === 'not-available') {
        autoUpdater.on('update-not-available', () => listener())
      } else if (event === 'download-progress') {
        autoUpdater.on('download-progress', (progress: ProgressInfo) => listener(progress))
      } else if (event === 'downloaded') {
        autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
          void (async (): Promise<void> => {
            try {
              if (!signedArtifact || info.version !== signedVersion) {
                throw new Error('Downloaded update has no verified signed manifest')
              }
              await verifyDownloadedUpdateArtifact(info.downloadedFile, signedArtifact)
              downloadedFile = info.downloadedFile
              listener(updateInfo(info))
            } catch {
              downloadedFile = undefined
              reportError()
            }
          })()
        })
      } else {
        reportError = () => listener()
        autoUpdater.on('error', reportError)
      }
    },
    check: () => {
      signedArtifact = undefined
      signedVersion = undefined
      downloadedFile = undefined
      return autoUpdater.checkForUpdates()
    },
    download: () => autoUpdater.downloadUpdate(),
    install: async () => {
      if (!signedArtifact || !downloadedFile) {
        throw new Error('Downloaded update has not passed signature verification')
      }
      const artifact = signedArtifact
      const artifactPath = downloadedFile
      await verifyDownloadedUpdateArtifact(artifactPath, artifact)
      await installUpdate(async () => {
        await verifyDownloadedUpdateArtifact(artifactPath, artifact)
        autoUpdater.quitAndInstall(false, true)
      })
    }
  }
}

function isGitHubRelease(value: unknown): value is {
  tag_name: string
  name: string | null
  body: string | null
} {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const release = value as Record<string, unknown>
  return (
    typeof release.tag_name === 'string' &&
    (typeof release.name === 'string' || release.name === null) &&
    (typeof release.body === 'string' || release.body === null)
  )
}

async function checkOfficialRelease(): Promise<LinuxReleaseInfo> {
  const response = await net.fetch(OFFICIAL_GITHUB_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'streamdeck-deej-updater',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!response.ok) {
    throw new Error(`GitHub release check failed with status ${response.status}`)
  }
  const value: unknown = await response.json()
  if (!isGitHubRelease(value)) {
    throw new TypeError('Invalid GitHub release response')
  }
  const version = value.tag_name.startsWith('v') ? value.tag_name.slice(1) : value.tag_name
  return {
    version,
    releaseName: value.name || `Version ${version}`,
    releaseNotes: (value.body || '').slice(0, MAX_RELEASE_NOTES_LENGTH)
  }
}

class LinuxUpdateService {
  private controller: LinuxUpdateController | undefined

  init(installUpdate: InstallUpdate): void {
    if (this.controller) {
      return
    }
    const mode = detectLinuxUpdateMode({
      packaged: app.isPackaged,
      platform: process.platform,
      appImage: process.env['APPIMAGE'],
      packageType: packageType(),
      unpacked: basename(dirname(process.resourcesPath)) === 'linux-unpacked'
    })
    this.controller = new LinuxUpdateController({
      mode,
      currentVersion: app.getVersion(),
      updater: mode === 'appimage' ? createAppImageUpdater(installUpdate) : undefined,
      releaseChecker: mode === 'package-manager' ? checkOfficialRelease : undefined,
      openOfficialRelease:
        mode === 'package-manager'
          ? () => shell.openExternal(OFFICIAL_GITHUB_RELEASE_PAGE)
          : undefined
    })
    loggerService.info(`Linux updater mode: ${mode}`, 'LinuxUpdate')
  }

  getState(): LinuxUpdateState {
    if (!this.controller) {
      throw new Error('Linux update service is not initialized')
    }
    return this.controller.getState()
  }

  onStateChanged(listener: (state: LinuxUpdateState) => void): () => void {
    if (!this.controller) {
      throw new Error('Linux update service is not initialized')
    }
    return this.controller.onStateChanged(listener)
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

  private requireController(): LinuxUpdateController {
    if (!this.controller) {
      throw new Error('Linux update service is not initialized')
    }
    return this.controller
  }
}

export const linuxUpdateService = new LinuxUpdateService()
