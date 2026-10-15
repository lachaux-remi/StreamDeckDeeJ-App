import type { WebContents } from 'electron'
import { discordService } from '@main/services/discord.service'
import { handleIpc } from './trusted-ipc'

export function registerDiscordHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'discord:authorize', () => discordService.authorizeNow())
}
