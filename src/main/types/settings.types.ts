import { ModuleEnum } from './enums'
import {
  MAX_ACTION_PARAMS,
  MAX_DEEJ_SLIDERS,
  MAX_LED_CONDITIONS,
  MAX_PARAM_LENGTH,
  MAX_SESSIONS_PER_SLIDER,
  MAX_SETTINGS_BYTES,
  MAX_SHORT_STRING_LENGTH,
  MAX_STREAMDECK_KEYS,
  MAX_URL_LENGTH,
  isDeckKey,
  isIconDataUrl,
  isSliderKey
} from '../../shared/input-limits'

export { MAX_ICON_DATA_URL_LENGTH, MAX_SETTINGS_BYTES, isDeckKey } from '../../shared/input-limits'

export interface LedColor {
  r: number
  g: number
  b: number
}

export type LedMode =
  'static' | 'rainbow' | 'wave' | 'pulse' | 'colorshift' | 'visor' | 'sequential' | 'spinner'

export interface LedProfile {
  mode: LedMode
  speed: number
  brightness: number
  startColor: LedColor
  endColor: LedColor
  direction: 'horizontal' | 'vertical' | 'diagonal'
}

export interface StreamdeckInputKey {
  module: ModuleEnum | ''
  params: string[]
  icon?: string
}

export type LedConditionType =
  'mic-mute' | 'discord-mute' | 'discord-deafen' | 'discord-stream' | 'ha-on' | 'ha-off'

export interface LedCondition {
  type: LedConditionType
  color: LedColor
}

export interface StreamdeckInputConfig {
  icon?: string
  color?: LedColor
  ledConditions?: LedCondition[]
  pressed?: StreamdeckInputKey
  hold?: StreamdeckInputKey
}

export type StreamdeckConfig = Record<string, StreamdeckInputConfig>

export type DeeJSliderConfig = string[]

export type DeeJConfig = Record<string, DeeJSliderConfig>

export interface HomeAssistantConfig {
  url: string
  token: string
}

export interface DiscordConfig {
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
}

export interface AppSettings {
  comPort: string
  baudRate: number
  gridCols: number
  gridRows: number
  sliderCount: number
  streamdeck: StreamdeckConfig
  deej: DeeJConfig
  deejNames: Record<string, string>
  invertSliders: boolean
  runOnStartup: boolean
  runInBackground: boolean
  closeToTray: boolean
  devTools: boolean
  homeAssistant: HomeAssistantConfig
  ledProfile: LedProfile
  discord?: DiscordConfig
}

export interface RendererHomeAssistantConfig {
  url: string
  tokenConfigured: boolean
}

export interface RendererDiscordConfig {
  clientId: string
  clientSecretConfigured: boolean
  authenticated: boolean
}

export type RendererSettings = Omit<AppSettings, 'homeAssistant' | 'discord'> & {
  homeAssistant: RendererHomeAssistantConfig
  discord: RendererDiscordConfig
}

export type SecretChange =
  { action: 'unchanged' } | { action: 'set'; value: string } | { action: 'clear' }

export interface RendererSettingsUpdate {
  settings: RendererSettings
  secrets: {
    homeAssistantToken: SecretChange
    discordClientSecret: SecretChange
    discordTokens: 'unchanged' | 'clear'
  }
}

const ledModes: LedMode[] = [
  'static',
  'rainbow',
  'wave',
  'pulse',
  'colorshift',
  'visor',
  'sequential',
  'spinner'
]

const conditionTypes: LedConditionType[] = [
  'mic-mute',
  'discord-mute',
  'discord-deafen',
  'discord-stream',
  'ha-on',
  'ha-off'
]

const MAX_SECRET_LENGTH = 16_384
const APP_SETTINGS_KEYS = [
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
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function isStringAtMost(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength
}

function hasSerializedSizeAtMost(value: unknown, maxBytes: number): boolean {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= maxBytes
  } catch {
    return false
  }
}

function isHomeAssistantUrl(value: unknown): value is string {
  if (value === '') {
    return true
  }
  if (typeof value !== 'string' || value !== value.trim()) {
    return false
  }
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

export function isLedColor(value: unknown): value is LedColor {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['r', 'g', 'b']) &&
    isIntegerBetween(value.r, 0, 255) &&
    isIntegerBetween(value.g, 0, 255) &&
    isIntegerBetween(value.b, 0, 255)
  )
}

function isInputKey(value: unknown): value is StreamdeckInputKey {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['module', 'params', 'icon']) &&
    (value.module === '' || Object.values(ModuleEnum).includes(value.module as ModuleEnum)) &&
    Array.isArray(value.params) &&
    value.params.length <= MAX_ACTION_PARAMS &&
    value.params.every((param) => isStringAtMost(param, MAX_PARAM_LENGTH)) &&
    (value.icon === undefined || isIconDataUrl(value.icon))
  )
}

function isLedCondition(value: unknown): value is LedCondition {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['type', 'color']) &&
    conditionTypes.includes(value.type as LedConditionType) &&
    isLedColor(value.color)
  )
}

function isStreamdeckInput(value: unknown): value is StreamdeckInputConfig {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['icon', 'color', 'ledConditions', 'pressed', 'hold']) &&
    (value.icon === undefined || isIconDataUrl(value.icon)) &&
    (value.color === undefined || isLedColor(value.color)) &&
    (value.ledConditions === undefined ||
      (Array.isArray(value.ledConditions) &&
        value.ledConditions.length <= MAX_LED_CONDITIONS &&
        value.ledConditions.every(isLedCondition))) &&
    (value.pressed === undefined || isInputKey(value.pressed)) &&
    (value.hold === undefined || isInputKey(value.hold))
  )
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.keys(value).length <= MAX_DEEJ_SLIDERS &&
    Object.entries(value).every(
      ([key, entry]) => isSliderKey(key) && isStringAtMost(entry, MAX_SHORT_STRING_LENGTH)
    )
  )
}

function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  return (
    isRecord(value) &&
    Object.keys(value).length <= MAX_DEEJ_SLIDERS &&
    Object.entries(value).every(
      ([key, entry]) =>
        isSliderKey(key) &&
        Array.isArray(entry) &&
        entry.length <= MAX_SESSIONS_PER_SLIDER &&
        entry.every((item) => isStringAtMost(item, MAX_SHORT_STRING_LENGTH))
    )
  )
}

export function isStreamdeckConfig(value: unknown): value is StreamdeckConfig {
  return (
    isRecord(value) &&
    Object.keys(value).length <= MAX_STREAMDECK_KEYS &&
    Object.entries(value).every(([key, input]) => isDeckKey(key) && isStreamdeckInput(input)) &&
    hasSerializedSizeAtMost(value, MAX_SETTINGS_BYTES)
  )
}

export function isLedProfile(value: unknown): value is LedProfile {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['mode', 'speed', 'brightness', 'startColor', 'endColor', 'direction']) &&
    ledModes.includes(value.mode as LedMode) &&
    isIntegerBetween(value.speed, 0, 100) &&
    isIntegerBetween(value.brightness, 0, 100) &&
    isLedColor(value.startColor) &&
    isLedColor(value.endColor) &&
    ['horizontal', 'vertical', 'diagonal'].includes(value.direction as string)
  )
}

function hasValidSharedSettings(value: Record<string, unknown>): boolean {
  return (
    isStringAtMost(value.comPort, 1024) &&
    isIntegerBetween(value.baudRate, 1, Number.MAX_SAFE_INTEGER) &&
    isIntegerBetween(value.gridCols, 1, 8) &&
    isIntegerBetween(value.gridRows, 1, 8) &&
    isIntegerBetween(value.sliderCount, 1, 16) &&
    isStreamdeckConfig(value.streamdeck) &&
    isStringArrayRecord(value.deej) &&
    isStringRecord(value.deejNames) &&
    typeof value.invertSliders === 'boolean' &&
    typeof value.runOnStartup === 'boolean' &&
    typeof value.runInBackground === 'boolean' &&
    typeof value.closeToTray === 'boolean' &&
    typeof value.devTools === 'boolean' &&
    isLedProfile(value.ledProfile)
  )
}

export function isAppSettings(value: unknown): value is AppSettings {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, APP_SETTINGS_KEYS) ||
    !hasValidSharedSettings(value)
  ) {
    return false
  }
  if (!isRecord(value.homeAssistant)) {
    return false
  }
  if (
    !hasOnlyKeys(value.homeAssistant, ['url', 'token']) ||
    !isStringAtMost(value.homeAssistant.url, MAX_URL_LENGTH) ||
    !isHomeAssistantUrl(value.homeAssistant.url) ||
    !isStringAtMost(value.homeAssistant.token, MAX_SECRET_LENGTH)
  ) {
    return false
  }
  if (value.discord === undefined) {
    return hasSerializedSizeAtMost(value, MAX_SETTINGS_BYTES)
  }
  return (
    isRecord(value.discord) &&
    hasOnlyKeys(value.discord, ['clientId', 'clientSecret', 'accessToken', 'refreshToken']) &&
    isStringAtMost(value.discord.clientId, MAX_SHORT_STRING_LENGTH) &&
    isStringAtMost(value.discord.clientSecret, MAX_SECRET_LENGTH) &&
    (value.discord.accessToken === undefined ||
      isStringAtMost(value.discord.accessToken, MAX_SECRET_LENGTH)) &&
    (value.discord.refreshToken === undefined ||
      isStringAtMost(value.discord.refreshToken, MAX_SECRET_LENGTH)) &&
    hasSerializedSizeAtMost(value, MAX_SETTINGS_BYTES)
  )
}

function isSecretChange(value: unknown): value is SecretChange {
  if (!isRecord(value) || typeof value.action !== 'string') {
    return false
  }
  if (value.action === 'unchanged' || value.action === 'clear') {
    return hasOnlyKeys(value, ['action'])
  }
  return (
    value.action === 'set' &&
    hasOnlyKeys(value, ['action', 'value']) &&
    isStringAtMost(value.value, MAX_SECRET_LENGTH) &&
    value.value.length > 0
  )
}

export function isRendererSettingsUpdate(value: unknown): value is RendererSettingsUpdate {
  if (!isRecord(value) || !hasOnlyKeys(value, ['settings', 'secrets'])) {
    return false
  }
  const settings = value.settings
  const secrets = value.secrets
  if (!isRecord(settings) || !isRecord(secrets) || !hasValidSharedSettings(settings)) {
    return false
  }
  if (
    !hasOnlyKeys(settings, [
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
    !isRecord(settings.homeAssistant) ||
    !hasOnlyKeys(settings.homeAssistant, ['url', 'tokenConfigured']) ||
    !isStringAtMost(settings.homeAssistant.url, MAX_URL_LENGTH) ||
    !isHomeAssistantUrl(settings.homeAssistant.url) ||
    typeof settings.homeAssistant.tokenConfigured !== 'boolean'
  ) {
    return false
  }
  if (
    !isRecord(settings.discord) ||
    !hasOnlyKeys(settings.discord, ['clientId', 'clientSecretConfigured', 'authenticated']) ||
    !isStringAtMost(settings.discord.clientId, MAX_SHORT_STRING_LENGTH) ||
    typeof settings.discord.clientSecretConfigured !== 'boolean' ||
    typeof settings.discord.authenticated !== 'boolean'
  ) {
    return false
  }
  return (
    hasSerializedSizeAtMost(value, MAX_SETTINGS_BYTES) &&
    hasOnlyKeys(secrets, ['homeAssistantToken', 'discordClientSecret', 'discordTokens']) &&
    isSecretChange(secrets.homeAssistantToken) &&
    isSecretChange(secrets.discordClientSecret) &&
    (secrets.discordTokens === 'unchanged' || secrets.discordTokens === 'clear')
  )
}
