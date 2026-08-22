import assert from 'node:assert/strict'
import test from 'node:test'
import type { AppSettings } from '../types/settings.types.ts'
import { toRendererSettings } from './renderer-settings.ts'

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

  assert.deepEqual(rendererSettings.homeAssistant, {
    url: 'https://example.invalid',
    tokenConfigured: true
  })
  assert.deepEqual(rendererSettings.discord, {
    clientId: 'fixture-client',
    clientSecretConfigured: true,
    authenticated: true
  })
  assert.doesNotMatch(JSON.stringify(rendererSettings), new RegExp(fixtureSecret))
})
