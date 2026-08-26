import { net } from 'electron'
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo
} from 'electron-updater'
import type { UpdateReleaseInfo } from '../types/update.types'
import type { InstallableUpdateAdapter } from './update-controller'
import { configureSecureUpdater } from './update-policy'
import {
  fetchSignedUpdateManifest,
  verifyDownloadedUpdateArtifact,
  type SignedUpdateArtifact,
  type SignedUpdateManifest
} from './signed-update'

const MAX_RELEASE_NOTES_LENGTH = 20_000

export type InstallUpdate = (quitAndInstall: () => void | Promise<void>) => Promise<void>
type SelectSignedArtifact = (
  manifest: SignedUpdateManifest,
  metadata: UpdateInfo
) => SignedUpdateArtifact

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

export function updateReleaseInfo(info: UpdateInfo): UpdateReleaseInfo {
  return {
    version: info.version,
    releaseName: info.releaseName || `Version ${info.version}`,
    releaseNotes: releaseNotes(info)
  }
}

export function createElectronUpdateAdapter(
  installUpdate: InstallUpdate,
  selectSignedArtifact: SelectSignedArtifact
): InstallableUpdateAdapter {
  let reportError = (): void => {}
  let signedArtifact: SignedUpdateArtifact | undefined
  let signedVersion: string | undefined
  let downloadedFile: string | undefined

  return {
    configure(): void {
      configureSecureUpdater(autoUpdater)
    },
    on(event, listener): void {
      if (event === 'available') {
        autoUpdater.on('update-available', (info) => {
          void (async (): Promise<void> => {
            try {
              const manifest = await fetchSignedUpdateManifest(info.version, (url) =>
                net.fetch(url)
              )
              signedArtifact = selectSignedArtifact(manifest, info)
              signedVersion = manifest.version
              listener(updateReleaseInfo(info))
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
              listener(updateReleaseInfo(info))
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
