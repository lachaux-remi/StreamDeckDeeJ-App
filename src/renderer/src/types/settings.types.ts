export interface LedColor {
  r: number
  g: number
  b: number
}

export type LedMode =
  | 'static'
  | 'rainbow'
  | 'wave'
  | 'pulse'
  | 'colorshift'
  | 'visor'
  | 'sequential'
  | 'spinner'

export interface LedProfile {
  mode: LedMode
  speed: number
  brightness: number
  startColor: LedColor
  endColor: LedColor
  direction: 'horizontal' | 'vertical' | 'diagonal'
}

export interface StreamdeckInputKey {
  module: string
  params: string[]
  icon?: string
}

export type LedConditionType = 'mic-mute' | 'discord-mute' | 'discord-deafen' | 'discord-stream' | 'ha-on' | 'ha-off'

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

export interface ConditionsState {
  micMuted: boolean
  discordMuted: boolean
  discordDeafened: boolean
  discordStreaming: boolean
  discordConnected: boolean
}

export type StreamdeckConfig = Record<string, StreamdeckInputConfig>
export type DeeJSliderConfig = string[]
export type DeeJConfig = Record<string, DeeJSliderConfig>

export interface RendererHomeAssistantConfig {
  url: string
  tokenConfigured: boolean
}

export interface RendererDiscordConfig {
  clientId: string
  clientSecretConfigured: boolean
  authenticated: boolean
}

export interface RendererSettings {
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
  homeAssistant: RendererHomeAssistantConfig
  ledProfile: LedProfile
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function isLedColor(value: unknown): value is LedColor {
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
    ['', 'home-assistant', 'ir', 'macro'].includes(value.module as string) &&
    Array.isArray(value.params) &&
    value.params.every((param) => typeof param === 'string') &&
    (value.icon === undefined || typeof value.icon === 'string')
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
    (value.icon === undefined || typeof value.icon === 'string') &&
    (value.color === undefined || isLedColor(value.color)) &&
    (value.ledConditions === undefined ||
      (Array.isArray(value.ledConditions) && value.ledConditions.every(isLedCondition))) &&
    (value.pressed === undefined || isInputKey(value.pressed)) &&
    (value.hold === undefined || isInputKey(value.hold))
  )
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string')
}

function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => Array.isArray(entry) && entry.every((item) => typeof item === 'string')
    )
  )
}

function isLedProfile(value: unknown): value is LedProfile {
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

export function isRendererSettings(value: unknown): value is RendererSettings {
  if (!isRecord(value)) return false
  if (
    !hasOnlyKeys(value, [
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
  )
    return false
  if (
    typeof value.comPort !== 'string' ||
    !isIntegerBetween(value.baudRate, 1, Number.MAX_SAFE_INTEGER) ||
    !isIntegerBetween(value.gridCols, 1, 8) ||
    !isIntegerBetween(value.gridRows, 1, 8) ||
    !isIntegerBetween(value.sliderCount, 1, 16) ||
    !isRecord(value.streamdeck) ||
    !Object.values(value.streamdeck).every(isStreamdeckInput) ||
    !isStringArrayRecord(value.deej) ||
    !isStringRecord(value.deejNames) ||
    typeof value.invertSliders !== 'boolean' ||
    typeof value.runOnStartup !== 'boolean' ||
    typeof value.runInBackground !== 'boolean' ||
    typeof value.closeToTray !== 'boolean' ||
    typeof value.devTools !== 'boolean' ||
    !isLedProfile(value.ledProfile)
  ) {
    return false
  }
  if (
    !isRecord(value.homeAssistant) ||
    !hasOnlyKeys(value.homeAssistant, ['url', 'tokenConfigured']) ||
    typeof value.homeAssistant.url !== 'string' ||
    typeof value.homeAssistant.tokenConfigured !== 'boolean'
  ) {
    return false
  }
  return (
    isRecord(value.discord) &&
    hasOnlyKeys(value.discord, ['clientId', 'clientSecretConfigured', 'authenticated']) &&
    typeof value.discord.clientId === 'string' &&
    typeof value.discord.clientSecretConfigured === 'boolean' &&
    typeof value.discord.authenticated === 'boolean'
  )
}
