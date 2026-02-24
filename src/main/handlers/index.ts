import { registerAppHandlers } from './app.handlers'
import { registerDeejHandlers } from './deej.handlers'
import { registerSerialHandlers } from './serial.handlers'
import { registerSettingsHandlers } from './settings.handlers'
import { registerStreamdeckHandlers } from './streamdeck.handlers'

export function registerAllHandlers(): void {
  registerSettingsHandlers()
  registerSerialHandlers()
  registerStreamdeckHandlers()
  registerDeejHandlers()
  registerAppHandlers()
}
