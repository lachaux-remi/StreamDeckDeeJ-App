import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  device: {
    write: vi.fn<(...args: unknown[]) => Promise<void>>(),
    close: vi.fn<() => Promise<void>>()
  },
  devices: vi.fn(),
  open: vi.fn(),
  configListener: undefined as ((config: Record<string, unknown>) => void) | undefined,
  mic: { on: vi.fn() },
  discord: { on: vi.fn() },
  resolve: vi.fn()
}))

vi.mock('node-hid', () => ({
  default: {
    devices: fakes.devices,
    HIDAsync: { open: fakes.open }
  }
}))

vi.mock('@main/services/config.service', () => ({
  configService: {
    getConfig: () => ({
      gridCols: 4,
      streamdeck: {
        '0': { color: { r: 20, g: 40, b: 60 } },
        '1': {
          color: { r: 100, g: 100, b: 100 },
          ledConditions: [{ type: 'mic-mute', color: { r: 200, g: 0, b: 0 } }]
        },
        '16': { color: { r: 255, g: 255, b: 255 } }
      },
      ledProfile: {
        mode: 'static',
        speed: 50,
        brightness: 50,
        startColor: { r: 2, g: 4, b: 6 },
        endColor: { r: 0, g: 0, b: 0 },
        direction: 'horizontal'
      }
    }),
    onUpdated: (listener: (config: Record<string, unknown>) => void) => {
      fakes.configListener = listener
    }
  }
}))

vi.mock('@main/services/logger.service', () => ({
  loggerService: { info: vi.fn(), warn: vi.fn() }
}))
vi.mock('@main/services/mic.service', () => ({ micService: fakes.mic }))
vi.mock('@main/services/discord.service', () => ({ discordService: fakes.discord }))
vi.mock('@main/services/condition.service', () => ({
  conditionService: { resolve: fakes.resolve }
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  vi.clearAllMocks()
  fakes.configListener = undefined
  fakes.devices.mockReturnValue([{ interface: 2, usage: 1, path: 'fake-hid-path' }])
  fakes.open.mockResolvedValue(fakes.device)
  fakes.device.write.mockResolvedValue(undefined)
  fakes.device.close.mockResolvedValue(undefined)
  fakes.resolve.mockReturnValue({ type: 'mic-mute', color: { r: 200, g: 0, b: 0 } })
})

test('writes a bounded 64-byte HID packet with condition and override precedence', async () => {
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  await Promise.resolve()

  const packet = fakes.device.write.mock.calls.at(-1)?.[0] as number[]
  expect(packet).toHaveLength(64)
  expect(packet.slice(0, 11)).toEqual([0x02, 0xaa, 10, 20, 30, 100, 0, 0, 1, 2, 3])
  expect(packet.slice(2 + 15 * 3, 2 + 16 * 3)).toEqual([1, 2, 3])

  await ledService.shutdown()
  expect(fakes.device.write.mock.calls.at(-1)?.[0]).toEqual([0x02, 0xaa, ...new Array(62).fill(0)])
  expect(fakes.device.close).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

test('does not reopen HID after a failed write is followed by shutdown', async () => {
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  fakes.device.write.mockRejectedValueOnce(new Error('device removed'))

  await ledService.flush()
  expect(vi.getTimerCount()).toBe(1)
  await ledService.shutdown()
  await vi.advanceTimersByTimeAsync(5_000)

  expect(fakes.open).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test('applies runtime profile, override, Home Assistant, and config updates', async () => {
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  fakes.device.write.mockClear()

  ledService.updateProfile({
    mode: 'static',
    speed: 50,
    brightness: 100,
    startColor: { r: 1, g: 2, b: 3 },
    endColor: { r: 0, g: 0, b: 0 },
    direction: 'horizontal'
  })
  ledService.updateOverrides({ '2': { color: { r: 4, g: 5, b: 6 } } })
  ledService.setHAButtonState('1', 'on', { brightness: 120 })
  await Promise.resolve()

  expect(fakes.resolve).toHaveBeenCalledWith(expect.any(Array), 'on', { brightness: 120 })
  fakes.configListener?.({ streamdeck: {}, ledProfile: undefined, gridCols: undefined })
  await ledService.shutdown()
})

test('handles missing and failing HID devices without starting animation work', async () => {
  fakes.devices.mockReturnValueOnce([]).mockImplementationOnce(() => {
    throw new Error('permission denied')
  })
  const first = await import('@main/services/led.service')
  await first.ledService.init(fakes.mic as never)
  expect(vi.getTimerCount()).toBe(0)
  await first.ledService.shutdown()

  vi.resetModules()
  const second = await import('@main/services/led.service')
  await second.ledService.init(fakes.mic as never)
  expect(vi.getTimerCount()).toBe(0)
  await second.ledService.shutdown()
})

test('draws press feedback and condition effects over the frame', async () => {
  let now = 1_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  const keyColor = (index: number): number[] => {
    const packet = fakes.device.write.mock.calls.at(-1)?.[0] as number[]
    return packet.slice(2 + index * 3, 5 + index * 3)
  }
  const profile = {
    mode: 'static' as const,
    speed: 50,
    brightness: 100,
    startColor: { r: 0, g: 0, b: 0 },
    endColor: { r: 0, g: 0, b: 0 },
    direction: 'horizontal' as const
  }

  // Without a press effect, presses are ignored.
  ledService.notifyPress(5)
  ledService.updateProfile({
    ...profile,
    pressEffect: { type: 'flash', color: { r: 0, g: 0, b: 250 } }
  })
  ledService.notifyPress(99)
  ledService.notifyPress(5)
  await Promise.resolve()
  expect(keyColor(5)).toEqual([0, 0, 250])

  now += 1_000
  await ledService.flush()
  expect(keyColor(5)).toEqual([0, 0, 0])

  fakes.resolve.mockReturnValue({
    type: 'mic-mute',
    color: { r: 200, g: 0, b: 0 },
    effect: 'blink'
  })
  ledService.updateProfile(profile)
  ledService.notifyPress(5)
  now = 2_000
  await ledService.flush()
  expect(keyColor(1)).toEqual([200, 0, 0])
  expect(keyColor(5)).toEqual([0, 0, 0])
  now = 2_500
  await ledService.flush()
  expect(keyColor(1)).toEqual([100, 100, 100])
  await ledService.shutdown()
  vi.restoreAllMocks()
})

test('blinks and pulses between the condition color and the key normal color', async () => {
  let now = 2_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  const keyColor = (index: number): number[] => {
    const packet = fakes.device.write.mock.calls.at(-1)?.[0] as number[]
    return packet.slice(2 + index * 3, 5 + index * 3)
  }
  const ledConditions = [{ type: 'mic-mute', color: { r: 200, g: 0, b: 0 } }]
  fakes.configListener?.({
    gridCols: 4,
    // Key 1 has a fixed color, key 2 shows the global effect.
    streamdeck: {
      '1': { color: { r: 100, g: 100, b: 100 }, ledConditions },
      '2': { ledConditions }
    },
    ledProfile: {
      mode: 'static',
      speed: 50,
      brightness: 100,
      startColor: { r: 0, g: 0, b: 40 },
      endColor: { r: 0, g: 0, b: 0 },
      direction: 'horizontal'
    }
  })
  const flushAt = async (time: number): Promise<void> => {
    now = time
    const writes = fakes.device.write.mock.calls.length
    await ledService.flush()
    // Every phase change reaches the device despite the duplicate-frame skip.
    expect(fakes.device.write.mock.calls.length).toBe(writes + 1)
  }

  fakes.resolve.mockReturnValue({ ...ledConditions[0], effect: 'blink' })
  await flushAt(2_000)
  expect(keyColor(1)).toEqual([200, 0, 0])
  expect(keyColor(2)).toEqual([200, 0, 0])
  await flushAt(2_500)
  expect(keyColor(1)).toEqual([100, 100, 100])
  expect(keyColor(2)).toEqual([0, 0, 40])
  await flushAt(3_000)
  expect(keyColor(2)).toEqual([200, 0, 0])

  fakes.resolve.mockReturnValue({ ...ledConditions[0], effect: 'pulse' })
  await flushAt(2_250)
  expect(keyColor(1)).toEqual([100, 100, 100])
  expect(keyColor(2)).toEqual([0, 0, 40])
  await flushAt(2_625)
  expect(keyColor(1)).toEqual([150, 50, 50])
  expect(keyColor(2)).toEqual([100, 0, 20])
  await ledService.shutdown()
  vi.restoreAllMocks()
})

test('streams preview frames without a device only while the preview is active', async () => {
  fakes.devices.mockReturnValue([])
  const { ledService } = await import('@main/services/led.service')
  const frames = vi.fn()
  ledService.onFrame(frames)
  await ledService.init(fakes.mic as never)
  expect(vi.getTimerCount()).toBe(0)

  ledService.setPreviewActive(true)
  ledService.setPreviewActive(true)
  await vi.advanceTimersByTimeAsync(100)
  expect(vi.getTimerCount()).toBe(1)
  expect(frames.mock.calls.at(-1)?.[0]).toHaveLength(16)
  expect(fakes.device.write).not.toHaveBeenCalled()

  ledService.setPreviewActive(false)
  frames.mockClear()
  await ledService.flush()
  expect(frames).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
  await ledService.shutdown()
})

test('keeps the preview running when the device write fails', async () => {
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  ledService.setPreviewActive(true)
  fakes.device.write.mockRejectedValueOnce(new Error('device removed'))

  ledService.updateOverrides({})
  await ledService.flush()
  // Animation plus the reconnect timer.
  expect(vi.getTimerCount()).toBe(2)
  await ledService.shutdown()
  expect(vi.getTimerCount()).toBe(0)
})

test('forces a tested condition over real conditions until it expires or is cleared', async () => {
  let now = 10_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  const keyColor = (index: number): number[] => {
    const packet = fakes.device.write.mock.calls.at(-1)?.[0] as number[]
    return packet.slice(2 + index * 3, 5 + index * 3)
  }
  ledService.updateProfile({
    mode: 'static',
    speed: 50,
    brightness: 100,
    startColor: { r: 0, g: 0, b: 0 },
    endColor: { r: 0, g: 0, b: 0 },
    direction: 'horizontal'
  })

  // Out-of-range keys are ignored.
  ledService.testCondition(16, { r: 9, g: 9, b: 9 })
  ledService.testCondition(1.5, { r: 9, g: 9, b: 9 })
  await ledService.flush()
  expect(keyColor(1)).toEqual([200, 0, 0])

  // The test starts lit and replaces the key's active condition.
  ledService.testCondition(1, { r: 0, g: 250, b: 0 }, 'blink')
  await Promise.resolve()
  expect(keyColor(1)).toEqual([0, 250, 0])
  now += 500
  await ledService.flush()
  expect(keyColor(1)).toEqual([100, 100, 100])
  expect(keyColor(0)).toEqual([20, 40, 60])

  // It ends on its own after five seconds.
  now = 15_000
  await ledService.flush()
  expect(keyColor(1)).toEqual([200, 0, 0])

  ledService.testCondition(0, { r: 0, g: 0, b: 250 })
  await Promise.resolve()
  expect(keyColor(0)).toEqual([0, 0, 250])
  ledService.clearConditionTest()
  await Promise.resolve()
  expect(keyColor(0)).toEqual([20, 40, 60])

  fakes.device.write.mockClear()
  ledService.clearConditionTest()
  expect(fakes.device.write).not.toHaveBeenCalled()
  await ledService.shutdown()
  vi.restoreAllMocks()
})

test('skips unchanged packets but resends them every second and after updates', async () => {
  let now = 1_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  expect(fakes.device.write).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(500)
  now += 999
  await ledService.flush()
  expect(fakes.device.write).toHaveBeenCalledTimes(1)

  now += 1
  await ledService.flush()
  expect(fakes.device.write).toHaveBeenCalledTimes(2)
  await ledService.flush()
  expect(fakes.device.write).toHaveBeenCalledTimes(2)

  ledService.updateProfile({
    mode: 'static',
    speed: 50,
    brightness: 50,
    startColor: { r: 2, g: 4, b: 6 },
    endColor: { r: 0, g: 0, b: 0 },
    direction: 'horizontal'
  })
  await ledService.flush()
  expect(fakes.device.write).toHaveBeenCalledTimes(3)

  ledService.updateOverrides({ '0': { color: { r: 20, g: 40, b: 60 } } })
  await ledService.flush()
  expect(fakes.device.write).toHaveBeenCalledTimes(4)

  await ledService.shutdown()
  expect(fakes.device.write).toHaveBeenCalledTimes(5)
  expect(fakes.device.write.mock.calls.at(-1)?.[0]).toEqual([0x02, 0xaa, ...new Array(62).fill(0)])
  vi.restoreAllMocks()
})

test('writes the unchanged frame again after reconnecting', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(1_000)
  const { ledService } = await import('@main/services/led.service')
  await ledService.init(fakes.mic as never)
  const packet = fakes.device.write.mock.calls.at(-1)?.[0]
  fakes.device.write.mockClear()
  fakes.device.write.mockRejectedValueOnce(new Error('device removed'))

  ledService.updateOverrides({ '0': { color: { r: 20, g: 40, b: 60 } } })
  await ledService.flush()
  expect(fakes.device.write).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(5_000)
  expect(fakes.open).toHaveBeenCalledTimes(2)
  expect(fakes.device.write).toHaveBeenCalledTimes(2)
  expect(fakes.device.write.mock.calls.at(-1)?.[0]).toEqual(packet)

  await vi.advanceTimersByTimeAsync(100)
  expect(fakes.device.write).toHaveBeenCalledTimes(2)
  await ledService.shutdown()
  vi.restoreAllMocks()
})

test('emits preview frames only when the colors change', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(1_000)
  fakes.devices.mockReturnValue([])
  const { ledService } = await import('@main/services/led.service')
  const frames = vi.fn()
  ledService.onFrame(frames)
  await ledService.init(fakes.mic as never)

  ledService.setPreviewActive(true)
  await vi.advanceTimersByTimeAsync(200)
  expect(frames).toHaveBeenCalledTimes(1)

  // A reopened preview needs the current frame.
  ledService.setPreviewActive(false)
  ledService.setPreviewActive(true)
  await vi.advanceTimersByTimeAsync(100)
  expect(frames).toHaveBeenCalledTimes(2)

  ledService.updateOverrides({ '3': { color: { r: 8, g: 8, b: 8 } } })
  await vi.advanceTimersByTimeAsync(100)
  expect(frames).toHaveBeenCalledTimes(3)
  expect(frames.mock.calls.at(-1)?.[0][3]).toEqual({ r: 4, g: 4, b: 4 })
  await ledService.shutdown()
  vi.restoreAllMocks()
})

test('writes the first frame of a condition test and the frame that ends it at once', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(1_000)
  const { ledService } = await import('@main/services/led.service')
  const frames = vi.fn()
  ledService.onFrame(frames)
  await ledService.init(fakes.mic as never)
  ledService.setPreviewActive(true)
  await ledService.flush()
  fakes.device.write.mockClear()
  frames.mockClear()
  const keyColor = (index: number): number[] => {
    const packet = fakes.device.write.mock.calls.at(-1)?.[0] as number[]
    return packet.slice(2 + index * 3, 5 + index * 3)
  }

  // The unchanged frame is skipped before and while the test runs.
  await ledService.flush()
  expect(fakes.device.write).not.toHaveBeenCalled()
  expect(frames).not.toHaveBeenCalled()

  ledService.testCondition(0, { r: 0, g: 250, b: 0 })
  await Promise.resolve()
  expect(fakes.device.write).toHaveBeenCalledTimes(1)
  expect(keyColor(0)).toEqual([0, 125, 0])
  expect(frames).toHaveBeenCalledTimes(1)
  expect(frames.mock.calls.at(-1)?.[0][0]).toEqual({ r: 0, g: 125, b: 0 })
  await ledService.flush()
  expect(fakes.device.write).toHaveBeenCalledTimes(1)
  expect(frames).toHaveBeenCalledTimes(1)

  ledService.clearConditionTest()
  await Promise.resolve()
  expect(fakes.device.write).toHaveBeenCalledTimes(2)
  expect(keyColor(0)).toEqual([10, 20, 30])
  expect(frames).toHaveBeenCalledTimes(2)
  expect(frames.mock.calls.at(-1)?.[0][0]).toEqual({ r: 10, g: 20, b: 30 })
  await ledService.shutdown()
  vi.restoreAllMocks()
})
