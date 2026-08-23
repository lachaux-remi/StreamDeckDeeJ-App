import { beforeEach, expect, test, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  api: undefined as Record<string, unknown> | undefined,
  invoke: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  exposeInMainWorld: vi.fn((_name: string, api: Record<string, unknown>) => {
    electron.api = api
  })
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: {
    invoke: electron.invoke,
    send: electron.send,
    on: electron.on,
    removeListener: electron.removeListener
  }
}))

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  electron.api = undefined
  Object.defineProperty(process, 'contextIsolated', { value: true, configurable: true })
  await import('../src/preload/index')
})

test('exposes request methods on their exact main-process channels', async () => {
  const api = electron.api as {
    settings: Record<string, (...args: unknown[]) => unknown>
    serial: Record<string, (...args: unknown[]) => unknown>
    hardwarePermissions: Record<string, (...args: unknown[]) => unknown>
    streamdeck: Record<string, (...args: unknown[]) => unknown>
    deej: Record<string, (...args: unknown[]) => unknown>
    app: Record<string, (...args: unknown[]) => unknown>
    update: Record<string, (...args: unknown[]) => unknown>
    conditions: Record<string, (...args: unknown[]) => unknown>
  }
  const calls: Array<[() => unknown, string, ...unknown[]]> = [
    [() => api.settings.hydrate(), 'settings:hydrate'],
    [() => api.settings.update({ safe: true }), 'settings:update', { safe: true }],
    [() => api.settings.export(), 'settings:export'],
    [() => api.settings.import(), 'settings:import'],
    [() => api.serial.list(), 'serial:list'],
    [() => api.serial.status(), 'serial:status'],
    [() => api.hardwarePermissions.diagnose(), 'hardware-permissions:diagnose'],
    [() => api.hardwarePermissions.install(), 'hardware-permissions:install'],
    [() => api.streamdeck.getKeys('3'), 'streamdeck:keys', '3'],
    [
      () => api.streamdeck.setLedOverride({ '3': {} }, '3', { r: 1, g: 2, b: 3 }),
      'streamdeck:setLedOverride',
      { '3': {} },
      '3',
      { r: 1, g: 2, b: 3 }
    ],
    [
      () => api.streamdeck.setLedProfile({ mode: 'rainbow' }),
      'led:setProfile',
      { mode: 'rainbow' }
    ],
    [() => api.deej.getSliders(), 'deej:sliders'],
    [() => api.deej.getSessions(), 'deej:sessions'],
    [() => api.app.getVersions(), 'electron:versions'],
    [() => api.app.getLogs(), 'electron:logs'],
    [() => api.update.getState(), 'update:state'],
    [() => api.update.command('check'), 'update:command', 'check'],
    [() => api.conditions.getState(), 'conditions:state']
  ]

  for (const [call, channel, ...args] of calls) {
    electron.invoke.mockClear()
    call()
    expect(electron.invoke).toHaveBeenCalledWith(channel, ...args)
  }
  api.app.toggleDevTools()
  expect(electron.send).toHaveBeenCalledWith('app:toggle-devtools')
})

test('subscriptions forward payloads and dispose the exact registered listener', () => {
  const api = electron.api as {
    update: { onStateChanged: (callback: (...args: unknown[]) => void) => () => void }
    conditions: { onChange: (callback: (...args: unknown[]) => void) => () => void }
    on: Record<string, (callback: (...args: unknown[]) => void) => () => void>
  }
  const subscriptions: Array<[() => () => void, string, unknown[]]> = [
    [() => api.update.onStateChanged(vi.fn()), 'update:state', [{ status: 'checking' }]],
    [() => api.conditions.onChange(vi.fn()), 'conditions:change', [{ micMuted: true }]],
    [() => api.on.slidersUpdate(vi.fn()), 'deej:sliders', [{ '0': 0.5 }]],
    [() => api.on.streamdeckUpdate(vi.fn()), 'streamdeck:update', ['3', { pressed: true }]],
    [() => api.on.serialStatus(vi.fn()), 'serial:status', [{ connected: true, port: 'tty0' }]],
    [() => api.on.log(vi.fn()), 'electron:log', [{ level: 'info' }]]
  ]

  for (const [subscribe, channel, payload] of subscriptions) {
    electron.on.mockClear()
    const dispose = subscribe()
    const handler = electron.on.mock.calls[0][1] as (...args: unknown[]) => void
    handler({}, ...payload)
    dispose()
    expect(electron.on).toHaveBeenCalledWith(channel, handler)
    expect(electron.removeListener).toHaveBeenCalledWith(channel, handler)
  }
})
