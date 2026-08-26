import { expect, test, vi } from 'vitest'
import { createPlatformRuntime } from '@main/platform-runtime'
import { buildWindowsHardwareDiagnostic } from '@main/services/windows-hardware.service'

test('uses explicit Windows capabilities without loading Linux services', async () => {
  const loadLinux = vi.fn()
  const windowsSessions = {
    getAllSessions: vi.fn().mockResolvedValue(['master', 'spotify.exe']),
    getOsVolumes: vi.fn().mockResolvedValue({ '0': 0.5 }),
    shutdown: vi.fn()
  }
  const loadWindowsAudio = vi.fn().mockResolvedValue(windowsSessions)
  const windowsUpdater = {
    init: vi.fn(),
    getState: vi.fn(() => ({
      mode: 'nsis' as const,
      status: 'idle' as const,
      currentVersion: '4.0.6'
    })),
    onStateChanged: vi.fn(),
    check: vi.fn(),
    download: vi.fn(),
    install: vi.fn(),
    openRelease: vi.fn()
  }
  const loadWindowsUpdater = vi.fn().mockResolvedValue(windowsUpdater)
  const diagnoseWindowsHardware = vi.fn().mockResolvedValue({
    platform: 'windows',
    hid: 'not-detected',
    serial: 'not-detected'
  })
  const setLoginItemSettings = vi.fn()

  const runtime = await createPlatformRuntime('win32', {
    loadLinux,
    loadWindowsAudio,
    loadWindowsUpdater,
    diagnoseWindowsHardware,
    setLoginItemSettings
  })

  expect(loadLinux).not.toHaveBeenCalled()
  expect(loadWindowsAudio).toHaveBeenCalledOnce()
  expect(runtime.audio.available).toBe(true)
  await expect(runtime.audio.sessions.getAllSessions()).resolves.toEqual(['master', 'spotify.exe'])
  await expect(runtime.audio.sessions.getOsVolumes()).resolves.toEqual({ '0': 0.5 })
  expect(loadWindowsUpdater).toHaveBeenCalledOnce()
  expect(runtime.updater).toBe(windowsUpdater)
  await expect(runtime.hardwarePermissions.diagnose()).resolves.toEqual({
    platform: 'windows',
    hid: 'not-detected',
    serial: 'not-detected'
  })

  await runtime.setAutostart(true)
  expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true })
  await runtime.shutdown()
  expect(windowsSessions.shutdown).toHaveBeenCalledOnce()
})

test('delegates Linux unchanged to the Linux runtime loader', async () => {
  const linuxRuntime = { audio: { available: true } }
  const loadLinux = vi.fn().mockResolvedValue(linuxRuntime)
  const diagnoseWindowsHardware = vi.fn()

  await expect(
    createPlatformRuntime('linux', { loadLinux, diagnoseWindowsHardware })
  ).resolves.toBe(linuxRuntime)
  expect(loadLinux).toHaveBeenCalledOnce()
  expect(diagnoseWindowsHardware).not.toHaveBeenCalled()
})

test('reports Windows hardware presence without Linux permission fields', () => {
  expect(
    buildWindowsHardwareDiagnostic(
      [{ path: '\\\\.\\HID#VID_5239&PID_0001', interface: 2, usage: 1 }],
      [{ path: 'COM7', vendorId: '5239', productId: '0001' }]
    )
  ).toEqual({ platform: 'windows', hid: 'detected', serial: 'detected' })

  const absent = buildWindowsHardwareDiagnostic(
    [],
    [{ path: 'COM8', vendorId: '1234', productId: '5678' }]
  )
  expect(absent).toEqual({
    platform: 'windows',
    hid: 'not-detected',
    serial: 'not-detected'
  })
  expect(JSON.stringify(absent)).not.toMatch(/udev|pkexec|manualCommand|rule/)
  expect(
    buildWindowsHardwareDiagnostic(
      [{ path: '\\\\.\\HID#VID_5239&PID_0001', interface: 0, usage: 1 }],
      []
    ).hid
  ).toBe('not-detected')
})
