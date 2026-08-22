import { expect, test } from 'vitest'
import { toRendererSettings } from '@main/services/renderer-settings'
import { defaultSettings } from '@main/services/settings-defaults'
import {
  isAppSettings,
  isRendererSettingsUpdate,
  type RendererSettingsUpdate
} from '@main/types/settings.types'
import { isRendererSettings } from '@renderer/types/settings.types'

function rendererUpdate(url: string): RendererSettingsUpdate {
  const settings = toRendererSettings(defaultSettings)
  settings.homeAssistant.url = url
  return {
    settings,
    secrets: {
      homeAssistantToken: { action: 'unchanged' },
      discordClientSecret: { action: 'unchanged' },
      discordTokens: 'unchanged'
    }
  }
}

test.each(['', 'http://homeassistant.local:8123', 'https://ha.example/subpath'])(
  'accepts a supported Home Assistant endpoint at every settings boundary: %s',
  (url) => {
    const persisted = structuredClone(defaultSettings)
    persisted.homeAssistant.url = url
    const update = rendererUpdate(url)

    expect(isAppSettings(persisted)).toBe(true)
    expect(isRendererSettingsUpdate(update)).toBe(true)
    expect(isRendererSettings(update.settings)).toBe(true)
  }
)

test.each([
  'homeassistant.local:8123',
  'javascript:alert(1)',
  'ftp://ha.example',
  'https://user:password@ha.example',
  'https://ha.example?redirect=https://other.example',
  'https://ha.example/#fragment',
  ' https://ha.example'
])('rejects an unsafe Home Assistant endpoint at every settings boundary: %s', (url) => {
  const persisted = structuredClone(defaultSettings)
  persisted.homeAssistant.url = url
  const update = rendererUpdate(url)

  expect(isAppSettings(persisted)).toBe(false)
  expect(isRendererSettingsUpdate(update)).toBe(false)
  expect(isRendererSettings(update.settings)).toBe(false)
})
