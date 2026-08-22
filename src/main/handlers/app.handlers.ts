import { app } from 'electron'
import type { WebContents } from 'electron'
import { loggerService } from '@main/services/logger.service'
import { handleIpc, onIpc } from './trusted-ipc'

export function registerAppHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'electron:versions', () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }))

  handleIpc(trustedSender, 'electron:logs', () => loggerService.getLogs())

  onIpc(trustedSender, 'app:toggle-devtools', () => trustedSender.toggleDevTools())
}
