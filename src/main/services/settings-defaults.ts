import type { AppSettings } from '@main/types/settings.types'
import { defaultSerialPort } from '../../shared/platform-defaults'

export const defaultSettings: AppSettings = {
  comPort: defaultSerialPort(process.platform),
  baudRate: 115200,
  gridCols: 4,
  gridRows: 4,
  sliderCount: 5,
  streamdeck: {},
  deej: {},
  deejNames: {},
  invertSliders: false,
  runOnStartup: false,
  runInBackground: false,
  closeToTray: true,
  devTools: false,
  homeAssistant: { url: '', token: '' },
  ledProfile: {
    mode: 'rainbow',
    speed: 50,
    brightness: 80,
    startColor: { r: 0, g: 0, b: 255 },
    endColor: { r: 255, g: 0, b: 255 },
    direction: 'horizontal'
  }
}

export function applySettingsDefaults(parsed: Partial<AppSettings>): AppSettings {
  return {
    ...defaultSettings,
    ...parsed,
    homeAssistant: {
      ...defaultSettings.homeAssistant,
      ...(parsed.homeAssistant ?? {})
    }
  }
}
