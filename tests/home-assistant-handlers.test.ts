import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => unknown>(),
  homeAssistant: { url: 'http://ha.local:8123', token: 'secret' },
  getStates: vi.fn(),
  getServices: vi.fn(),
  getState: vi.fn(),
  checkApi: vi.fn(),
  urls: [] as Array<{ url: string; token: string }>,
  warn: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (event: unknown) => unknown) =>
      fakes.handlers.set(channel, listener)
  }
}))
vi.mock('@main/handlers/trusted-ipc-core', () => ({ isTrustedSender: () => true }))
vi.mock('@main/services/config.service', () => ({
  configService: { getConfig: () => ({ homeAssistant: fakes.homeAssistant }) }
}))
vi.mock('@main/services/logger.service', () => ({ loggerService: { warn: fakes.warn } }))
vi.mock('@main/libs/home-assistant/HomeAssistantAPI', () => ({
  default: class {
    constructor(url: string, token: string) {
      fakes.urls.push({ url, token })
    }
    checkApi = fakes.checkApi
    getStates = fakes.getStates
    getServices = fakes.getServices
    getState = fakes.getState
  }
}))

const { registerHomeAssistantHandlers } = await import('@main/handlers/home-assistant.handlers')

function invoke(channel: string, ...args: unknown[]): unknown {
  return (fakes.handlers.get(channel) as ((...a: unknown[]) => unknown) | undefined)?.({}, ...args)
}

beforeEach(() => {
  fakes.handlers.clear()
  fakes.urls = []
  vi.clearAllMocks()
  fakes.homeAssistant = { url: 'http://ha.local:8123', token: 'secret' }
  registerHomeAssistantHandlers({} as never)
})

test('returns sanitized entities and services with a request timeout', async () => {
  fakes.getStates.mockResolvedValue([
    { entity_id: 'light.desk', state: 'on', attributes: { friendly_name: 'Bureau', x: 1 } }
  ])
  fakes.getServices.mockResolvedValue([{ domain: 'light', services: { toggle: {} } }])

  await expect(invoke('ha:entities')).resolves.toEqual([
    { entityId: 'light.desk', name: 'Bureau', state: 'on' }
  ])
  await expect(invoke('ha:services')).resolves.toEqual(['light.toggle'])
  expect(fakes.getStates.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
})

test('returns nothing without a configured Home Assistant', async () => {
  fakes.homeAssistant = { url: '', token: '' }
  await expect(invoke('ha:entities')).resolves.toEqual([])
  await expect(invoke('ha:services')).resolves.toEqual([])
  expect(fakes.getStates).not.toHaveBeenCalled()
})

test('logs failures and returns nothing', async () => {
  fakes.getStates.mockRejectedValue(new Error('Home Assistant states error: 401'))
  await expect(invoke('ha:entities')).resolves.toEqual([])
  expect(fakes.warn).toHaveBeenCalledWith(
    expect.stringContaining('Cannot list Home Assistant entities'),
    'HomeAssistantHandlers'
  )
})

test('lists the attributes of one validated entity only', async () => {
  fakes.getState.mockResolvedValue({ state: 'on', attributes: { brightness: 120 } })
  await expect(invoke('ha:attributes', 'light.desk')).resolves.toEqual([
    { name: 'brightness', preview: '120' }
  ])
  expect(fakes.getState).toHaveBeenCalledWith('light.desk', expect.any(AbortSignal))

  fakes.getState.mockClear()
  for (const invalid of ['../api/config', 'light', 42, undefined]) {
    expect(await invoke('ha:attributes', invalid)).toEqual([])
  }
  expect(fakes.getState).not.toHaveBeenCalled()
})

test('tests the edited URL with a typed token or the stored one', async () => {
  fakes.checkApi.mockResolvedValue(200)
  const url = 'https://ha.example:8123'

  await expect(invoke('ha:test', { url, token: { action: 'unchanged' } })).resolves.toBe('ok')
  await expect(
    invoke('ha:test', { url, token: { action: 'set', value: 'typed-token' } })
  ).resolves.toBe('ok')

  expect(fakes.urls).toEqual([
    { url, token: 'secret' },
    { url, token: 'typed-token' }
  ])
  expect(fakes.checkApi.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
})

test('maps connection test outcomes', async () => {
  const request = { url: 'http://ha.local:8123', token: { action: 'unchanged' } }

  fakes.checkApi.mockResolvedValueOnce(401)
  await expect(invoke('ha:test', request)).resolves.toBe('unauthorized')
  fakes.checkApi.mockResolvedValueOnce(404)
  await expect(invoke('ha:test', request)).resolves.toBe('error')
  fakes.checkApi.mockRejectedValueOnce(new TypeError('fetch failed'))
  await expect(invoke('ha:test', request)).resolves.toBe('unreachable')

  await expect(invoke('ha:test', { url: '', token: { action: 'unchanged' } })).resolves.toBe(
    'missing-url'
  )
  await expect(invoke('ha:test', { ...request, token: { action: 'clear' } })).resolves.toBe(
    'missing-token'
  )
})

test('rejects malformed connection test requests', async () => {
  for (const invalid of [
    undefined,
    { url: 'file:///etc/passwd', token: { action: 'unchanged' } },
    { url: 'http://ha.local', token: { action: 'set', value: '' } },
    { url: 'http://ha.local', token: { action: 'unchanged' }, extra: true }
  ]) {
    await expect(invoke('ha:test', invalid)).rejects.toThrow(TypeError)
  }
  expect(fakes.checkApi).not.toHaveBeenCalled()
})
