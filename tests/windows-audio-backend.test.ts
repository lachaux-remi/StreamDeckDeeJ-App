import { expect, test, vi } from 'vitest'
import {
  WindowsAudioSessions,
  type WindowsAudioNativeBinding
} from '@main/services/windows-audio.service'

function nativeBinding(): WindowsAudioNativeBinding {
  return {
    snapshot: vi.fn(() => ({
      master: { volume: 0.8, muted: false },
      sessions: [
        { processId: 42, name: 'Spötify.exe', volume: 0.4, muted: false },
        { processId: 43, name: 'SPÖTIFY.EXE', volume: 0.6, muted: true },
        { processId: 99, name: '', volume: 0.2, muted: false }
      ]
    })),
    setVolume: vi.fn(),
    setMuted: vi.fn()
  }
}

test('discovers current-domain names and controls every matching Windows process', async () => {
  const native = nativeBinding()
  const sessions = new WindowsAudioSessions(native)

  await expect(sessions.getAllSessions()).resolves.toEqual(['master', 'spötify.exe', 'pid: 99'])
  await sessions.setVolume('Spötify.exe', 0)
  await sessions.setMuted('SPÖTIFY.EXE', true)
  await sessions.setVolume('master', 1)
  await sessions.setMuted('MASTER', false)

  expect(native.setVolume).toHaveBeenNthCalledWith(1, { kind: 'process', processId: 42 }, 0)
  expect(native.setVolume).toHaveBeenNthCalledWith(2, { kind: 'process', processId: 43 }, 0)
  expect(native.setMuted).toHaveBeenNthCalledWith(1, { kind: 'process', processId: 42 }, true)
  expect(native.setMuted).toHaveBeenNthCalledWith(2, { kind: 'process', processId: 43 }, true)
  expect(native.setVolume).toHaveBeenNthCalledWith(3, { kind: 'master' }, 1)
  expect(native.setMuted).toHaveBeenNthCalledWith(3, { kind: 'master' }, false)
  await expect(sessions.setVolume('master', -0.01)).rejects.toThrow('finite number from 0 to 1')
  await expect(sessions.setVolume('master', Number.NaN)).rejects.toThrow(
    'finite number from 0 to 1'
  )

  sessions.shutdown()
})

test('reads configured Windows session volumes through the platform capability', async () => {
  const sessions = new WindowsAudioSessions(nativeBinding(), {
    getAssignments: () => ({
      '0': ['Spötify.exe'],
      '1': ['master'],
      '2': [],
      '3': ['missing.exe']
    })
  })

  await expect(sessions.getOsVolumes()).resolves.toEqual({ '0': 0.4, '1': 0.8 })

  sessions.shutdown()
})

test('bounded polling reapplies current sliders when a Windows process appears', () => {
  vi.useFakeTimers()
  const native = nativeBinding()
  const snapshot = vi.mocked(native.snapshot)
  const sessions = new WindowsAudioSessions(native, {
    getAssignments: () => ({ '0': ['game.exe'] }),
    getSliders: () => ({ '0': 0.3 }),
    pollIntervalMs: 250
  })

  vi.advanceTimersByTime(250)
  expect(native.setVolume).not.toHaveBeenCalled()

  snapshot.mockReturnValue({
    master: { volume: 0.8, muted: false },
    sessions: [{ processId: 77, name: 'Game.exe', volume: 1, muted: false }]
  })
  vi.advanceTimersByTime(250)
  expect(native.setVolume).toHaveBeenCalledWith({ kind: 'process', processId: 77 }, 0.3)

  sessions.shutdown()
  vi.advanceTimersByTime(1_000)
  expect(snapshot).toHaveBeenCalledTimes(2)
  expect(() => new WindowsAudioSessions(native, { pollIntervalMs: 249 })).toThrow(
    'between 250 and 5000'
  )
  vi.useRealTimers()
})

test('reports native slider-write failures without escaping the serial event listener', () => {
  const native = nativeBinding()
  const onError = vi.fn()
  vi.mocked(native.setVolume).mockImplementation(() => {
    throw new Error('SetMasterVolume failed (HRESULT 0x80004005)')
  })
  const sessions = new WindowsAudioSessions(native, {
    getAssignments: () => ({ '0': ['master'] }),
    onError
  })

  expect(() => sessions.updateSliders({ '0': 0.5 })).not.toThrow()
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('HRESULT 0x80004005') })
  )

  vi.mocked(native.snapshot).mockImplementationOnce(() => {
    throw new Error('GetDefaultAudioEndpoint failed (HRESULT 0x80070490)')
  })
  expect(() => sessions.updateSliders({ '0': 0.5 })).not.toThrow()
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('HRESULT 0x80070490') })
  )

  sessions.shutdown()
})

test('unsubscribes from slider events when the Windows runtime shuts down', () => {
  const native = nativeBinding()
  const unsubscribe = vi.fn()
  let listener: ((sliders: Record<string, number>) => void) | undefined
  const sessions = new WindowsAudioSessions(native, {
    getAssignments: () => ({ '0': ['master'] }),
    onSlidersUpdated: (candidate) => {
      listener = candidate
      return unsubscribe
    }
  })

  listener?.({ '0': 0.25 })
  expect(native.setVolume).toHaveBeenCalledWith({ kind: 'master' }, 0.25)

  sessions.shutdown()
  expect(unsubscribe).toHaveBeenCalledOnce()
})
