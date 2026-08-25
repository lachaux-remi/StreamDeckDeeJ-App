import { beforeEach, expect, test, vi } from 'vitest'

interface FakeSocket {
  once: (event: string, listener: (...args: unknown[]) => void) => FakeSocket
  on: (event: string, listener: (...args: unknown[]) => void) => FakeSocket
  emit: (event: string, ...args: unknown[]) => void
  removeAllListeners: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  write: ReturnType<typeof vi.fn>
}

function fakeSocket(): FakeSocket {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const socket = {
    once(event: string, listener: (...args: unknown[]) => void) {
      const once = (...args: unknown[]): void => {
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((item) => item !== once)
        )
        listener(...args)
      }
      listeners.set(event, [...(listeners.get(event) ?? []), once])
      return socket
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
      return socket
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of [...(listeners.get(event) ?? [])]) {
        listener(...args)
      }
    },
    removeAllListeners: vi.fn((event: string) => listeners.delete(event)),
    destroy: vi.fn(),
    write: vi.fn()
  }
  return socket
}

const fakes = vi.hoisted(() => ({
  lstat: vi.fn(),
  createConnection: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
}))

vi.mock('node:fs/promises', () => ({ lstat: fakes.lstat }))
vi.mock('node:net', () => ({ createConnection: fakes.createConnection }))
vi.mock('@main/services/config.service', () => ({
  configService: { getConfig: fakes.getConfig, setConfig: fakes.setConfig }
}))
vi.mock('@main/services/logger.service', () => ({
  loggerService: { warn: fakes.warn, debug: fakes.debug, info: fakes.info }
}))

function rpcFrame(payload: unknown, op = 1): Buffer {
  const json = JSON.stringify(payload)
  const frame = Buffer.alloc(8 + Buffer.byteLength(json))
  frame.writeUInt32LE(op, 0)
  frame.writeUInt32LE(Buffer.byteLength(json), 4)
  frame.write(json, 8)
  return frame
}

function writtenPayload(socket: FakeSocket, index: number): Record<string, unknown> {
  const frame = socket.write.mock.calls[index][0] as Buffer
  return JSON.parse(frame.subarray(8).toString()) as Record<string, unknown>
}

async function settleUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) {
      return
    }
    await Promise.resolve()
  }
  throw new Error('Async operation did not settle')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  vi.clearAllMocks()
  fakes.getConfig.mockReturnValue({
    discord: {
      clientId: 'client-id',
      clientSecret: 'fixture-client-secret',
      accessToken: 'fixture-access-token',
      refreshToken: 'fixture-refresh-token'
    }
  })
  fakes.lstat.mockResolvedValue({ isSocket: () => true, uid: 1000, mode: 0o600 })
  if (process.getuid) {
    vi.spyOn(process, 'getuid').mockReturnValue(1000)
  }
})

test('uses Discord named pipes on Windows instead of Unix filesystem paths', async () => {
  const { discordSocketPaths } = await import('@main/services/discord.service')

  expect(discordSocketPaths('win32', 3, {})).toEqual(['\\\\?\\pipe\\discord-ipc-3'])
  expect(discordSocketPaths('linux', 3, { XDG_RUNTIME_DIR: '/run/user/1000' })).toEqual([
    '/run/user/1000/discord-ipc-3',
    '/run/user/1000/app/com.discordapp.Discord/discord-ipc-3',
    '/tmp/discord-ipc-3'
  ])
})

test('shuts down the Discord socket without scheduling another reconnect', async () => {
  const socket = fakeSocket()
  fakes.createConnection.mockReturnValue(socket)
  const { discordService } = await import('@main/services/discord.service')

  await discordService.init()
  await Promise.resolve()
  socket.emit('connect')
  await discordService.shutdown()
  socket.emit('close')

  expect(socket.destroy).toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('connects only to a trusted socket, authenticates, subscribes, updates state, and resets it on close', async () => {
  const socket = fakeSocket()
  fakes.createConnection.mockReturnValue(socket)
  const { discordService } = await import('@main/services/discord.service')
  const changed = vi.fn()
  discordService.on('change', changed)

  await discordService.init()
  await Promise.resolve()
  socket.emit('connect')
  await Promise.resolve()

  expect(fakes.createConnection).toHaveBeenCalledWith(expect.stringMatching(/discord-ipc-0$/))
  expect(writtenPayload(socket, 0)).toEqual({ v: 1, client_id: 'client-id' })

  socket.emit('data', rpcFrame({ evt: 'READY' }))
  await Promise.resolve()
  expect(discordService.isConnected()).toBe(true)
  expect(writtenPayload(socket, 1)).toEqual({
    cmd: 'AUTHENTICATE',
    args: { access_token: 'fixture-access-token' },
    nonce: 'authenticate'
  })

  socket.emit('data', rpcFrame({ cmd: 'AUTHENTICATE', data: {} }))
  expect(socket.write).toHaveBeenCalledTimes(5)
  socket.emit('data', rpcFrame({ evt: 'VOICE_SETTINGS_UPDATE', data: { mute: true, deaf: true } }))
  socket.emit('data', rpcFrame({ evt: 'SCREENSHARE_STATE_UPDATE', data: { active: true } }))
  expect([
    discordService.isMuted(),
    discordService.isDeafened(),
    discordService.isStreaming()
  ]).toEqual([true, true, true])

  socket.emit('close')
  expect(discordService.isConnected()).toBe(false)
  expect([
    discordService.isMuted(),
    discordService.isDeafened(),
    discordService.isStreaming()
  ]).toEqual([false, false, false])
  expect(changed).toHaveBeenCalledTimes(4)
  expect(vi.getTimerCount()).toBe(1)
  discordService.reconnect()
  vi.clearAllTimers()
})

test('bounds socket discovery and coalesces reconnect when no trusted endpoint exists', async () => {
  fakes.lstat.mockResolvedValue({ isSocket: () => false, uid: 1000, mode: 0o600 })
  const { discordService } = await import('@main/services/discord.service')

  await discordService.init()
  await settleUntil(() => vi.getTimerCount() === 1)

  expect(fakes.lstat).toHaveBeenCalledTimes(process.env['XDG_RUNTIME_DIR'] ? 30 : 10)
  expect(fakes.createConnection).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(1)
  vi.clearAllTimers()
})

test('exchanges an authorization code and authenticates with the returned token', async () => {
  const socket = fakeSocket()
  fakes.createConnection.mockReturnValue(socket)
  const fetch = vi.fn().mockResolvedValue({
    json: () =>
      Promise.resolve({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      })
  })
  vi.stubGlobal('fetch', fetch)
  const { discordService } = await import('@main/services/discord.service')

  await discordService.init()
  await Promise.resolve()
  socket.emit('connect')
  socket.emit('data', rpcFrame({ cmd: 'AUTHORIZE', data: { code: 'authorization-code' } }))
  await settleUntil(() => fakes.setConfig.mock.calls.length === 1)

  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/oauth2/token',
    expect.objectContaining({ method: 'POST' })
  )
  expect(fakes.setConfig).toHaveBeenCalledWith({
    discord: expect.objectContaining({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    })
  })
  expect(writtenPayload(socket, 1)).toEqual({
    cmd: 'AUTHENTICATE',
    args: { access_token: 'new-access-token' },
    nonce: 'authenticate'
  })
  vi.unstubAllGlobals()
  vi.clearAllTimers()
})

test('refreshes rejected authentication without exposing stored secrets in failures', async () => {
  const socket = fakeSocket()
  fakes.createConnection.mockReturnValue(socket)
  const fetch = vi.fn().mockRejectedValue(new Error('offline'))
  vi.stubGlobal('fetch', fetch)
  const { discordService } = await import('@main/services/discord.service')
  await discordService.init()
  await Promise.resolve()
  socket.emit('connect')
  socket.emit('data', rpcFrame({ cmd: 'AUTHENTICATE', evt: 'ERROR' }))
  await Promise.resolve()
  await Promise.resolve()

  expect(fetch).toHaveBeenCalledWith(
    'https://discord.com/api/oauth2/token',
    expect.objectContaining({ method: 'POST' })
  )
  expect(fakes.setConfig).toHaveBeenCalledWith({
    discord: expect.objectContaining({ accessToken: undefined, refreshToken: undefined })
  })
  expect(fakes.warn.mock.calls.flat().join(' ')).not.toContain('fixture-client-secret')
  expect(fakes.warn.mock.calls.flat().join(' ')).not.toContain('fixture-refresh-token')
  vi.unstubAllGlobals()
  vi.clearAllTimers()
})
