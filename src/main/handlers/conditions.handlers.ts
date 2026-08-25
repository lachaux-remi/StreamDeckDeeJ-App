import type { WebContents } from 'electron'
import type { MicrophoneCapability } from '@main/platform-runtime'
import { discordService } from '@main/services/discord.service'
import { handleIpc } from './trusted-ipc'

export function registerConditionsHandlers(
  trustedSender: WebContents,
  microphone: MicrophoneCapability
): void {
  handleIpc(trustedSender, 'conditions:state', () => ({
    micMuted: microphone.isMuted(),
    discordMuted: discordService.isMuted(),
    discordDeafened: discordService.isDeafened(),
    discordStreaming: discordService.isStreaming(),
    discordConnected: discordService.isConnected()
  }))
}
