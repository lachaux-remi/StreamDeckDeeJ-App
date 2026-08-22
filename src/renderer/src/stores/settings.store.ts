import { create } from 'zustand'
import type {
  RendererSettings,
  RendererSettingsUpdate,
  StreamdeckInputConfig
} from '@renderer/types/settings.types'

const defaultSettings: RendererSettings = {
  comPort: '/dev/ttyACM0',
  baudRate: 9600,
  gridCols: 4,
  gridRows: 4,
  sliderCount: 4,
  streamdeck: {},
  deej: {},
  deejNames: {},
  invertSliders: false,
  runOnStartup: false,
  runInBackground: false,
  closeToTray: true,
  devTools: false,
  homeAssistant: { url: '', tokenConfigured: false },
  ledProfile: {
    mode: 'rainbow',
    speed: 50,
    brightness: 80,
    startColor: { r: 0, g: 0, b: 255 },
    endColor: { r: 255, g: 0, b: 255 },
    direction: 'horizontal'
  },
  discord: { clientId: '', clientSecretConfigured: false, authenticated: false }
}

interface SettingsStore {
  settings: RendererSettings
  hydrate: (config: RendererSettings) => void
  updateConfig: (
    config: Partial<RendererSettings>,
    secrets?: RendererSettingsUpdate['secrets']
  ) => Promise<void>
  updateStreamdeckButton: (index: string, config: StreamdeckInputConfig) => void
  removeStreamdeckButton: (index: string) => void
  swapStreamdeckButtons: (sourceIndex: string, targetIndex: string) => void
  swapSliders: (sourceIndex: string, targetIndex: string) => void
  updateSlider: (sliderIndex: string, sessions: string[], name?: string) => void
}

const unchangedSecrets: RendererSettingsUpdate['secrets'] = {
  homeAssistantToken: { action: 'unchanged' },
  discordClientSecret: { action: 'unchanged' },
  discordTokens: 'unchanged'
}

function persistSettings(
  settings: RendererSettings,
  secrets: RendererSettingsUpdate['secrets'] = unchangedSecrets
): Promise<void> {
  return window.api.settings.update({ settings, secrets })
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,

  hydrate: (config) =>
    set({
      settings: {
        ...defaultSettings,
        ...config,
        deejNames: config.deejNames || {},
        deej: config.deej || {},
        streamdeck: config.streamdeck || {}
      }
    }),

  updateConfig: (partial, secrets) => {
    const newSettings = { ...get().settings, ...partial }
    set({ settings: newSettings })
    return persistSettings(newSettings, secrets)
  },

  updateStreamdeckButton: (index, config) => {
    const settings = { ...get().settings }
    settings.streamdeck = { ...settings.streamdeck, [index]: config }
    set({ settings })
    void persistSettings(settings)
  },

  removeStreamdeckButton: (index) => {
    const settings = { ...get().settings }
    const streamdeck = { ...settings.streamdeck }
    delete streamdeck[index]
    settings.streamdeck = streamdeck
    set({ settings })
    void persistSettings(settings)
  },

  swapStreamdeckButtons: (sourceIndex, targetIndex) => {
    if (sourceIndex === targetIndex) return
    const settings = { ...get().settings }
    const streamdeck = { ...settings.streamdeck }
    const sourceConfig = streamdeck[sourceIndex]
    const targetConfig = streamdeck[targetIndex]

    if (sourceConfig && targetConfig) {
      streamdeck[sourceIndex] = targetConfig
      streamdeck[targetIndex] = sourceConfig
    } else if (sourceConfig) {
      streamdeck[targetIndex] = sourceConfig
      delete streamdeck[sourceIndex]
    } else if (targetConfig) {
      streamdeck[sourceIndex] = targetConfig
      delete streamdeck[targetIndex]
    }

    settings.streamdeck = streamdeck
    set({ settings })
    void persistSettings(settings)
  },

  swapSliders: (sourceIndex, targetIndex) => {
    if (sourceIndex === targetIndex) return
    const settings = { ...get().settings }
    const deej = { ...settings.deej }
    const deejNames = { ...settings.deejNames }

    const srcSessions = deej[sourceIndex]
    const tgtSessions = deej[targetIndex]
    const srcName = deejNames[sourceIndex]
    const tgtName = deejNames[targetIndex]

    // Swap sessions
    if (srcSessions) deej[targetIndex] = srcSessions
    else delete deej[targetIndex]
    if (tgtSessions) deej[sourceIndex] = tgtSessions
    else delete deej[sourceIndex]

    // Swap names
    if (srcName) deejNames[targetIndex] = srcName
    else delete deejNames[targetIndex]
    if (tgtName) deejNames[sourceIndex] = tgtName
    else delete deejNames[sourceIndex]

    settings.deej = deej
    settings.deejNames = deejNames
    set({ settings })
    void persistSettings(settings)
  },

  updateSlider: (sliderIndex, sessions, name?) => {
    const settings = { ...get().settings }
    settings.deej = { ...settings.deej, [sliderIndex]: sessions }
    const deejNames = { ...settings.deejNames }
    if (name) {
      deejNames[sliderIndex] = name
    } else {
      delete deejNames[sliderIndex]
    }
    settings.deejNames = deejNames
    set({ settings })
    void persistSettings(settings)
  }
}))
