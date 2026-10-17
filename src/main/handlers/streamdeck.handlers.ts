import type { WebContents } from 'electron'
import { deckService } from '@main/services/deck.service'
import { ledService } from '@main/services/led.service'
import { isDeckKey, isLedColor, isLedProfile, isStreamdeckConfig } from '@main/types/settings.types'
import type { LedColor } from '@main/types/settings.types'
import { handleIpc } from './trusted-ipc'

const CONDITION_TEST_EFFECTS = ['solid', 'blink', 'pulse'] as const

function invalidPayload(): never {
  throw new TypeError('Invalid IPC payload')
}

export function registerStreamdeckHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'streamdeck:keys', (...args: unknown[]) => {
    if (args.length !== 1 || !isDeckKey(args[0])) {
      invalidPayload()
    }
    return deckService.getKeyInfo(args[0])
  })

  handleIpc(trustedSender, 'streamdeck:setLedOverride', async (...args: unknown[]) => {
    if (
      args.length !== 3 ||
      !isStreamdeckConfig(args[0]) ||
      (args[1] !== '' && !isDeckKey(args[1])) ||
      (args[2] !== null && !isLedColor(args[2]))
    ) {
      invalidPayload()
    }
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

  handleIpc(trustedSender, 'led:testCondition', (...args: unknown[]) => {
    if (
      args.length !== 3 ||
      !isDeckKey(args[0]) ||
      !isLedColor(args[1]) ||
      !CONDITION_TEST_EFFECTS.includes(args[2] as (typeof CONDITION_TEST_EFFECTS)[number])
    ) {
      invalidPayload()
    }
    const [key, color, effect] = args as [string, LedColor, (typeof CONDITION_TEST_EFFECTS)[number]]
    ledService.testCondition(Number(key), color, effect === 'solid' ? undefined : effect)
    return { success: true }
  })

  handleIpc(trustedSender, 'led:clearConditionTest', (...args: unknown[]) => {
    if (args.length !== 0) {
      invalidPayload()
    }
    ledService.clearConditionTest()
    return { success: true }
  })

  handleIpc(trustedSender, 'led:setProfile', async (...args: unknown[]) => {
    if (args.length !== 1 || !isLedProfile(args[0])) {
      invalidPayload()
    }
    const [profile] = args
    ledService.updateProfile(profile)
    await ledService.flush()
    return { success: true }
  })
}
