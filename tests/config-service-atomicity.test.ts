import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, test, vi } from 'vitest'
import { ConfigService } from '@main/services/config.service'
import { defaultSettings } from '@main/services/settings-defaults'

const userDataPath = mkdtempSync(join(tmpdir(), 'streamdeck-deej-config-'))
const configPath = join(userDataPath, 'config.json')
const fixtureSecret = 'synthetic-legacy-secret'

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath },
  safeStorage: {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString()
  }
}))

beforeEach(() => {
  rmSync(configPath, { force: true })
})

test('loads a legacy brightness state without exposing secrets and removes it on the next save', () => {
  const expectedSettings = {
    ...structuredClone(defaultSettings),
    comPort: '/dev/ttyUSB7',
    runInBackground: true,
    homeAssistant: { url: 'https://ha.example', token: fixtureSecret },
    discord: {
      clientId: 'legacy-client',
      clientSecret: fixtureSecret,
      accessToken: fixtureSecret,
      refreshToken: fixtureSecret
    }
  }
  const legacySettings = {
    ...expectedSettings,
    brightnessState: { livingRoom: 40 }
  }
  const originalFile = JSON.stringify(legacySettings, null, 2)
  writeFileSync(configPath, originalFile, { mode: 0o600 })

  const service = new ConfigService()
  service.init()

  expect(service.getConfig()).toEqual(expectedSettings)
  expect(readFileSync(configPath, 'utf8')).toBe(originalFile)
  expect(JSON.stringify(service.getRendererConfig())).not.toContain(fixtureSecret)

  service.setConfig({ closeToTray: false })

  const stored = readFileSync(configPath, 'utf8')
  expect(stored).not.toContain('brightnessState')
  expect(stored).not.toContain(fixtureSecret)
  const reloaded = new ConfigService()
  reloaded.init()
  expect(reloaded.getConfig()).toEqual({ ...expectedSettings, closeToTray: false })
})

test.each([
  ['an arbitrary unknown key', { unexpected: true }],
  ['another invalid setting', { gridCols: 0 }]
])('preserves the original file when legacy settings contain %s', (_case, invalidSettings) => {
  const storedSettings = {
    ...structuredClone(defaultSettings),
    homeAssistant: { url: 'https://ha.example', token: fixtureSecret },
    brightnessState: { livingRoom: 40 },
    ...invalidSettings
  }
  const originalFile = JSON.stringify(storedSettings, null, 2)
  writeFileSync(configPath, originalFile, { mode: 0o644 })

  const service = new ConfigService()
  service.init()

  expect(service.getConfig()).toEqual(defaultSettings)
  expect(readFileSync(configPath, 'utf8')).toBe(originalFile)
  expect(statSync(configPath).mode & 0o777).toBe(0o600)
  expect(() => service.setConfig({ closeToTray: false })).toThrow(
    'Config persistence is unavailable'
  )
  expect(readFileSync(configPath, 'utf8')).toBe(originalFile)
})

test('restores the persisted Home Assistant token when an update listener rejects an import', () => {
  const service = new ConfigService()
  service.init()
  service.setConfig({
    homeAssistant: { url: 'https://old.example', token: 'stored-token' }
  })
  const observedEndpoints: string[] = []
  service.onUpdated((settings) => observedEndpoints.push(settings.homeAssistant.url))
  service.onUpdated((settings) => {
    if (settings.homeAssistant.url === 'https://new.example') {
      throw new Error('simulated listener failure')
    }
  })
  const rendererSettings = service.getRendererConfig()
  rendererSettings.homeAssistant.url = 'https://new.example'
  rendererSettings.homeAssistant.tokenConfigured = false

  expect(() =>
    service.updateFromRenderer({
      settings: rendererSettings,
      secrets: {
        homeAssistantToken: { action: 'clear' },
        discordClientSecret: { action: 'unchanged' },
        discordTokens: 'unchanged'
      }
    })
  ).toThrow('simulated listener failure')

  expect(service.getConfig().homeAssistant).toEqual({
    url: 'https://old.example',
    token: 'stored-token'
  })
  expect(observedEndpoints).toEqual(['https://new.example', 'https://old.example'])
  const reloaded = new ConfigService()
  reloaded.init()
  expect(reloaded.getConfig().homeAssistant).toEqual({
    url: 'https://old.example',
    token: 'stored-token'
  })
})
