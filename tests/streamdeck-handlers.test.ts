import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  getKeyInfo: vi.fn(),
  updateOverrides: vi.fn(),
  updateProfile: vi.fn(),
  flush: vi.fn(async () => undefined)
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, listener)
    }
  }
}))

vi.mock('@main/services/deck.service', () => ({
  deckService: { getKeyInfo: mocks.getKeyInfo }
}))

vi.mock('@main/services/led.service', () => ({
  ledService: {
    updateOverrides: mocks.updateOverrides,
    updateProfile: mocks.updateProfile,
    flush: mocks.flush
  }
}))

import { registerStreamdeckHandlers } from '@main/handlers/streamdeck.handlers'

const trustedSender = { mainFrame: {} }
const trustedEvent = { sender: trustedSender, senderFrame: trustedSender.mainFrame }

function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = mocks.handlers.get(channel)
  if (!handler) {
    throw new Error(`Missing test handler: ${channel}`)
  }
  return handler(trustedEvent, ...args)
}

beforeEach(() => {
  mocks.handlers.clear()
  vi.clearAllMocks()
  registerStreamdeckHandlers(trustedSender as never)
})

test('preserves valid key lookup, LED preview, and LED profile payloads', async () => {
  const profile = {
    mode: 'rainbow',
    speed: 50,
    brightness: 80,
    startColor: { r: 0, g: 0, b: 255 },
    endColor: { r: 255, g: 0, b: 255 },
    direction: 'horizontal'
  }
  const streamdeck = {
    '0': { pressed: { module: 'macro', params: ['open_browser'] } }
  }

  invoke('streamdeck:keys', '0')
  await invoke('streamdeck:setLedOverride', streamdeck, '0', { r: 12, g: 34, b: 56 })
  await invoke('streamdeck:setLedOverride', streamdeck, '1', null)
  await invoke('streamdeck:setLedOverride', streamdeck, '', null)
  await invoke('led:setProfile', profile)

  expect(mocks.getKeyInfo).toHaveBeenCalledWith('0')
  expect(mocks.updateOverrides).toHaveBeenCalledWith({
    '0': {
      pressed: { module: 'macro', params: ['open_browser'] },
      color: { r: 12, g: 34, b: 56 }
    }
  })
  expect(mocks.updateOverrides).toHaveBeenNthCalledWith(2, {
    ...streamdeck,
    '1': { color: undefined }
  })
  expect(mocks.updateOverrides).toHaveBeenLastCalledWith(streamdeck)
  expect(mocks.updateProfile).toHaveBeenCalledWith(profile)
})

test('rejects malformed IPC arity, indices, colors, profiles, and config cardinality', async () => {
  const oversizedDeck = Object.fromEntries(
    Array.from({ length: 65 }, (_, index) => [String(index), {}])
  )
  const invalidCalls: Array<[string, ...unknown[]]> = [
    ['streamdeck:keys'],
    ['streamdeck:keys', '0', 'extra'],
    ['streamdeck:keys', '-1'],
    ['streamdeck:setLedOverride', {}, '0'],
    ['streamdeck:setLedOverride', {}, '0', { r: 256, g: 0, b: 0 }],
    ['streamdeck:setLedOverride', oversizedDeck, '0', null],
    [
      'led:setProfile',
      {
        mode: 'unknown',
        speed: 50,
        brightness: 80,
        startColor: { r: 0, g: 0, b: 0 },
        endColor: { r: 0, g: 0, b: 0 },
        direction: 'horizontal'
      }
    ],
    ['led:setProfile', {}, 'extra']
  ]

  for (const [channel, ...args] of invalidCalls) {
    await expect(Promise.resolve().then(() => invoke(channel, ...args))).rejects.toThrow(
      'Invalid IPC payload'
    )
  }

  expect(mocks.getKeyInfo).not.toHaveBeenCalled()
  expect(mocks.updateOverrides).not.toHaveBeenCalled()
  expect(mocks.updateProfile).not.toHaveBeenCalled()
  expect(mocks.flush).not.toHaveBeenCalled()
})

test('does not echo rejected payload contents in IPC validation errors', async () => {
  const fixtureSecret = 'synthetic-sensitive-payload'
  const error = await Promise.resolve()
    .then(() =>
      invoke(
        'streamdeck:setLedOverride',
        {
          '0': { pressed: { module: 'invalid', params: [fixtureSecret] } }
        },
        '0',
        null
      )
    )
    .catch((caught: unknown) => caught)

  expect(String(error)).toContain('Invalid IPC payload')
  expect(String(error)).not.toContain(fixtureSecret)
})
