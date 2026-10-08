import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => unknown>(),
  homeAssistant: { url: 'http://ha.local:8123', token: 'secret' },
  getStates: vi.fn(),
  getServices: vi.fn(),
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
    getStates = fakes.getStates
    getServices = fakes.getServices
  }
}))

const { registerHomeAssistantHandlers } = await import('@main/handlers/home-assistant.handlers')

function invoke(channel: string): unknown {
  return fakes.handlers.get(channel)?.({})
}

beforeEach(() => {
  fakes.handlers.clear()
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
