import { expect, test } from 'vitest'
import { applySettingsDefaults, defaultSettings } from '@main/services/settings-defaults'
import { defaultSettings as rendererDefaults } from '@renderer/stores/settings.defaults'

test('main and renderer propose the official firmware defaults to new users', () => {
  const expected = {
    comPort: '/dev/ttyACM0',
    baudRate: 115200,
    sliderCount: 5
  }

  expect(defaultSettings).toMatchObject(expected)
  expect(rendererDefaults).toMatchObject(expected)
})

test('defaults preserve an existing compatible controller configuration', () => {
  const existing = {
    comPort: '/dev/ttyUSB7',
    baudRate: 9600,
    sliderCount: 4
  }

  expect(applySettingsDefaults(existing)).toMatchObject(existing)
})
