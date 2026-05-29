import { ModuleEnum } from './enums'

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
  module: ModuleEnum
  params: string[]
  icon?: string
}

export type LedConditionType = 'mic-mute' | 'discord-mute' | 'discord-deafen' | 'discord-stream'

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
