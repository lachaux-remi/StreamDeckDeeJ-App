import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  updaterListeners: new Map<string, (value?: unknown) => void>(),
  updaterOn: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
  setFeedURL: vi.fn(),
  fetch: vi.fn(),
  openExternal: vi.fn(),
  readFileSync: vi.fn(),
  installUpdate: vi.fn(async (quit: () => void) => quit())
}))

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '4.0.6' },
  net: { fetch: fakes.fetch },
  shell: { openExternal: fakes.openExternal }
}))
vi.mock('fs', () => ({ readFileSync: fakes.readFileSync }))
vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: fakes.updaterOn,
    checkForUpdates: fakes.checkForUpdates,
    downloadUpdate: fakes.downloadUpdate,
    quitAndInstall: fakes.quitAndInstall,
    setFeedURL: fakes.setFeedURL
  }
}))
vi.mock('@main/services/logger.service', () => ({
  loggerService: { info: vi.fn() }
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  fakes.updaterListeners.clear()
  fakes.updaterOn.mockImplementation((event: string, listener: (value?: unknown) => void) => {
    fakes.updaterListeners.set(event, listener)
  })
  fakes.checkForUpdates.mockResolvedValue(undefined)
  fakes.downloadUpdate.mockResolvedValue(undefined)
  fakes.openExternal.mockResolvedValue(undefined)
  Object.defineProperty(process, 'resourcesPath', {
    value: '/opt/streamdeck-deej/resources',
    configurable: true
  })
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
})

test('adapts AppImage updater events, bounds release notes, and delegates installation shutdown', async () => {
  process.env['APPIMAGE'] = '/opt/StreamDeckDeeJ.AppImage'
  fakes.readFileSync.mockImplementation(() => {
    throw new Error('no package marker')
  })
  const { linuxUpdateService } = await import('@main/services/linux-update.service')
  linuxUpdateService.init(fakes.installUpdate)
  linuxUpdateService.init(fakes.installUpdate)

  await linuxUpdateService.check()
  fakes.updaterListeners.get('update-available')?.({
    version: '4.1.0',
    releaseName: '',
    releaseNotes: [{ version: '4.1.0', note: 'Security fixes' }, { version: '4.0.9' }]
  })
  expect(linuxUpdateService.getState()).toEqual(
    expect.objectContaining({
      mode: 'appimage',
      status: 'available',
      version: '4.1.0',
      releaseName: 'Version 4.1.0',
      releaseNotes: '4.1.0\nSecurity fixes\n\n4.0.9\n'
    })
  )
  fakes.updaterListeners.get('update-available')?.({
    version: '4.1.0',
    releaseName: '',
    releaseNotes: 'x'.repeat(20_001)
  })
  expect(linuxUpdateService.getState()).toEqual(
    expect.objectContaining({ releaseNotes: 'x'.repeat(20_000) })
  )
  expect(fakes.checkForUpdates).toHaveBeenCalledOnce()

  await linuxUpdateService.download()
  fakes.updaterListeners.get('update-downloaded')?.({ version: '4.1.0', releaseNotes: null })
  await linuxUpdateService.install()
  expect(fakes.installUpdate).toHaveBeenCalledOnce()
  expect(fakes.quitAndInstall).toHaveBeenCalledWith(false, true)
})

test('validates official release responses and opens only the fixed release page', async () => {
  delete process.env['APPIMAGE']
  fakes.readFileSync.mockReturnValue('pacman\n')
  fakes.fetch.mockResolvedValue(
    new Response(JSON.stringify({ tag_name: 'v4.2.0', name: null, body: 'Release notes' }), {
      status: 200
    })
  )
  const { linuxUpdateService } = await import('@main/services/linux-update.service')
  linuxUpdateService.init(fakes.installUpdate)

  await linuxUpdateService.check()
  expect(linuxUpdateService.getState()).toEqual(
    expect.objectContaining({
      mode: 'package-manager',
      status: 'available',
      version: '4.2.0',
      releaseName: 'Version 4.2.0',
      releaseNotes: 'Release notes'
    })
  )
  expect(fakes.fetch).toHaveBeenCalledWith(
    'https://api.github.com/repos/lachaux-remi/StreamDeckDeeJ-App/releases/latest',
    expect.objectContaining({
      headers: expect.objectContaining({ Accept: 'application/vnd.github+json' })
    })
  )
  await linuxUpdateService.openRelease()
  expect(fakes.openExternal).toHaveBeenCalledWith(
    'https://github.com/lachaux-remi/StreamDeckDeeJ-App/releases/latest'
  )
})

test('fails safely before initialization and on malformed release metadata', async () => {
  delete process.env['APPIMAGE']
  fakes.readFileSync.mockReturnValue('pacman')
  fakes.fetch.mockResolvedValue(new Response(JSON.stringify({ tag_name: 42 }), { status: 200 }))
  const { linuxUpdateService } = await import('@main/services/linux-update.service')

  expect(() => linuxUpdateService.getState()).toThrow('not initialized')
  expect(() => linuxUpdateService.onStateChanged(vi.fn())).toThrow('not initialized')
  await expect(linuxUpdateService.check()).rejects.toThrow('not initialized')
  linuxUpdateService.init(fakes.installUpdate)
  const listener = vi.fn()
  const unsubscribe = linuxUpdateService.onStateChanged(listener)
  await linuxUpdateService.check()
  unsubscribe()
  expect(listener).toHaveBeenCalled()
  expect(linuxUpdateService.getState()).toEqual(
    expect.objectContaining({ mode: 'package-manager', status: 'error' })
  )
})
