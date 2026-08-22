import { registerAppHandlers } from './app.handlers'
import { registerConditionsHandlers } from './conditions.handlers'
import { registerDeejHandlers } from './deej.handlers'
import { registerSerialHandlers } from './serial.handlers'
import { registerSettingsHandlers } from './settings.handlers'
import { registerStreamdeckHandlers } from './streamdeck.handlers'
import { registerUpdateHandlers } from './update.handlers'
import type { WebContents } from 'electron'

export function registerAllHandlers(trustedSender: WebContents): void {
  registerSettingsHandlers(trustedSender)
  registerSerialHandlers(trustedSender)
  registerStreamdeckHandlers(trustedSender)
  registerDeejHandlers(trustedSender)
  registerAppHandlers(trustedSender)
  registerConditionsHandlers(trustedSender)
  registerUpdateHandlers(trustedSender)
}
