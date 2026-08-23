import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  invokes: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  events: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  listPorts: vi.fn(),
  getStatus: vi.fn(),
  getSliders: vi.fn(),
  getOsVolumes: vi.fn(),
  getAllSessions: vi.fn(),
  getRendererConfig: vi.fn(),
  updateFromRenderer: vi.fn(),
  getLogs: vi.fn(),
  toggleDevTools: vi.fn(),
  micMuted: vi.fn(),
  discordMuted: vi.fn(),
  discordDeafened: vi.fn(),
  discordStreaming: vi.fn(),
  discordConnected: vi.fn(),
  diagnose: vi.fn(),
  installPermissions: vi.fn(),
  getUpdateState: vi.fn(),
  executeUpdate: vi.fn(),
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  parentWindow: undefined as unknown,
  transferDialogs: undefined as
    | {
        chooseExportPath: () => Promise<string | null>
        chooseImportPath: () => Promise<string | null>
      }
    | undefined,
  exportConfiguration: vi.fn(),
  importConfiguration: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '4.0.6', getPath: () => '/tmp' },
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) =>
      fakes.invokes.set(channel, listener),
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) =>
      fakes.events.set(channel, listener)
  },
  BrowserWindow: { fromWebContents: () => fakes.parentWindow },
  dialog: { showSaveDialog: fakes.showSaveDialog, showOpenDialog: fakes.showOpenDialog }
}))
vi.mock('@main/services/serial.service', () => ({
  serialService: { listPorts: fakes.listPorts, getStatus: fakes.getStatus }
}))
vi.mock('@main/services/deck.service', () => ({ deckService: { getKeyInfo: vi.fn() } }))
vi.mock('@main/services/led.service', () => ({
  ledService: { updateOverrides: vi.fn(), updateProfile: vi.fn(), flush: vi.fn() }
}))
vi.mock('@main/services/slider.service', () => ({
  sliderService: { getSliders: fakes.getSliders }
}))
vi.mock('@main/services/sessions.service', () => ({
  sessionsService: { getOsVolumes: fakes.getOsVolumes, getAllSessions: fakes.getAllSessions }
}))
vi.mock('@main/services/config.service', () => ({
  configService: {
    getRendererConfig: fakes.getRendererConfig,
    updateFromRenderer: fakes.updateFromRenderer
  }
}))
vi.mock('@main/services/config-transfer', () => ({
  ConfigTransferService: class {},
  ConfigTransferController: class {
    constructor(
      _service: unknown,
      dialogs: {
        chooseExportPath: () => Promise<string | null>
        chooseImportPath: () => Promise<string | null>
      }
    ) {
      fakes.transferDialogs = dialogs
    }
    exportConfiguration = fakes.exportConfiguration
    importConfiguration = fakes.importConfiguration
  }
}))
vi.mock('@main/services/logger.service', () => ({
  loggerService: { getLogs: fakes.getLogs }
}))
vi.mock('@main/services/mic.service', () => ({ micService: { isMuted: fakes.micMuted } }))
vi.mock('@main/services/discord.service', () => ({
  discordService: {
    isMuted: fakes.discordMuted,
    isDeafened: fakes.discordDeafened,
    isStreaming: fakes.discordStreaming,
    isConnected: fakes.discordConnected
  }
}))
vi.mock('@main/services/hardware-permissions.service', () => ({
  hardwarePermissionsService: { diagnose: fakes.diagnose, install: fakes.installPermissions }
}))
vi.mock('@main/services/linux-update.service', () => ({
  linuxUpdateService: {
    getState: fakes.getUpdateState,
    check: vi.fn(),
    download: vi.fn(),
    install: vi.fn(),
    openRelease: vi.fn()
  }
}))
vi.mock('@main/services/update-command', () => ({
  createSerialCommandExecutor: () => async (command: () => Promise<void>) => command(),
  executeLinuxUpdateCommand: fakes.executeUpdate
}))

const trustedSender = { mainFrame: {}, toggleDevTools: fakes.toggleDevTools }
const trustedEvent = { sender: trustedSender, senderFrame: trustedSender.mainFrame }

function invoke(channel: string, ...args: unknown[]): unknown {
  const listener = fakes.invokes.get(channel)
  if (!listener) throw new Error(`Missing handler ${channel}`)
  return listener(trustedEvent, ...args)
}

beforeEach(() => {
  fakes.invokes.clear()
  fakes.events.clear()
  vi.clearAllMocks()
  fakes.parentWindow = undefined
  fakes.transferDialogs = undefined
})

test('wires serial and deej success, fallback, and asynchronous failure paths', async () => {
  const { registerSerialHandlers } = await import('@main/handlers/serial.handlers')
  const { registerDeejHandlers } = await import('@main/handlers/deej.handlers')
  registerSerialHandlers(trustedSender as never)
  registerDeejHandlers(trustedSender as never)
  fakes.listPorts.mockResolvedValue([{ path: '/dev/ttyACM0', official: true }])
  fakes.getStatus.mockReturnValue({ connected: true, port: '/dev/ttyACM0' })
  fakes.getSliders.mockReturnValue({})
  fakes.getOsVolumes.mockResolvedValue({ '0': 0.6 })
  fakes.getAllSessions.mockRejectedValue(new Error('audio unavailable'))

  await expect(invoke('serial:list')).resolves.toEqual([{ path: '/dev/ttyACM0', official: true }])
  expect(invoke('serial:status')).toEqual({ connected: true, port: '/dev/ttyACM0' })
  await expect(invoke('deej:sliders')).resolves.toEqual({ '0': 0.6 })
  await expect(invoke('deej:sessions')).rejects.toThrow('audio unavailable')

  fakes.getSliders.mockReturnValue({ '0': 0.2 })
  expect(invoke('deej:sliders')).toEqual({ '0': 0.2 })
  expect(fakes.getOsVolumes).toHaveBeenCalledOnce()
})

test('hydrates only the renderer view and rejects malformed secret-bearing settings updates', async () => {
  const rendererSettings = {
    homeAssistant: { url: 'https://ha.example', tokenConfigured: true },
    discord: { clientId: 'client', clientSecretConfigured: true, authenticated: true }
  }
  fakes.getRendererConfig.mockReturnValue(rendererSettings)
  const { registerSettingsHandlers } = await import('@main/handlers/settings.handlers')
  registerSettingsHandlers(trustedSender as never)

  expect(invoke('settings:hydrate')).toBe(rendererSettings)
  expect(JSON.stringify(invoke('settings:hydrate'))).not.toContain('token-value')
  expect(() =>
    invoke('settings:update', {
      settings: rendererSettings,
      secrets: { homeAssistantToken: { action: 'set', value: 'token-value' } }
    })
  ).toThrow('Invalid settings update')
  expect(fakes.updateFromRenderer).not.toHaveBeenCalled()

  fakes.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/export.json' })
  fakes.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/import.json'] })
  fakes.exportConfiguration.mockResolvedValue({ status: 'success' })
  fakes.importConfiguration.mockResolvedValue({ status: 'success' })
  await expect(invoke('settings:export')).resolves.toEqual({ status: 'success' })
  await expect(invoke('settings:import')).resolves.toEqual({ status: 'success' })
  if (!fakes.transferDialogs) throw new Error('Transfer dialogs were not registered')
  await expect(fakes.transferDialogs.chooseExportPath()).resolves.toBe('/tmp/export.json')
  await expect(fakes.transferDialogs.chooseImportPath()).resolves.toBe('/tmp/import.json')
})

test('reports app and condition state and ignores untrusted devtools events', async () => {
  fakes.getLogs.mockReturnValue([{ level: 'info', message: 'ready' }])
  fakes.micMuted.mockReturnValue(true)
  fakes.discordMuted.mockReturnValue(false)
  fakes.discordDeafened.mockReturnValue(true)
  fakes.discordStreaming.mockReturnValue(false)
  fakes.discordConnected.mockReturnValue(true)
  const { registerAppHandlers } = await import('@main/handlers/app.handlers')
  const { registerConditionsHandlers } = await import('@main/handlers/conditions.handlers')
  registerAppHandlers(trustedSender as never)
  registerConditionsHandlers(trustedSender as never)

  expect(invoke('electron:versions')).toEqual(expect.objectContaining({ app: '4.0.6' }))
  expect(invoke('electron:logs')).toEqual([{ level: 'info', message: 'ready' }])
  expect(invoke('conditions:state')).toEqual({
    micMuted: true,
    discordMuted: false,
    discordDeafened: true,
    discordStreaming: false,
    discordConnected: true
  })
  const toggle = fakes.events.get('app:toggle-devtools')
  toggle?.({ sender: {}, senderFrame: trustedSender.mainFrame })
  expect(fakes.toggleDevTools).not.toHaveBeenCalled()
  toggle?.(trustedEvent)
  expect(fakes.toggleDevTools).toHaveBeenCalledOnce()
})

test('validates hardware and update command arity before invoking privileged adapters', async () => {
  fakes.diagnose.mockResolvedValue({ rule: 'installed' })
  fakes.installPermissions.mockResolvedValue({ result: 'installed' })
  fakes.getUpdateState.mockReturnValue({ mode: 'appimage', status: 'idle' })
  const { registerHardwarePermissionsHandlers } =
    await import('@main/handlers/hardware-permissions.handlers')
  const { registerUpdateHandlers } = await import('@main/handlers/update.handlers')
  registerHardwarePermissionsHandlers(trustedSender as never)
  registerUpdateHandlers(trustedSender as never)

  await expect(invoke('hardware-permissions:diagnose')).resolves.toEqual({ rule: 'installed' })
  expect(() => invoke('hardware-permissions:install', 'unexpected')).toThrow(
    'do not accept arguments'
  )
  expect(() => invoke('update:state', 'unexpected')).toThrow('Invalid update state request')
  await expect(invoke('update:command', 'invalid')).rejects.toThrow('Invalid update command')
  await expect(invoke('update:command', 'check')).resolves.toEqual({
    mode: 'appimage',
    status: 'idle'
  })
  expect(fakes.executeUpdate).toHaveBeenCalledWith('check', expect.anything(), expect.any(Function))
})

test('registers the complete main-process handler surface for one trusted renderer', async () => {
  const { registerAllHandlers } = await import('@main/handlers')
  registerAllHandlers(trustedSender as never)

  expect([...fakes.invokes.keys()].sort()).toEqual(
    [
      'conditions:state',
      'deej:sessions',
      'deej:sliders',
      'electron:logs',
      'electron:versions',
      'hardware-permissions:diagnose',
      'hardware-permissions:install',
      'led:setProfile',
      'serial:list',
      'serial:status',
      'settings:export',
      'settings:hydrate',
      'settings:import',
      'settings:update',
      'streamdeck:keys',
      'streamdeck:setLedOverride',
      'update:command',
      'update:state'
    ].sort()
  )
  expect([...fakes.events.keys()]).toEqual(['app:toggle-devtools'])
})
