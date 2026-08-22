import assert from 'node:assert/strict'
import test from 'node:test'
import { toRendererSettings } from './renderer-settings.ts'

test('renderer settings expose secret state but never secret values', () => {
  const fixtureSecret = 'synthetic-fixture-value'
  const settings = {
    comPort: '',
    homeAssistant: { url: 'https://example.invalid', token: fixtureSecret },
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
