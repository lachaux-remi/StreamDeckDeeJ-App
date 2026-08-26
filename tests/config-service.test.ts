import { expect, test, vi } from 'vitest'
import { applySettingsDefaults, defaultSettings } from '@main/services/settings-defaults'
import { defaultSettings as rendererDefaults } from '@renderer/stores/settings.defaults'
import { defaultSerialPort } from '../src/shared/platform-defaults'

test('uses a Linux serial default without leaking that path into Windows', () => {
  expect(defaultSerialPort('linux')).toBe('/dev/ttyACM0')
  expect(defaultSerialPort('windows')).toBe('')
  expect(defaultSerialPort('win32')).toBe('')
  expect(defaultSettings.comPort).toBe(defaultSerialPort(process.platform))
  expect(rendererDefaults.comPort).toBe('/dev/ttyACM0')

  expect(defaultSettings).toMatchObject({ baudRate: 115200, sliderCount: 5 })
  expect(rendererDefaults).toMatchObject({ baudRate: 115200, sliderCount: 5 })
})

test('defaults preserve an existing compatible controller configuration', () => {
  const existing = {
    comPort: '/dev/ttyUSB7',
    baudRate: 9600,
    sliderCount: 4
  }

  expect(applySettingsDefaults(existing)).toMatchObject(existing)
})

test('renderer starts with no Linux serial path on Windows before hydration', async () => {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })
  vi.resetModules()

  const { defaultSettings: windowsRendererDefaults } =
    await import('@renderer/stores/settings.defaults')

  expect(windowsRendererDefaults.comPort).toBe('')
  vi.unstubAllGlobals()
})
