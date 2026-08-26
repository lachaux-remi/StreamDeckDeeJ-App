import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  updaterListeners: new Map<string, (value?: unknown) => void>(),
  updater: {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowDowngrade: true,
    allowPrerelease: true,
    fullChangelog: true,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    setFeedURL: vi.fn()
  },
  fetch: vi.fn(),
  fetchSignedUpdateManifest: vi.fn(),
  requireSignedWindowsSetup: vi.fn(),
  verifyDownloadedUpdateArtifact: vi.fn(),
  installUpdate: vi.fn(async (quit: () => void | Promise<void>) => quit())
}))

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '4.0.6' },
  net: { fetch: fakes.fetch }
}))
vi.mock('electron-updater', () => ({ autoUpdater: fakes.updater }))
vi.mock('@main/services/logger.service', () => ({ loggerService: { info: vi.fn() } }))
vi.mock('@main/services/signed-update', () => ({
  fetchSignedUpdateManifest: fakes.fetchSignedUpdateManifest,
  requireSignedWindowsSetup: fakes.requireSignedWindowsSetup,
  verifyDownloadedUpdateArtifact: fakes.verifyDownloadedUpdateArtifact
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  fakes.updaterListeners.clear()
  fakes.updater.on.mockImplementation((event: string, listener: (value?: unknown) => void) => {
    fakes.updaterListeners.set(event, listener)
  })
  fakes.updater.checkForUpdates.mockResolvedValue(undefined)
  fakes.updater.downloadUpdate.mockResolvedValue(undefined)
  fakes.fetchSignedUpdateManifest.mockResolvedValue({ version: '4.1.0' })
  fakes.requireSignedWindowsSetup.mockReturnValue({
    name: 'streamdeck-deej-4.1.0-windows-x64.exe',
    size: 11,
    sha512: 'signed-sha512'
  })
  fakes.verifyDownloadedUpdateArtifact.mockResolvedValue(undefined)
  Object.defineProperty(process, 'resourcesPath', {
    value: '/installed/resources',
    configurable: true
  })
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
})

test('verifies the signed NSIS setup after download and again immediately before installation', async () => {
  const { windowsUpdateService } = await import('@main/services/windows-update.service')
  windowsUpdateService.init(fakes.installUpdate)

  await windowsUpdateService.check()
  const metadata = {
    version: '4.1.0',
    releaseName: 'Version 4.1.0',
    releaseNotes: 'Windows fixes',
    files: [
      {
        url: 'streamdeck-deej-4.1.0-windows-x64.exe',
        size: 11,
        sha512: 'signed-sha512'
      }
    ]
  }
  fakes.updaterListeners.get('update-available')?.(metadata)
  await vi.waitFor(() => expect(windowsUpdateService.getState().status).toBe('available'))
  expect(fakes.requireSignedWindowsSetup).toHaveBeenCalledWith({ version: '4.1.0' }, metadata)

  await windowsUpdateService.download()
  fakes.updaterListeners.get('update-downloaded')?.({
    ...metadata,
    downloadedFile: '/cache/streamdeck-deej-4.1.0-windows-x64.exe'
  })
  await vi.waitFor(() => expect(windowsUpdateService.getState().status).toBe('downloaded'))
  await windowsUpdateService.install()

  expect(fakes.verifyDownloadedUpdateArtifact).toHaveBeenCalledTimes(3)
  expect(fakes.installUpdate).toHaveBeenCalledOnce()
  expect(fakes.updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  expect(fakes.updater).toMatchObject({
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowDowngrade: false,
    allowPrerelease: false,
    fullChangelog: false
  })
})

test('disables Windows updates outside a packaged installed win32 application', async () => {
  Object.defineProperty(process, 'resourcesPath', {
    value: '/build/win-unpacked/resources',
    configurable: true
  })
  const { windowsUpdateService } = await import('@main/services/windows-update.service')
  windowsUpdateService.init(fakes.installUpdate)

  expect(windowsUpdateService.getState()).toEqual({ mode: 'disabled', status: 'disabled' })
  await windowsUpdateService.check()
  expect(fakes.updater.checkForUpdates).not.toHaveBeenCalled()
})

test('fails closed when the setup changes immediately before quitAndInstall', async () => {
  const { windowsUpdateService } = await import('@main/services/windows-update.service')
  windowsUpdateService.init(fakes.installUpdate)
  await windowsUpdateService.check()
  fakes.updaterListeners.get('update-available')?.({ version: '4.1.0', files: [] })
  await vi.waitFor(() => expect(windowsUpdateService.getState().status).toBe('available'))
  await windowsUpdateService.download()
  fakes.updaterListeners.get('update-downloaded')?.({
    version: '4.1.0',
    downloadedFile: '/cache/streamdeck-deej-4.1.0-windows-x64.exe'
  })
  await vi.waitFor(() => expect(windowsUpdateService.getState().status).toBe('downloaded'))

  fakes.verifyDownloadedUpdateArtifact
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('setup changed'))
  await expect(windowsUpdateService.install()).rejects.toThrow(/setup changed/)
  expect(fakes.updater.quitAndInstall).not.toHaveBeenCalled()
})
