import { registerAppHandlers } from './app.handlers'
import { registerConditionsHandlers } from './conditions.handlers'
import { registerDeejHandlers } from './deej.handlers'
import { registerHardwarePermissionsHandlers } from './hardware-permissions.handlers'
import { registerSerialHandlers } from './serial.handlers'
import { registerSettingsHandlers } from './settings.handlers'
import { registerStreamdeckHandlers } from './streamdeck.handlers'
import type { WebContents } from 'electron'

export function registerAllHandlers(trustedSender: WebContents): void {
  registerSettingsHandlers(trustedSender)
  registerSerialHandlers(trustedSender)
  registerStreamdeckHandlers(trustedSender)
  registerDeejHandlers(trustedSender)
  registerHardwarePermissionsHandlers(trustedSender)
  registerAppHandlers(trustedSender)
  registerConditionsHandlers(trustedSender)
}
