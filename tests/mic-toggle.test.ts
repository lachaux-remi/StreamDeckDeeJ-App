import { beforeEach, expect, test, vi } from 'vitest'

const fakes = vi.hoisted(() => ({ run: vi.fn(), warn: vi.fn() }))

vi.mock('@main/services/audio-command', async (importOriginal) => {
  const original = await importOriginal<typeof import('@main/services/audio-command')>()
  return { ...original, commandRunner: { run: fakes.run } }
})

vi.mock('@main/services/audio-subscription', () => ({
  PactlSubscription: class {
    start = vi.fn()
    stop = vi.fn()
  }
}))

vi.mock('@main/services/logger.service', () => ({
  loggerService: { debug: vi.fn(), info: vi.fn(), warn: fakes.warn, error: vi.fn() }
}))

beforeEach(() => {
  vi.resetModules()
  fakes.run.mockReset()
  fakes.warn.mockReset()
})

test('toggles the default source and refreshes the mute state right away', async () => {
  let muted = false
  fakes.run.mockImplementation(async (_command: string, args: string[]) => {
    if (args[0] === 'set-source-mute') {
      muted = !muted
      return ''
    }
    return `Mute: ${muted ? 'yes' : 'no'}`
  })
  const { micService } = await import('@main/services/mic.service')
  await micService.init()
  const changed = vi.fn()
  micService.on('change', changed)

  await micService.toggleMute()
  await vi.waitFor(() => expect(micService.isMuted()).toBe(true))

  expect(fakes.run).toHaveBeenCalledWith(
    'pactl',
    ['set-source-mute', '@DEFAULT_SOURCE@', 'toggle'],
    2000
  )
  expect(changed).toHaveBeenCalledWith(true)
})

test('logs instead of throwing when pactl cannot toggle the microphone', async () => {
  fakes.run.mockRejectedValue(new Error('pactl missing'))
  const { micService } = await import('@main/services/mic.service')

  await expect(micService.toggleMute()).resolves.toBeUndefined()
  expect(fakes.warn).toHaveBeenCalledWith(expect.stringContaining('pactl missing'), 'MicService')
})
