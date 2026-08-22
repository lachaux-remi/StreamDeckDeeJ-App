import { expect, test } from 'vitest'
import { toRendererSettings } from '@main/services/renderer-settings'
import type { AppSettings } from '@main/types/settings.types'

test('renderer settings expose secret state but never secret values', () => {
  const fixtureSecret = 'synthetic-fixture-value'
  const settings: AppSettings = {
    comPort: '',
    baudRate: 9600,
    gridCols: 4,
    gridRows: 4,
    sliderCount: 4,
    streamdeck: {},
    deej: {},
    deejNames: {},
    invertSliders: false,
    runOnStartup: false,
    runInBackground: false,
    closeToTray: true,
    devTools: false,
    homeAssistant: { url: 'https://example.invalid', token: fixtureSecret },
    ledProfile: {
      mode: 'rainbow',
      speed: 50,
      brightness: 80,
      startColor: { r: 0, g: 0, b: 255 },
      endColor: { r: 255, g: 0, b: 255 },
      direction: 'horizontal'
    },
    discord: {
      clientId: 'fixture-client',
      clientSecret: fixtureSecret,
      accessToken: fixtureSecret,
      refreshToken: fixtureSecret
    }
  }

  const rendererSettings = toRendererSettings(settings)

  expect(rendererSettings.homeAssistant).toEqual({
    url: 'https://example.invalid',
    tokenConfigured: true
  })
  expect(rendererSettings.discord).toEqual({
    clientId: 'fixture-client',
    clientSecretConfigured: true,
    authenticated: true
  })
  expect(JSON.stringify(rendererSettings)).not.toMatch(new RegExp(fixtureSecret))
})
