import { registerAppHandlers } from './app.handlers'
import { registerConditionsHandlers } from './conditions.handlers'
import { registerDeejHandlers } from './deej.handlers'
import { registerHardwarePermissionsHandlers } from './hardware-permissions.handlers'
import { registerHomeAssistantHandlers } from './home-assistant.handlers'
import { registerSerialHandlers } from './serial.handlers'
import { registerSettingsHandlers } from './settings.handlers'
import { registerStreamdeckHandlers } from './streamdeck.handlers'
import { registerUpdateHandlers } from './update.handlers'
import type { WebContents } from 'electron'
import type { PlatformRuntime } from '@main/platform-runtime'

export function registerAllHandlers(trustedSender: WebContents, platform: PlatformRuntime): void {
  registerSettingsHandlers(trustedSender)
  registerSerialHandlers(trustedSender)
  registerStreamdeckHandlers(trustedSender)
  registerDeejHandlers(
    trustedSender,
    platform.audio.sessions,
    platform.audio.levelMeter !== undefined
  )
  registerHardwarePermissionsHandlers(trustedSender, platform.hardwarePermissions)
  registerAppHandlers(trustedSender)
  registerHomeAssistantHandlers(trustedSender)
  registerConditionsHandlers(trustedSender, platform.audio.microphone)
  registerUpdateHandlers(trustedSender, platform.updater)
}
