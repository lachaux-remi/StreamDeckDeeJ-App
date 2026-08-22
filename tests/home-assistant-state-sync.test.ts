import { afterEach, expect, test, vi } from 'vitest'
import { HomeAssistantStateSync } from '@main/services/home-assistant-state-sync'
import { ModuleEnum } from '@main/types/enums'
import type { AppSettings } from '@main/types/settings.types'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function config(url = 'https://ha.example'): Pick<AppSettings, 'homeAssistant' | 'streamdeck'> {
  return {
    homeAssistant: { url, token: 'token' },
    streamdeck: {
      a: {
        pressed: { module: ModuleEnum.HomeAssistant, params: ['light.toggle', 'light.office'] },
        ledConditions: [{ type: 'ha-on', color: { r: 0, g: 255, b: 0 } }]
      }
    }
  }
}

function deferredState(): {
  promise: Promise<{ state: string }>
  resolve: (value: { state: string }) => void
} {
  let resolve!: (value: { state: string }) => void
  const promise = new Promise<{ state: string }>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

test('keeps only one Home Assistant state request in flight per entity while polling', async () => {
  vi.useFakeTimers()
  let requests = 0
  const synchronizer = new HomeAssistantStateSync({
    pollIntervalMs: 100,
    getState: async () => {
      requests += 1
      return new Promise(() => {})
    },
    setButtonState: () => {}
  })

  synchronizer.start(config())
  await vi.advanceTimersByTimeAsync(500)

  expect(requests).toBe(1)
  synchronizer.shutdown()
})

test('times out a Home Assistant state request through its AbortSignal', async () => {
  let requestSignal: AbortSignal | undefined
  const synchronizer = new HomeAssistantStateSync({
    requestTimeoutMs: 10,
    getState: async (_url, _token, _entityId, signal) => {
      requestSignal = signal
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    },
    setButtonState: () => {}
  })

  synchronizer.start(config())

  await vi.waitFor(() => expect(requestSignal?.aborted).toBe(true))
  synchronizer.shutdown()
})

test('cancels the old endpoint and ignores its obsolete response after configuration changes', async () => {
  const oldRequest = deferredState()
  const newRequest = deferredState()
  const calls: { url: string; signal: AbortSignal }[] = []
  const states: string[] = []
  const synchronizer = new HomeAssistantStateSync({
    getState: async (url, _token, _entityId, signal) => {
      calls.push({ url, signal })
      return url === 'https://old.example' ? oldRequest.promise : newRequest.promise
    },
    setButtonState: (_key, state) => states.push(state)
  })
  synchronizer.start(config('https://old.example'))

  synchronizer.update(config('https://new.example'))
  expect(calls[0].signal.aborted).toBe(true)
  oldRequest.resolve({ state: 'obsolete' })
  await oldRequest.promise
  await Promise.resolve()
  expect(states).toEqual([])

  newRequest.resolve({ state: 'on' })
  await newRequest.promise
  await Promise.resolve()
  expect(states).toEqual(['on'])
  expect(calls.map(({ url }) => url)).toEqual(['https://old.example', 'https://new.example'])
  synchronizer.shutdown()
})

test('waits for an unsettled request before replacing the same logical target', async () => {
  const firstRequest = deferredState()
  const secondRequest = deferredState()
  const states: string[] = []
  let requests = 0
  const synchronizer = new HomeAssistantStateSync({
    getState: async () => {
      requests += 1
      return requests === 1 ? firstRequest.promise : secondRequest.promise
    },
    setButtonState: (_key, state) => states.push(state)
  })
  synchronizer.start(config())

  synchronizer.update(config())
  expect(requests).toBe(1)

  firstRequest.resolve({ state: 'obsolete' })
  await vi.waitFor(() => expect(requests).toBe(2))
  expect(states).toEqual([])
  secondRequest.resolve({ state: 'on' })
  await vi.waitFor(() => expect(states).toEqual(['on']))
  synchronizer.shutdown()
})

test('aborts pending work and stops polling during shutdown', async () => {
  vi.useFakeTimers()
  const signals: AbortSignal[] = []
  const synchronizer = new HomeAssistantStateSync({
    pollIntervalMs: 100,
    getState: async (_url, _token, _entityId, signal) => {
      signals.push(signal)
      return new Promise(() => {})
    },
    setButtonState: () => {}
  })
  synchronizer.start(config())

  synchronizer.shutdown()
  await vi.advanceTimersByTimeAsync(500)

  expect(signals).toHaveLength(1)
  expect(signals[0].aborted).toBe(true)
})

test('shares an entity response across configured buttons and ignores unrelated buttons', async () => {
  const states: [string, string][] = []
  let requests = 0
  const synchronizer = new HomeAssistantStateSync({
    getState: async () => {
      requests += 1
      return { state: 'on' }
    },
    setButtonState: (key, state) => states.push([key, state])
  })
  const settings = config()
  settings.streamdeck.b = {
    hold: { module: ModuleEnum.HomeAssistant, params: ['light.turn_off', 'light.office'] },
    ledConditions: [{ type: 'ha-off', color: { r: 255, g: 0, b: 0 } }]
  }
  settings.streamdeck.c = {
    pressed: { module: ModuleEnum.Macro, params: ['ignored'] },
    ledConditions: [{ type: 'ha-on', color: { r: 0, g: 0, b: 0 } }]
  }

  synchronizer.start(settings)
  await vi.waitFor(() => expect(states).toHaveLength(2))

  expect(requests).toBe(1)
  expect(states).toEqual([
    ['a', 'on'],
    ['b', 'on']
  ])
  synchronizer.shutdown()
})

test('uses the authenticated Home Assistant API transport with an AbortSignal', async () => {
  const states: string[] = []
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ state: 'on', attributes: {} }), { status: 200 })
  )
  vi.stubGlobal('fetch', fetchMock)
  const synchronizer = new HomeAssistantStateSync({
    setButtonState: (_key, state) => states.push(state)
  })

  synchronizer.start(config())
  synchronizer.start(config('https://ignored.example'))
  await vi.waitFor(() => expect(states).toEqual(['on']))

  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(
    'https://ha.example/api/states/light.office',
    expect.objectContaining({
      headers: { Authorization: 'Bearer token' },
      signal: expect.any(AbortSignal)
    })
  )
  synchronizer.shutdown()
})

test('does not poll without complete credentials or a configured LED state target', () => {
  let requests = 0
  const synchronizer = new HomeAssistantStateSync({
    getState: async () => {
      requests += 1
      return { state: 'on' }
    },
    setButtonState: () => {}
  })
  const missingEndpoint = config()
  missingEndpoint.homeAssistant.url = ''
  const missingToken = config()
  missingToken.homeAssistant.token = ''
  const missingCondition = config()
  delete missingCondition.streamdeck.a.ledConditions

  synchronizer.start(missingEndpoint)
  synchronizer.update(missingToken)
  synchronizer.update(missingCondition)

  expect(requests).toBe(0)
  synchronizer.shutdown()
})
