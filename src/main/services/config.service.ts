import { app } from 'electron'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

const SERVICE = 'ConfigService'

class ConfigService extends EventEmitter {
  private data: AppSettings = { ...defaultSettings }
  private configPath: string = ''

  constructor() {
    super()
  }

  public init(): void {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    this.configPath = join(userDataPath, 'config.json')
    this.load()
    loggerService.debug('INIT', SERVICE)
    // Notify services so they re-init with actual config (not defaults)
    this.emit('config:updated', this.data)
  }

  private load(): void {
    try {
      if (existsSync(this.configPath)) {
        const raw = readFileSync(this.configPath, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<AppSettings>
        const candidate = applySettingsDefaults(parsed)
        if (!isAppSettings(candidate)) throw new Error('Invalid config')
        this.data = candidate
      } else {
        this.data = { ...defaultSettings }
        this.save()
      }
    } catch {
      loggerService.warn('Failed to load config, using defaults', SERVICE)
      this.data = { ...defaultSettings }
      this.save()
    }
  }

  private save(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), {
        encoding: 'utf-8',
        mode: 0o600
      })
      chmodSync(this.configPath, 0o600)
    } catch (err) {
      loggerService.error(`Failed to save config: ${err}`, SERVICE)
    }
  }

  public getConfig(): AppSettings {
    return { ...this.data }
  }

  public getRendererConfig(): RendererSettings {
    const { homeAssistant, discord, ...settings } = this.data
    return {
      ...settings,
      homeAssistant: {
        url: homeAssistant.url,
        tokenConfigured: homeAssistant.token.length > 0
      },
      discord: {
        clientId: discord?.clientId ?? '',
        clientSecretConfigured: Boolean(discord?.clientSecret),
        authenticated: Boolean(discord?.accessToken)
      }
    }
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
    this.data = { ...this.data, ...config }
    this.save()
    loggerService.debug('Config updated', SERVICE)
    this.emit('config:updated', this.data)
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
