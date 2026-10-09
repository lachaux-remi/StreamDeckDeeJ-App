import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  getConfig: vi.fn(),
  onUpdated: vi.fn(),
  callService: vi.fn(),
  api: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@main/services/config.service', () => ({
  configService: { getConfig: fakes.getConfig }
}))
vi.mock('@main/services/logger.service', () => ({ loggerService: { warn: fakes.warn } }))
vi.mock('@main/services/slider.service', () => ({
  sliderService: { onUpdated: fakes.onUpdated }
}))
vi.mock('@main/libs/home-assistant/HomeAssistantAPI', () => ({
  default: class {
    constructor(url: string, token: string) {
      fakes.api(url, token)
    }
    callService = fakes.callService
  }
}))

const { HomeAssistantSliders, sliderServiceCall, startHomeAssistantSliders } =
  await import('@main/services/home-assistant-sliders')

const config = {
  homeAssistant: { url: 'http://ha.local:8123', token: 'fixture-token' },
  deej: { '0': ['master', 'ha:light.desk', 'ha:switch.ignored'], '1': ['ha:media_player.salon'] }
}

function deferred(): { promise: Promise<unknown>; resolve: () => void; reject: () => void } {
  let resolve!: () => void
  let reject!: () => void
  const promise = new Promise<unknown>((ok, fail) => {
    resolve = () => ok(undefined)
    reject = () => fail(new Error('offline'))
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.useFakeTimers()
})

test('maps slider positions to the service of each supported domain', () => {
  expect(sliderServiceCall('light.desk', 0)).toEqual({ service: 'light.turn_off' })
  expect(sliderServiceCall('light.desk', 0.427)).toEqual({
    service: 'light.turn_on',
    data: { brightness_pct: 43 }
  })
  expect(sliderServiceCall('media_player.salon', 0.5)).toEqual({
    service: 'media_player.volume_set',
    data: { volume_level: 0.5 }
  })
  expect(sliderServiceCall('fan.room', 0)).toEqual({ service: 'fan.turn_off' })
  expect(sliderServiceCall('fan.room', 1.2)).toEqual({
    service: 'fan.set_percentage',
    data: { percentage: 100 }
  })
  expect(sliderServiceCall('cover.blind', 0.3)).toEqual({
    service: 'cover.set_cover_position',
    data: { position: 30 }
  })
  expect(sliderServiceCall('switch.desk', 1)).toBeUndefined()
})

test('ignores the startup position and only sends movements of mapped sliders', () => {
  const callService = vi.fn().mockResolvedValue([])
  const sliders = new HomeAssistantSliders({ getConfig: () => config, callService })

  sliders.update({ '0': 0.2, '1': 0.4 })
  expect(callService).not.toHaveBeenCalled()

  sliders.update({ '0': 0.2, '1': 0.6 })
  expect(callService).toHaveBeenCalledTimes(1)
  expect(callService).toHaveBeenCalledWith('media_player.volume_set', 'media_player.salon', {
    volume_level: 0.6
  })

  sliders.update({ '0': 0.5, '1': 0.6 })
  expect(callService).toHaveBeenLastCalledWith('light.turn_on', 'light.desk', {
    brightness_pct: 50
  })
  expect(callService).toHaveBeenCalledTimes(2)
  sliders.shutdown()
})

test('rate limits each entity and always ends on the latest position', async () => {
  const first = deferred()
  const callService = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue([])
  const sliders = new HomeAssistantSliders({ getConfig: () => config, callService })
  sliders.update({ '0': 0.1 })

  sliders.update({ '0': 0.2 })
  sliders.update({ '0': 0.3 })
  sliders.update({ '0': 0.4 })
  expect(callService).toHaveBeenCalledTimes(1)

  first.resolve()
  await vi.advanceTimersByTimeAsync(249)
  expect(callService).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(callService).toHaveBeenCalledTimes(2)
  expect(callService).toHaveBeenLastCalledWith('light.turn_on', 'light.desk', {
    brightness_pct: 40
  })

  // Rounding to the same percentage does not resend.
  await vi.advanceTimersByTimeAsync(250)
  sliders.update({ '0': 0.401 })
  await vi.advanceTimersByTimeAsync(250)
  expect(callService).toHaveBeenCalledTimes(2)
  sliders.shutdown()
})

test('logs failures, retries the same position on the next movement and stops on shutdown', async () => {
  const failure = deferred()
  const callService = vi.fn().mockReturnValueOnce(failure.promise).mockResolvedValue([])
  const log = vi.fn()
  const sliders = new HomeAssistantSliders({ getConfig: () => config, callService, log })
  sliders.update({ '1': 0.1 })
  sliders.update({ '1': 0.5 })

  failure.reject()
  await vi.advanceTimersByTimeAsync(250)
  expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('offline'))

  sliders.update({ '1': 0.501 })
  expect(callService).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(250)

  sliders.update({ '1': 0.9 })
  sliders.shutdown()
  sliders.update({ '1': 0.2 })
  await vi.advanceTimersByTimeAsync(1_000)
  expect(callService).toHaveBeenCalledTimes(3)
  expect(vi.getTimerCount()).toBe(0)
})

test('does nothing without a Home Assistant connection', () => {
  const callService = vi.fn()
  const sliders = new HomeAssistantSliders({
    getConfig: () => ({ ...config, homeAssistant: { url: '', token: '' } }),
    callService
  })
  sliders.update({ '0': 0.1 })
  sliders.update({ '0': 0.9 })
  expect(callService).not.toHaveBeenCalled()
})

test('wires slider movements to the Home Assistant REST API from the stored settings', async () => {
  fakes.getConfig.mockReturnValue(config)
  fakes.callService.mockRejectedValue(new Error('unreachable'))
  const sliders = startHomeAssistantSliders()
  const onSliders = fakes.onUpdated.mock.calls[0][0] as (values: Record<string, number>) => void

  onSliders({ '0': 0.1 })
  onSliders({ '0': 0.7 })
  await vi.advanceTimersByTimeAsync(0)

  expect(fakes.api).toHaveBeenCalledWith('http://ha.local:8123', 'fixture-token')
  expect(fakes.callService).toHaveBeenCalledWith('light.turn_on', 'light.desk', {
    brightness_pct: 70
  })
  expect(fakes.warn).toHaveBeenCalledWith(
    expect.stringContaining('unreachable'),
    'HomeAssistantSliders'
  )
  // Shutdown cancels the pending rate-limit timer.
  expect(vi.getTimerCount()).toBe(1)
  sliders.shutdown()
  expect(vi.getTimerCount()).toBe(0)
})
