import type { WebContents } from 'electron'
import { isRendererSettingsUpdate } from '@main/types/settings.types'
import { configService } from '@main/services/config.service'
import { handleIpc } from './trusted-ipc'

export function registerSettingsHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'settings:hydrate', () => configService.getRendererConfig())
  handleIpc(trustedSender, 'settings:update', (update: unknown) => {
    if (!isRendererSettingsUpdate(update)) {
      throw new TypeError('Invalid settings update')
    }
    configService.updateFromRenderer(update)
  })
}
