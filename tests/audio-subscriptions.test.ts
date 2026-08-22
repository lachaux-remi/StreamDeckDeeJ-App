import { EventEmitter } from 'node:events'
import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  children: [] as EventEmitter[],
  spawn: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>()
  return { ...original, spawn: fakes.spawn }
})

vi.mock('@main/services/audio-command', async (importOriginal) => {
  const original = await importOriginal<typeof import('@main/services/audio-command')>()
  return {
    ...original,
    commandRunner: {
      run: vi.fn().mockRejectedValue(new Error('command unavailable'))
    }
  }
})

vi.mock('@main/services/config.service', () => ({
  configService: { getConfig: () => ({ deej: {} }) }
}))

vi.mock('@main/services/slider.service', () => ({
  sliderService: Object.assign(new EventEmitter(), { getSliders: () => ({}) })
}))

vi.mock('@main/services/logger.service', () => ({
  loggerService: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: fakes.warn,
    error: fakes.error
  }
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  fakes.children = []
  fakes.spawn.mockReset().mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter() })
    fakes.children.push(child)
    return child
  })
  fakes.warn.mockReset()
  fakes.error.mockReset()
})

test('mic subscription handles an asynchronous spawn error and retries at a bounded rate', async () => {
  const { micService } = await import('@main/services/mic.service')
  await micService.init()
  const child = fakes.children[0]

  expect(() => child.emit('error', new Error('spawn pactl ENOENT'))).not.toThrow()
  expect(() => child.emit('error', new Error('duplicate spawn error'))).not.toThrow()
  child.emit('close', 1)

  expect(vi.getTimerCount()).toBe(1)
  expect(fakes.warn).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(4_999)
  expect(fakes.spawn).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(fakes.spawn).toHaveBeenCalledTimes(2)
  fakes.children[1].emit('error', new Error('still unavailable'))
  expect(fakes.warn).toHaveBeenCalledTimes(1)
})

test('sessions subscription handles an asynchronous spawn error and schedules one retry', async () => {
  await import('@main/services/sessions.service')
  const child = fakes.children[0]
  fakes.error.mockClear()
  const existingTimerCount = vi.getTimerCount()

  expect(() => child.emit('error', new Error('spawn pactl ENOENT'))).not.toThrow()
  expect(() => child.emit('error', new Error('duplicate spawn error'))).not.toThrow()
  child.emit('close', 1)

  expect(fakes.error).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(existingTimerCount + 1)
  await vi.advanceTimersByTimeAsync(4_999)
  expect(fakes.spawn).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(fakes.spawn).toHaveBeenCalledTimes(2)
})

test('subscription degrades explicitly when spawn throws synchronously and recovers later', async () => {
  const onData = vi.fn()
  const onUnavailable = vi.fn()
  fakes.spawn
    .mockImplementationOnce(() => {
      throw new Error('synchronous spawn failure')
    })
    .mockImplementationOnce(() => {
      throw new Error('repeated synchronous spawn failure')
    })
  const { PactlSubscription } = await import('@main/services/audio-subscription')
  const subscription = new PactlSubscription({ onData, onUnavailable })

  expect(() => subscription.start()).not.toThrow()
  expect(onUnavailable).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(1)

  await vi.advanceTimersByTimeAsync(5_000)
  expect(onUnavailable).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(5_000)
  expect(fakes.spawn).toHaveBeenCalledTimes(3)
  const recoveredChild = fakes.children[0] as EventEmitter & { stdout: EventEmitter }
  recoveredChild.stdout.emit('data', Buffer.from('event'))
  expect(onData).toHaveBeenCalledWith(Buffer.from('event'))
})

test('subscription start is idempotent and reports an unexpected close', async () => {
  const child = new EventEmitter()
  fakes.spawn.mockReset().mockReturnValue(child)
  const onUnavailable = vi.fn()
  const { PactlSubscription } = await import('@main/services/audio-subscription')
  const subscription = new PactlSubscription({ onData: vi.fn(), onUnavailable })

  subscription.start()
  subscription.start()
  expect(fakes.spawn).toHaveBeenCalledTimes(1)
  child.emit('close', 1)
  expect(() => child.emit('error', new Error('late process error'))).not.toThrow()

  expect(onUnavailable).toHaveBeenCalledTimes(1)
  expect(onUnavailable).toHaveBeenCalledWith(expect.any(Error))
  expect(vi.getTimerCount()).toBe(1)
})
