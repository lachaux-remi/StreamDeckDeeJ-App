import { ipcMain } from 'electron'
import { deckService } from '@main/services/deck.service'
import { ledService } from '@main/services/led.service'
import type { LedColor, LedProfile, StreamdeckConfig } from '@main/types/settings.types'

export function registerStreamdeckHandlers(): void {
  ipcMain.handle('streamdeck:keys', (_, deckKey: string) => deckService.getKeyInfo(deckKey))

  ipcMain.handle(
    'streamdeck:setLedOverride',
    async (_, streamdeck: StreamdeckConfig, previewKey: string, previewColor: LedColor | null) => {
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

  ipcMain.handle('led:setProfile', async (_, profile: LedProfile) => {
    ledService.updateProfile(profile)
    await ledService.flush()
    return { success: true }
  })
}
