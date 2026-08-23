import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import {
  CONFIG_EXPORT_FORMAT,
  CONFIG_EXPORT_VERSION,
  MAX_CONFIG_IMPORT_BYTES,
  ConfigTransferController,
  ConfigTransferService
} from '@main/services/config-transfer'
import type { RendererSettings, RendererSettingsUpdate } from '@main/types/settings.types'

const rendererSettings: RendererSettings = {
  comPort: '/dev/ttyACM1',
  baudRate: 115200,
  gridCols: 4,
  gridRows: 3,
  sliderCount: 4,
  streamdeck: {},
  deej: { 0: ['Firefox'] },
  deejNames: { 0: 'Web' },
  invertSliders: false,
  runOnStartup: true,
  runInBackground: false,
  closeToTray: true,
  devTools: false,
  homeAssistant: { url: 'https://ha.example', tokenConfigured: true },
  ledProfile: {
    mode: 'rainbow',
    speed: 50,
    brightness: 80,
    startColor: { r: 0, g: 0, b: 255 },
    endColor: { r: 255, g: 0, b: 255 },
    direction: 'horizontal'
  },
  discord: { clientId: 'client-id', clientSecretConfigured: true, authenticated: true }
}

interface TestConfigAdapter {
  current: RendererSettings
  updates: RendererSettingsUpdate[]
  getRendererConfig(): RendererSettings
  updateFromRenderer(update: RendererSettingsUpdate): void
}

interface TestHarness {
  adapter: TestConfigAdapter
  directory: string
  service: ConfigTransferService
}

function harness(settings = structuredClone(rendererSettings)): TestHarness {
  const directory = mkdtempSync(join(tmpdir(), 'streamdeck-deej-transfer-'))
  const adapter: TestConfigAdapter = {
    current: settings,
    updates: [],
    getRendererConfig() {
      return structuredClone(this.current)
    },
    updateFromRenderer(update) {
      this.updates.push(structuredClone(update))
      this.current = structuredClone(update.settings)
    }
  }
  const service = new ConfigTransferService(adapter, join(directory, 'import-backup.json'))
  return { adapter, directory, service }
}

test('exports readable, versioned JSON without any stored integration secret', () => {
  const settingsWithSecrets = structuredClone(rendererSettings)
  Object.assign(settingsWithSecrets.homeAssistant, { token: 'ha-secret-value' })
  Object.assign(settingsWithSecrets.discord, {
    clientSecret: 'discord-client-secret',
    accessToken: 'discord-access-token',
    refreshToken: 'discord-refresh-token'
  })
  const { directory, service } = harness(settingsWithSecrets)
  const exportPath = join(directory, 'settings.json')

  service.exportToFile(exportPath)

  const raw = readFileSync(exportPath, 'utf8')
  const exported = JSON.parse(raw)
  expect(exported.format).toBe(CONFIG_EXPORT_FORMAT)
  expect(exported.version).toBe(CONFIG_EXPORT_VERSION)
  expect(exported.settings.homeAssistant.url).toBe('https://ha.example')
  expect(exported.settings.discord).toEqual({ clientId: 'client-id' })
  expect(raw.endsWith('\n')).toBe(true)
  for (const forbidden of [
    'ha-secret-value',
    'discord-client-secret',
    'discord-access-token',
    'discord-refresh-token',
    'clientSecret',
    'accessToken',
    'refreshToken',
    'tokenConfigured'
  ]) {
    expect(raw, `export contains ${forbidden}`).not.toContain(forbidden)
  }
  expect(statSync(exportPath).mode & 0o777).toBe(0o600)
})

test('imports a valid export and preserves all currently stored secrets', () => {
  const { adapter, directory, service } = harness()
  const importPath = join(directory, 'settings.json')
  const imported = service.createExportDocument()
  imported.settings.comPort = '/dev/ttyUSB9'
  writeFileSync(importPath, JSON.stringify(imported))

  service.importFromFile(importPath)

  expect(adapter.current.comPort).toBe('/dev/ttyUSB9')
  expect(adapter.updates[0].secrets).toEqual({
    homeAssistantToken: { action: 'unchanged' },
    discordClientSecret: { action: 'unchanged' },
    discordTokens: 'unchanged'
  })
  expect(adapter.updates[0].settings.homeAssistant.tokenConfigured).toBe(true)
  expect(adapter.updates[0].settings.discord.clientSecretConfigured).toBe(true)
  expect(adapter.updates[0].settings.discord.authenticated).toBe(true)
})

test('does not forward the stored Home Assistant token after importing a different endpoint', () => {
  const { adapter, directory, service } = harness()
  const importPath = join(directory, 'settings.json')
  const imported = service.createExportDocument()
  imported.settings.homeAssistant.url = 'https://untrusted.example'
  writeFileSync(importPath, JSON.stringify(imported))
  const storedToken = 'stored-ha-token'
  let forwardedAuthorization: string | undefined
  adapter.updateFromRenderer = (update) => {
    adapter.updates.push(structuredClone(update))
    if (update.settings.homeAssistant.url === imported.settings.homeAssistant.url) {
      const token =
        update.secrets.homeAssistantToken.action === 'unchanged' ? storedToken : undefined
      forwardedAuthorization = token ? `Bearer ${token}` : undefined
    }
  }

  service.importFromFile(importPath)

  expect(forwardedAuthorization).toBeUndefined()
  expect(adapter.updates[0].secrets.homeAssistantToken).toEqual({ action: 'clear' })
  expect(adapter.updates[0].settings.homeAssistant.tokenConfigured).toBe(false)
})

test('rejects malformed JSON and unknown or invalid schema keys without applying changes', () => {
  const invalidDocuments = [
    '{',
    JSON.stringify({
      format: CONFIG_EXPORT_FORMAT,
      version: CONFIG_EXPORT_VERSION,
      settings: { ...rendererSettings, homeAssistant: null }
    }),
    JSON.stringify({
      format: CONFIG_EXPORT_FORMAT,
      version: CONFIG_EXPORT_VERSION,
      settings: { ...rendererSettings, unexpected: true }
    }),
    JSON.stringify({
      format: CONFIG_EXPORT_FORMAT,
      version: CONFIG_EXPORT_VERSION,
      settings: {
        ...rendererSettings,
        gridCols: 99,
        homeAssistant: { url: 'https://ha.example' },
        discord: { clientId: 'client-id' }
      }
    })
  ]

  for (const [index, document] of invalidDocuments.entries()) {
    const { adapter, directory, service } = harness()
    const importPath = join(directory, `invalid-${index}.json`)
    writeFileSync(importPath, document)
    expect(() => service.importFromFile(importPath)).toThrow(
      expect.objectContaining({ code: 'INVALID_FORMAT' })
    )
    expect(adapter.updates).toHaveLength(0)
    expect(adapter.current).toEqual(rendererSettings)
  }
})

test('rejects oversized imports before parsing or applying them', () => {
  const { adapter, directory, service } = harness()
  const importPath = join(directory, 'oversized.json')
  writeFileSync(importPath, Buffer.alloc(MAX_CONFIG_IMPORT_BYTES + 1, 0x20))

  expect(() => service.importFromFile(importPath)).toThrow(
    expect.objectContaining({ code: 'TOO_LARGE' })
  )
  expect(adapter.updates).toHaveLength(0)
})

test('creates a private atomic redacted backup before applying an import', () => {
  const { adapter, directory, service } = harness()
  const importPath = join(directory, 'settings.json')
  const imported = service.createExportDocument()
  imported.settings.comPort = '/dev/ttyUSB2'
  writeFileSync(importPath, JSON.stringify(imported))

  service.importFromFile(importPath)

  const backupPath = join(directory, 'import-backup.json')
  const backup = readFileSync(backupPath, 'utf8')
  expect(JSON.parse(backup).settings.comPort).toBe(rendererSettings.comPort)
  expect(backup).not.toContain('tokenConfigured')
  expect(statSync(backupPath).mode & 0o777).toBe(0o600)
  expect(adapter.updates).toHaveLength(1)
})

test('rolls back to the previous redacted configuration when application fails', () => {
  const { adapter, directory, service } = harness()
  const importPath = join(directory, 'settings.json')
  const imported = service.createExportDocument()
  imported.settings.comPort = '/dev/ttyUSB3'
  writeFileSync(importPath, JSON.stringify(imported))
  const apply = adapter.updateFromRenderer.bind(adapter)
  let attempts = 0
  adapter.updateFromRenderer = (update) => {
    attempts += 1
    apply(update)
    if (attempts === 1) {
      throw new Error('simulated apply failure')
    }
  }

  expect(() => service.importFromFile(importPath)).toThrow(
    expect.objectContaining({ code: 'APPLY_FAILED' })
  )
  expect(attempts).toBe(2)
  expect(adapter.current).toEqual(rendererSettings)
  expect(
    JSON.parse(readFileSync(join(directory, 'import-backup.json'), 'utf8')).settings.comPort
  ).toBe(rendererSettings.comPort)
})

test('reports a rollback failure without claiming that restoration succeeded', async () => {
  const { adapter, directory, service } = harness()
  const importPath = join(directory, 'settings.json')
  writeFileSync(importPath, JSON.stringify(service.createExportDocument()))
  adapter.updateFromRenderer = () => {
    throw new Error('simulated persistence failure')
  }
  const controller = new ConfigTransferController(service, {
    chooseExportPath: async () => null,
    chooseImportPath: async () => importPath
  })

  await expect(controller.importConfiguration()).resolves.toEqual({
    status: 'error',
    message:
      'Import impossible et restauration automatique échouée. La sauvegarde expurgée a été conservée.'
  })
  expect(
    JSON.parse(readFileSync(join(directory, 'import-backup.json'), 'utf8')).settings.comPort
  ).toBe(rendererSettings.comPort)
})

test('returns clear, secret-free results for export, import, failure, and cancellation', async () => {
  const { directory, service } = harness()
  const exportPath = join(directory, 'settings.json')
  const controller = new ConfigTransferController(service, {
    chooseExportPath: async () => exportPath,
    chooseImportPath: async () => exportPath
  })

  await expect(controller.exportConfiguration()).resolves.toEqual({
    status: 'success',
    message: 'Configuration exportée sans les secrets.'
  })
  await expect(controller.importConfiguration()).resolves.toEqual({
    status: 'success',
    message: 'Configuration importée.'
  })

  const exportFailure = new ConfigTransferController(service, {
    chooseExportPath: async () => directory,
    chooseImportPath: async () => null
  })
  await expect(exportFailure.exportConfiguration()).resolves.toEqual({
    status: 'error',
    message: 'Export impossible. Aucun secret n’a été écrit.'
  })

  const cancelled = new ConfigTransferController(service, {
    chooseExportPath: async () => null,
    chooseImportPath: async () => null
  })
  await expect(cancelled.exportConfiguration()).resolves.toEqual({
    status: 'cancelled',
    message: 'Export annulé.'
  })
  await expect(cancelled.importConfiguration()).resolves.toEqual({
    status: 'cancelled',
    message: 'Import annulé.'
  })

  chmodSync(exportPath, 0o600)
  writeFileSync(exportPath, '{')
  const failure = await controller.importConfiguration()
  expect(failure).toEqual({
    status: 'error',
    message: 'Import impossible : fichier JSON invalide ou incompatible.'
  })
  expect(failure.message).not.toContain('{')
})

test('returns specific secret-free messages for oversized input and restored apply failure', async () => {
  const oversized = harness()
  const oversizedPath = join(oversized.directory, 'oversized.json')
  writeFileSync(oversizedPath, Buffer.alloc(MAX_CONFIG_IMPORT_BYTES + 1, 0x20))
  const oversizedController = new ConfigTransferController(oversized.service, {
    chooseExportPath: async () => null,
    chooseImportPath: async () => oversizedPath
  })

  await expect(oversizedController.importConfiguration()).resolves.toEqual({
    status: 'error',
    message: 'Import impossible : le fichier dépasse la taille maximale autorisée.'
  })

  const failed = harness()
  const failedPath = join(failed.directory, 'settings.json')
  writeFileSync(failedPath, JSON.stringify(failed.service.createExportDocument()))
  let attempts = 0
  failed.adapter.updateFromRenderer = () => {
    attempts += 1
    if (attempts === 1) {
      throw new Error('simulated apply failure')
    }
  }
  const failedController = new ConfigTransferController(failed.service, {
    chooseExportPath: async () => null,
    chooseImportPath: async () => failedPath
  })

  await expect(failedController.importConfiguration()).resolves.toEqual({
    status: 'error',
    message: 'Import impossible. La configuration précédente a été restaurée.'
  })
  expect(attempts).toBe(2)
})
