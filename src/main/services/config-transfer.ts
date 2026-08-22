import {
  chmodSync,
  closeSync,
  fstatSync,
  openSync,
  readSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  isRendererSettingsUpdate,
  type RendererSettings,
  type RendererSettingsUpdate
} from '../types/settings.types'

export const CONFIG_EXPORT_FORMAT = 'streamdeck-deej-settings'
export const CONFIG_EXPORT_VERSION = 1
export const MAX_CONFIG_IMPORT_BYTES = 1024 * 1024

type PublicSettings = Omit<RendererSettings, 'homeAssistant' | 'discord'> & {
  homeAssistant: { url: string }
  discord: { clientId: string }
}

interface ConfigExportDocument {
  format: typeof CONFIG_EXPORT_FORMAT
  version: typeof CONFIG_EXPORT_VERSION
  settings: PublicSettings
}

interface ConfigAdapter {
  getRendererConfig(): RendererSettings
  updateFromRenderer(update: RendererSettingsUpdate): void
}

interface ConfigFileDialogs {
  chooseExportPath(): Promise<string | null>
  chooseImportPath(): Promise<string | null>
}

export interface ConfigTransferResult {
  status: 'success' | 'cancelled' | 'error'
  message: string
}

type ConfigTransferErrorCode = 'INVALID_FORMAT' | 'TOO_LARGE' | 'APPLY_FAILED' | 'ROLLBACK_FAILED'

class ConfigTransferError extends Error {
  public readonly code: ConfigTransferErrorCode

  constructor(code: ConfigTransferErrorCode) {
    super(code)
    this.name = 'ConfigTransferError'
    this.code = code
  }
}

const unchangedSecrets: RendererSettingsUpdate['secrets'] = {
  homeAssistantToken: { action: 'unchanged' },
  discordClientSecret: { action: 'unchanged' },
  discordTokens: 'unchanged'
}

export class ConfigTransferService {
  private readonly config: ConfigAdapter
  private readonly backupPath: string

  constructor(config: ConfigAdapter, backupPath: string) {
    this.config = config
    this.backupPath = backupPath
  }

  public createExportDocument(settings = this.config.getRendererConfig()): ConfigExportDocument {
    return {
      format: CONFIG_EXPORT_FORMAT,
      version: CONFIG_EXPORT_VERSION,
      settings: toPublicSettings(settings)
    }
  }

  public exportToFile(path: string): void {
    writePrivateJsonAtomically(path, this.createExportDocument())
  }

  public importFromFile(path: string): void {
    const imported = readImportDocument(path)
    const previous = this.config.getRendererConfig()
    writePrivateJsonAtomically(this.backupPath, this.createExportDocument(previous))

    const update = createSettingsUpdate(imported.settings, previous)
    try {
      this.config.updateFromRenderer(update)
    } catch {
      try {
        this.config.updateFromRenderer({ settings: previous, secrets: unchangedSecrets })
      } catch {
        throw new ConfigTransferError('ROLLBACK_FAILED')
      }
      throw new ConfigTransferError('APPLY_FAILED')
    }
  }
}

export class ConfigTransferController {
  private readonly transfer: ConfigTransferService
  private readonly dialogs: ConfigFileDialogs

  constructor(transfer: ConfigTransferService, dialogs: ConfigFileDialogs) {
    this.transfer = transfer
    this.dialogs = dialogs
  }

  public async exportConfiguration(): Promise<ConfigTransferResult> {
    const path = await this.dialogs.chooseExportPath()
    if (!path) return { status: 'cancelled', message: 'Export annulé.' }

    try {
      this.transfer.exportToFile(path)
      return { status: 'success', message: 'Configuration exportée sans les secrets.' }
    } catch {
      return { status: 'error', message: 'Export impossible. Aucun secret n’a été écrit.' }
    }
  }

  public async importConfiguration(): Promise<ConfigTransferResult> {
    const path = await this.dialogs.chooseImportPath()
    if (!path) return { status: 'cancelled', message: 'Import annulé.' }

    try {
      this.transfer.importFromFile(path)
      return {
        status: 'success',
        message: 'Configuration importée. Les secrets existants ont été conservés.'
      }
    } catch (error) {
      if (error instanceof ConfigTransferError && error.code === 'TOO_LARGE') {
        return {
          status: 'error',
          message: 'Import impossible : le fichier dépasse la taille maximale autorisée.'
        }
      }
      if (error instanceof ConfigTransferError && error.code === 'APPLY_FAILED') {
        return {
          status: 'error',
          message: 'Import impossible. La configuration précédente a été restaurée.'
        }
      }
      if (error instanceof ConfigTransferError && error.code === 'ROLLBACK_FAILED') {
        return {
          status: 'error',
          message:
            'Import impossible et restauration automatique échouée. La sauvegarde expurgée a été conservée.'
        }
      }
      return {
        status: 'error',
        message: 'Import impossible : fichier JSON invalide ou incompatible.'
      }
    }
  }
}

function toPublicSettings(settings: RendererSettings): PublicSettings {
  return {
    comPort: settings.comPort,
    baudRate: settings.baudRate,
    gridCols: settings.gridCols,
    gridRows: settings.gridRows,
    sliderCount: settings.sliderCount,
    streamdeck: settings.streamdeck,
    deej: settings.deej,
    deejNames: settings.deejNames,
    invertSliders: settings.invertSliders,
    runOnStartup: settings.runOnStartup,
    runInBackground: settings.runInBackground,
    closeToTray: settings.closeToTray,
    devTools: settings.devTools,
    homeAssistant: { url: settings.homeAssistant.url },
    ledProfile: settings.ledProfile,
    discord: { clientId: settings.discord.clientId }
  }
}

function createSettingsUpdate(
  settings: PublicSettings,
  current: RendererSettings
): RendererSettingsUpdate {
  return {
    settings: {
      ...settings,
      homeAssistant: {
        url: settings.homeAssistant.url,
        tokenConfigured: current.homeAssistant.tokenConfigured
      },
      discord: {
        clientId: settings.discord.clientId,
        clientSecretConfigured: current.discord.clientSecretConfigured,
        authenticated: current.discord.authenticated
      }
    },
    secrets: unchangedSecrets
  }
}

function readImportDocument(path: string): ConfigExportDocument {
  const bytes = readBoundedFile(path)

  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new ConfigTransferError('INVALID_FORMAT')
  }
  if (!isConfigExportDocument(parsed)) throw new ConfigTransferError('INVALID_FORMAT')
  return parsed
}

function readBoundedFile(path: string): Buffer {
  const descriptor = openSync(path, 'r')
  try {
    if (fstatSync(descriptor).size > MAX_CONFIG_IMPORT_BYTES) {
      throw new ConfigTransferError('TOO_LARGE')
    }

    const bytes = Buffer.alloc(MAX_CONFIG_IMPORT_BYTES + 1)
    let totalRead = 0
    while (totalRead < bytes.byteLength) {
      const bytesRead = readSync(
        descriptor,
        bytes,
        totalRead,
        bytes.byteLength - totalRead,
        totalRead
      )
      if (bytesRead === 0) break
      totalRead += bytesRead
    }
    if (totalRead > MAX_CONFIG_IMPORT_BYTES) throw new ConfigTransferError('TOO_LARGE')
    return bytes.subarray(0, totalRead)
  } finally {
    closeSync(descriptor)
  }
}

function writePrivateJsonAtomically(path: string, value: ConfigExportDocument): void {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600
    })
    chmodSync(temporaryPath, 0o600)
    renameSync(temporaryPath, path)
    chmodSync(path, 0o600)
  } catch (error) {
    try {
      unlinkSync(temporaryPath)
    } catch {
      // Nothing to clean up when creating the temporary file failed.
    }
    throw error
  }
}

function isConfigExportDocument(value: unknown): value is ConfigExportDocument {
  return (
    isRecord(value) &&
    hasExactlyKeys(value, ['format', 'version', 'settings']) &&
    value.format === CONFIG_EXPORT_FORMAT &&
    value.version === CONFIG_EXPORT_VERSION &&
    isPublicSettings(value.settings)
  )
}

function isPublicSettings(value: unknown): value is PublicSettings {
  if (
    !isRecord(value) ||
    !hasExactlyKeys(value, [
      'comPort',
      'baudRate',
      'gridCols',
      'gridRows',
      'sliderCount',
      'streamdeck',
      'deej',
      'deejNames',
      'invertSliders',
      'runOnStartup',
      'runInBackground',
      'closeToTray',
      'devTools',
      'homeAssistant',
      'ledProfile',
      'discord'
    ])
  ) {
    return false
  }
  if (
    !isRecord(value.homeAssistant) ||
    !hasExactlyKeys(value.homeAssistant, ['url']) ||
    typeof value.homeAssistant.url !== 'string' ||
    !isRecord(value.discord) ||
    !hasExactlyKeys(value.discord, ['clientId']) ||
    typeof value.discord.clientId !== 'string'
  ) {
    return false
  }

  return isRendererSettingsUpdate({
    settings: {
      ...value,
      homeAssistant: { url: value.homeAssistant.url, tokenConfigured: false },
      discord: {
        clientId: value.discord.clientId,
        clientSecretConfigured: false,
        authenticated: false
      }
    },
    secrets: unchangedSecrets
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}
