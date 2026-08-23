import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({
  run: vi.fn(),
  sliderListener: undefined as ((sliders: Record<string, number>) => void) | undefined,
  subscriptionStart: vi.fn(),
  getConfig: vi.fn(),
  error: vi.fn()
}))

vi.mock('@main/services/audio-command', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@main/services/audio-command')>()
  return { ...actual, commandRunner: { run: fakes.run } }
})
vi.mock('@main/services/audio-subscription', () => ({
  PactlSubscription: class {
    start = fakes.subscriptionStart
  }
}))
vi.mock('@main/services/slider.service', () => ({
  sliderService: {
    on: (_event: string, listener: (sliders: Record<string, number>) => void) => {
      fakes.sliderListener = listener
    },
    getSliders: () => ({ '0': 0.4 })
  }
}))
vi.mock('@main/services/config.service', () => ({
  configService: { getConfig: fakes.getConfig }
}))
vi.mock('@main/services/logger.service', () => ({
  loggerService: { debug: vi.fn(), error: fakes.error }
}))

const pipeWireDump = JSON.stringify([
  {
    id: 7,
    type: 'PipeWire:Interface:Client',
    info: { props: { 'application.name': 'Spotify' } }
  },
  {
    id: 42,
    type: 'PipeWire:Interface:Node',
    info: {
      props: { 'media.class': 'Stream/Output/Audio', 'client.id': 7 },
      params: { Props: [{ channelVolumes: [0.25, 0.5] }] }
    }
  }
])

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  vi.clearAllMocks()
  fakes.sliderListener = undefined
  fakes.getConfig.mockReturnValue({ deej: { '0': ['Spotify'], '1': ['master'] } })
  fakes.run.mockImplementation(async (file: string) => {
    if (file === 'pw-dump') {
      return pipeWireDump
    }
    if (file === 'wpctl') {
      return 'Volume: 0.75'
    }
    return ''
  })
})

test('discovers PipeWire clients, deduplicates names, and reads configured OS volumes', async () => {
  const { sessionsService } = await import('@main/services/sessions.service')

  await expect(sessionsService.getAllSessions()).resolves.toEqual(['master', 'spotify'])
  await expect(sessionsService.getOsVolumes()).resolves.toEqual({ '0': 0.5, '1': 0.75 })
  expect(fakes.subscriptionStart).toHaveBeenCalledOnce()
  expect(fakes.run).toHaveBeenCalledWith('pw-dump', ['--no-colors'], 5000)
  vi.clearAllTimers()
})

test('falls back to pactl discovery and master volume when PipeWire commands fail', async () => {
  fakes.run.mockImplementation(async (file: string, args: readonly string[]) => {
    if (file === 'pw-dump') {
      throw new Error('missing')
    }
    if (file === 'pactl' && args[0] === 'list') {
      return 'Sink Input #12\n application.process.binary = "Firefox"\n Volume: 40%'
    }
    if (file === 'wpctl') {
      throw new Error('missing')
    }
    if (file === 'pactl' && args[0] === 'get-sink-volume') {
      return 'front-left: 32768 / 60%'
    }
    return ''
  })
  fakes.getConfig.mockReturnValue({ deej: { '0': ['Firefox'], '1': ['master'] } })
  const { sessionsService } = await import('@main/services/sessions.service')

  await expect(sessionsService.getAllSessions()).resolves.toEqual(['master', 'firefox'])
  await expect(sessionsService.getOsVolumes()).resolves.toEqual({ '0': 0.4, '1': 0.6 })
  vi.clearAllTimers()
})

test('routes slider batches to all matching sessions and tolerates command failures', async () => {
  const { sessionsService } = await import('@main/services/sessions.service')
  await sessionsService.getAllSessions()
  fakes.run.mockRejectedValue(new Error('audio command failed'))

  fakes.sliderListener?.({ '0': 0.33 })
  await Promise.resolve()
  await Promise.resolve()

  expect(fakes.run).toHaveBeenCalledWith('wpctl', ['set-volume', '42', '33%'], 2000)
  vi.clearAllTimers()
})
