import type { RendererSettings } from '../types/settings.types'
import { defaultSerialPort } from '../../../shared/platform-defaults'

const serialPlatform =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') ? 'windows' : 'linux'

export const defaultSettings: RendererSettings = {
  comPort: defaultSerialPort(serialPlatform),
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
