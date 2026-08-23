import type { WebContents } from 'electron'
import { deckService } from '@main/services/deck.service'
import { ledService } from '@main/services/led.service'
import { isDeckKey, isLedColor, isLedProfile, isStreamdeckConfig } from '@main/types/settings.types'
import { handleIpc } from './trusted-ipc'

function invalidPayload(): never {
  throw new TypeError('Invalid IPC payload')
}

export function registerStreamdeckHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'streamdeck:keys', (...args: unknown[]) => {
    if (args.length !== 1 || !isDeckKey(args[0])) invalidPayload()
    return deckService.getKeyInfo(args[0])
  })

  handleIpc(trustedSender, 'streamdeck:setLedOverride', async (...args: unknown[]) => {
    if (
      args.length !== 3 ||
      !isStreamdeckConfig(args[0]) ||
      (args[1] !== '' && !isDeckKey(args[1])) ||
      (args[2] !== null && !isLedColor(args[2]))
    )
      invalidPayload()
    const [streamdeck, previewKey, previewColor] = args
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
  })

  handleIpc(trustedSender, 'led:setProfile', async (...args: unknown[]) => {
    if (args.length !== 1 || !isLedProfile(args[0])) invalidPayload()
    const [profile] = args
    ledService.updateProfile(profile)
    await ledService.flush()
    return { success: true }
  })
}
