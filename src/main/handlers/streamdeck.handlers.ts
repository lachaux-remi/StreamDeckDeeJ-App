import type { WebContents } from 'electron'
import { deckService } from '@main/services/deck.service'
import { ledService } from '@main/services/led.service'
import type { LedColor, LedProfile, StreamdeckConfig } from '@main/types/settings.types'
import { handleIpc } from './trusted-ipc'

export function registerStreamdeckHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'streamdeck:keys', (deckKey: string) => deckService.getKeyInfo(deckKey))

  handleIpc(
    trustedSender,
    'streamdeck:setLedOverride',
    async (streamdeck: StreamdeckConfig, previewKey: string, previewColor: LedColor | null) => {
      const overrides = { ...streamdeck }
      if (previewKey) {
        const existing = overrides[previewKey] ?? {}
        overrides[previewKey] = previewColor
          ? { ...existing, color: previewColor }
          : { ...existing, color: undefined }
      }
      ledService.updateOverrides(overrides)
      await ledService.flush()
      return { success: true }
    }
  )

  handleIpc(trustedSender, 'led:setProfile', async (profile: LedProfile) => {
    ledService.updateProfile(profile)
    await ledService.flush()
    return { success: true }
  })
}
