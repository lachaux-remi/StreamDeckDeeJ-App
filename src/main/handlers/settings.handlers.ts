import type { WebContents } from 'electron'
import type { AppSettings } from '@main/types/settings.types'
import { configService } from '@main/services/config.service'
import { handleIpc, onIpc } from './trusted-ipc'

export function registerSettingsHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'settings:hydrate', () => configService.getConfig())
  onIpc(trustedSender, 'settings:update', (config: Partial<AppSettings>) =>
    configService.setConfig(config)
  )
}
