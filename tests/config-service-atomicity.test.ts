import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { ConfigService } from '@main/services/config.service'

const userDataPath = mkdtempSync(join(tmpdir(), 'streamdeck-deej-config-'))

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath },
  safeStorage: {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString()
  }
}))

test('restores the persisted Home Assistant token when an update listener rejects an import', () => {
  const service = new ConfigService()
  service.init()
  service.setConfig({
    homeAssistant: { url: 'https://old.example', token: 'stored-token' }
  })
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
  const reloaded = new ConfigService()
  reloaded.init()
  expect(reloaded.getConfig().homeAssistant).toEqual({
    url: 'https://old.example',
    token: 'stored-token'
  })
})
