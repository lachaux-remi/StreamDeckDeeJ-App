export interface StreamdeckInputKey {
  module: string
  params: string[]
  icon?: string
}

export interface StreamdeckInputConfig {
  icon?: string
  pressed?: StreamdeckInputKey
  hold?: StreamdeckInputKey
}

export type StreamdeckConfig = Record<string, StreamdeckInputConfig>
export type DeeJSliderConfig = string[]
export type DeeJConfig = Record<string, DeeJSliderConfig>

export interface HomeAssistantConfig {
  url: string
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
}
