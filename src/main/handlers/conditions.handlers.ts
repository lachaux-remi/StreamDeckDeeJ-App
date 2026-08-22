import type { WebContents } from 'electron'
import { discordService } from '@main/services/discord.service'
import { micService } from '@main/services/mic.service'
import { handleIpc } from './trusted-ipc'

export function registerConditionsHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'conditions:state', () => ({
    micMuted: micService.isMuted(),
    discordMuted: discordService.isMuted(),
    discordDeafened: discordService.isDeafened(),
    discordStreaming: discordService.isStreaming(),
    discordConnected: discordService.isConnected()
  }))
}
