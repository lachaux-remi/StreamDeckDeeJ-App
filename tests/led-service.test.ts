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
  expect(keyColor(1)).toEqual([0, 0, 0])
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

  await ledService.flush()
  // Animation plus the reconnect timer.
  expect(vi.getTimerCount()).toBe(2)
  await ledService.shutdown()
  expect(vi.getTimerCount()).toBe(0)
})
