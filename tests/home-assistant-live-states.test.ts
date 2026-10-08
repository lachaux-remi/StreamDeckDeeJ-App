import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  HomeAssistantLiveStates,
  homeAssistantWebSocketUrl,
  type LiveSocket
} from '@main/services/home-assistant-live-states'
import { ModuleEnum } from '@main/types/enums'

class FakeSocket implements LiveSocket {
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  readonly sent: Record<string, unknown>[] = []
  readonly close = vi.fn()

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>)
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) })
  }

  last(type: string): Record<string, unknown> | undefined {
    return this.sent.filter((message) => message.type === type).at(-1)
  }
}

function button(entityId: string, conditionType = 'ha-on'): object {
  return {
    pressed: { module: ModuleEnum.HomeAssistant, params: ['light.toggle', entityId] },
    ledConditions: [{ type: conditionType, color: '#ff0000' }]
  }
}

function config(
  streamdeck: Record<string, object>,
  homeAssistant = { url: 'http://ha.local:8123', token: 'secret-token' }
): never {
  return { homeAssistant, streamdeck } as never
}

const buttons = { '1': button('light.desk'), '2': button('light.desk'), '3': button('switch.fan') }

let sockets: FakeSocket[]
let states: Array<[string, string]>
let liveChanges: boolean[]
let client: HomeAssistantLiveStates

function socket(): FakeSocket {
  const current = sockets.at(-1)
  if (!current) {
    throw new Error('No socket created')
  }
  return current
}

async function connect(streamdeck: Record<string, object> = buttons): Promise<FakeSocket> {
  client.start(config(streamdeck))
  await vi.advanceTimersByTimeAsync(0)
  const ws = socket()
  ws.receive({ type: 'auth_required' })
  ws.receive({ type: 'auth_ok' })
  return ws
}

beforeEach(() => {
  vi.useFakeTimers()
  sockets = []
  states = []
  liveChanges = []
  client = new HomeAssistantLiveStates({
    createSocket: (url) => {
      const created = new FakeSocket(url)
      sockets.push(created)
      return created
    },
    setButtonState: (key, state) => states.push([key, state]),
    onLiveChange: (live) => liveChanges.push(live)
  })
})

afterEach(() => {
  client.shutdown()
  vi.useRealTimers()
})

test('derives the WebSocket endpoint from the configured Home Assistant URL', () => {
  expect(homeAssistantWebSocketUrl('http://ha.local:8123')).toBe('ws://ha.local:8123/api/websocket')
  expect(homeAssistantWebSocketUrl('https://example.org/ha/')).toBe(
    'wss://example.org/ha/api/websocket'
  )
})

test('authenticates, subscribes to the button entities only, and goes live', async () => {
  const ws = await connect()

  expect(ws.url).toBe('ws://ha.local:8123/api/websocket')
  expect(ws.sent[0]).toEqual({ type: 'auth', access_token: 'secret-token' })
  expect(ws.last('subscribe_entities')).toEqual({
    id: 1,
    type: 'subscribe_entities',
    entity_ids: ['light.desk', 'switch.fan']
  })
  expect(liveChanges).toEqual([])
  ws.receive({ id: 1, type: 'result', success: true, result: null })
  expect(liveChanges).toEqual([true])
})

test('applies initial states, changes and removals to every mapped button', async () => {
  const ws = await connect()
  ws.receive({ id: 1, type: 'result', success: true })

  ws.receive({
    id: 1,
    type: 'event',
    event: { a: { 'light.desk': { s: 'on', a: {} }, 'switch.fan': { s: 'off', a: {} } } }
  })
  expect(states).toEqual([
    ['1', 'on'],
    ['2', 'on'],
    ['3', 'off']
  ])

  states = []
  ws.receive({
    id: 1,
    type: 'event',
    event: { c: { 'switch.fan': { '+': { s: 'on' } }, 'light.desk': { '+': { a: { b: 1 } } } } }
  })
  ws.receive([{ id: 1, type: 'event', event: { r: ['light.desk'] } }])
  ws.receive({ id: 99, type: 'event', event: { a: { 'switch.fan': { s: 'off' } } } })
  expect(states).toEqual([
    ['3', 'on'],
    ['1', 'unavailable'],
    ['2', 'unavailable']
  ])
})

test('ignores malformed, oversized and binary messages', async () => {
  const ws = await connect()
  ws.receive('not json')
  ws.receive('x'.repeat(4 * 1024 * 1024 + 1))
  ws.onmessage?.({ data: new ArrayBuffer(8) })
  ws.receive({ id: 1, type: 'event', event: { a: { 'light.desk': { s: 42 } }, c: 'bad', r: [1] } })
  expect(states).toEqual([])
  expect(sockets).toHaveLength(1)
})

test('resubscribes only when the entity mapping changes', async () => {
  const ws = await connect()
  ws.receive({ id: 1, type: 'result', success: true })

  client.update(config(buttons))
  expect(ws.sent.filter((message) => message.type === 'subscribe_entities')).toHaveLength(1)

  client.update(config({ ...buttons, '4': button('cover.blind', 'ha-off') }))
  expect(ws.last('unsubscribe_events')).toEqual({
    id: 2,
    type: 'unsubscribe_events',
    subscription: 1
  })
  expect(ws.last('subscribe_entities')).toEqual({
    id: 3,
    type: 'subscribe_entities',
    entity_ids: ['cover.blind', 'light.desk', 'switch.fan']
  })
  expect(sockets).toHaveLength(1)
})

test('goes live without a subscription when no button needs Home Assistant states', async () => {
  const ws = await connect({ '1': button('light.desk', 'mic-muted') })
  expect(ws.last('subscribe_entities')).toBeUndefined()
  expect(liveChanges).toEqual([true])
})

test('reconnects with a growing delay and falls back to polling meanwhile', async () => {
  const ws = await connect()
  ws.receive({ id: 1, type: 'result', success: true })

  ws.onclose?.()
  expect(liveChanges).toEqual([true, false])
  await vi.advanceTimersByTimeAsync(999)
  expect(sockets).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(sockets).toHaveLength(2)

  socket().onclose?.()
  await vi.advanceTimersByTimeAsync(1_999)
  expect(sockets).toHaveLength(2)
  await vi.advanceTimersByTimeAsync(1)
  expect(sockets).toHaveLength(3)
  expect(ws.close).toHaveBeenCalled()
})

test('gives up on a silent server after the authentication timeout', async () => {
  client.start(config(buttons))
  await vi.advanceTimersByTimeAsync(10_000)
  expect(socket().close).toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1_000)
  expect(sockets).toHaveLength(2)
})

test('waits five minutes after a rejected token or subscription', async () => {
  client.start(config(buttons))
  await vi.advanceTimersByTimeAsync(0)
  socket().receive({ type: 'auth_invalid', message: 'Invalid access token' })
  await vi.advanceTimersByTimeAsync(5 * 60_000 - 1)
  expect(sockets).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(sockets).toHaveLength(2)

  socket().receive({ type: 'auth_ok' })
  socket().receive({ id: 1, type: 'result', success: false, error: { code: 'unknown_command' } })
  expect(liveChanges).toEqual([])
  await vi.advanceTimersByTimeAsync(5 * 60_000)
  expect(sockets).toHaveLength(3)
})

test('pings the server and reconnects when pongs stop', async () => {
  const ws = await connect()
  ws.receive({ id: 1, type: 'result', success: true })

  await vi.advanceTimersByTimeAsync(30_000)
  const ping = ws.last('ping')
  expect(ping).toEqual({ id: 2, type: 'ping' })
  ws.receive({ id: 2, type: 'pong' })
  await vi.advanceTimersByTimeAsync(10_000)
  expect(sockets).toHaveLength(1)

  await vi.advanceTimersByTimeAsync(20_000)
  expect(ws.last('ping')).toEqual({ id: 3, type: 'ping' })
  await vi.advanceTimersByTimeAsync(10_000)
  expect(liveChanges.at(-1)).toBe(false)
  await vi.advanceTimersByTimeAsync(1_000)
  expect(sockets).toHaveLength(2)
})

test('reconnects to a new endpoint and ignores the previous socket', async () => {
  const ws = await connect()
  client.update(config(buttons, { url: 'https://ha.example.org', token: 'other' }))
  await vi.advanceTimersByTimeAsync(0)
  expect(ws.close).toHaveBeenCalled()
  expect(socket().url).toBe('wss://ha.example.org/api/websocket')

  ws.receive({ id: 1, type: 'event', event: { a: { 'light.desk': { s: 'on' } } } })
  ws.onclose?.()
  socket().receive({ type: 'auth_required' })
  expect(socket().sent).toEqual([{ type: 'auth', access_token: 'other' }])
  expect(states).toEqual([])
  expect(sockets).toHaveLength(2)
})

test('does not connect without a URL or token, and stops cleanly', async () => {
  client.start(config(buttons, { url: '', token: '' }))
  await vi.advanceTimersByTimeAsync(60_000)
  expect(sockets).toHaveLength(0)

  const ws = await connect()
  ws.receive({ id: 1, type: 'result', success: true })
  client.shutdown()
  expect(ws.close).toHaveBeenCalled()
  expect(liveChanges).toEqual([true, false])
  await vi.advanceTimersByTimeAsync(10 * 60_000)
  expect(sockets).toHaveLength(1)
})

test('retries when the socket cannot be created', async () => {
  let attempts = 0
  const failing = new HomeAssistantLiveStates({
    createSocket: () => {
      attempts += 1
      throw new Error('invalid url')
    },
    setButtonState: vi.fn(),
    onLiveChange: vi.fn(),
    log: vi.fn()
  })
  failing.start(config(buttons))
  await vi.advanceTimersByTimeAsync(0)
  await vi.advanceTimersByTimeAsync(1_000)
  expect(attempts).toBe(2)
  failing.shutdown()
})
