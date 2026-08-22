import type { WebContents } from 'electron'
import { serialService } from '@main/services/serial.service'
import { handleIpc } from './trusted-ipc'

export function registerSerialHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'serial:list', () => serialService.listPorts())
  handleIpc(trustedSender, 'serial:status', () => serialService.getStatus())
}
