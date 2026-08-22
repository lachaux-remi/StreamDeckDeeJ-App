import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import {
  isAppSettings,
  type AppSettings,
  type RendererSettings,
  type RendererSettingsUpdate,
  type SecretChange
} from '@main/types/settings.types'
import { loggerService } from './logger.service'
import { applySettingsDefaults, defaultSettings } from './settings-defaults'
import { toRendererSettings } from './renderer-settings'
import { ElectronSafeStorageSecretCodec, SettingsPersistence } from './secret-storage'

const SERVICE = 'ConfigService'

export class ConfigService extends EventEmitter {
  private data: AppSettings = { ...defaultSettings }
  private configPath: string = ''
  private persistence: SettingsPersistence | undefined
  private persistenceEnabled = true

  constructor() {
    super()
  }

  public init(): void {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    this.configPath = join(userDataPath, 'config.json')
    const secretCodec = new ElectronSafeStorageSecretCodec(safeStorage, () =>
      loggerService.warn(
        'Keyring encryption failed; secrets are stored in the mode 0600 config file',
        SERVICE
      )
    )
    if (!secretCodec.usesSecureBackend()) {
      loggerService.warn(
        'Secure keyring unavailable; secrets are stored in the mode 0600 config file',
        SERVICE
      )
    }
    this.persistence = new SettingsPersistence(this.configPath, secretCodec)
    this.load()
    loggerService.debug('INIT', SERVICE)
    // Notify services so they re-init with actual config (not defaults)
    this.emit('config:updated', this.data)
  }

  private load(): void {
    try {
      if (existsSync(this.configPath)) {
        const parsed = this.persistence?.load() as Partial<AppSettings>
        const candidate = applySettingsDefaults(parsed)
        if (!isAppSettings(candidate)) throw new Error('Invalid config')
        this.data = candidate
      } else {
        this.data = { ...defaultSettings }
        this.save()
      }
    } catch {
      loggerService.warn(
        'Config is unreadable; using defaults and leaving the existing file unchanged',
        SERVICE
      )
      this.data = { ...defaultSettings }
      this.persistenceEnabled = false
      try {
        this.persistence?.protectFile()
      } catch {
        loggerService.error('Failed to enforce config file permissions', SERVICE)
      }
    }
  }

  private save(data: AppSettings = this.data): void {
    if (!this.persistenceEnabled) throw new Error('Config persistence is unavailable')
    try {
      this.persistence?.save(data)
    } catch {
      loggerService.error('Failed to save config', SERVICE)
      throw new Error('Config persistence failed')
    }
  }

  public getConfig(): AppSettings {
    return { ...this.data }
  }

  public getRendererConfig(): RendererSettings {
    return toRendererSettings(this.data)
  }

  public updateFromRenderer(update: RendererSettingsUpdate): void {
    const { settings, secrets } = update
    const { homeAssistant, discord, ...sharedSettings } = settings
    const currentDiscord = this.data.discord
    const nextDiscord = {
      clientId: discord.clientId,
      clientSecret: this.applySecretChange(
        currentDiscord?.clientSecret ?? '',
        secrets.discordClientSecret
      ),
      accessToken: secrets.discordTokens === 'clear' ? undefined : currentDiscord?.accessToken,
      refreshToken: secrets.discordTokens === 'clear' ? undefined : currentDiscord?.refreshToken
    }

    this.setConfig({
      ...sharedSettings,
      homeAssistant: {
        url: homeAssistant.url,
        token: this.applySecretChange(this.data.homeAssistant.token, secrets.homeAssistantToken)
      },
      discord:
        nextDiscord.clientId ||
        nextDiscord.clientSecret ||
        nextDiscord.accessToken ||
        nextDiscord.refreshToken
          ? nextDiscord
          : undefined
    })
  }

  public setConfig(config: Partial<AppSettings>): void {
    const previousData = this.data
    const nextData = { ...this.data, ...config }
    this.save(nextData)
    this.data = nextData
    try {
      this.emit('config:updated', this.data)
    } catch (error) {
      this.data = previousData
      this.save(previousData)
      try {
        this.emit('config:updated', this.data)
      } catch {
        // Preserve the original update failure after best-effort listener rollback.
      }
      throw error
    }
    loggerService.debug('Config updated', SERVICE)
  }

  public onUpdated(listener: (config: AppSettings) => void): void {
    this.on('config:updated', listener)
  }

  private applySecretChange(currentValue: string, change: SecretChange): string {
    if (change.action === 'set') return change.value
    if (change.action === 'clear') return ''
    return currentValue
  }
}

export const configService = new ConfigService()
