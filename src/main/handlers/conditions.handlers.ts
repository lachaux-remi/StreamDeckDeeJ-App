import { ipcMain } from 'electron'
import { discordService } from '@main/services/discord.service'
import { micService } from '@main/services/mic.service'

export function registerConditionsHandlers(): void {
  ipcMain.handle('conditions:state', () => ({
    micMuted: micService.isMuted(),
    discordMuted: discordService.isMuted(),
    discordDeafened: discordService.isDeafened(),
    discordStreaming: discordService.isStreaming(),
    discordConnected: discordService.isConnected()
  }))
}
