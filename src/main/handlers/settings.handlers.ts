import { ipcMain } from 'electron'
import type { AppSettings } from '@main/types/settings.types'
import { configService } from '@main/services/config.service'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:hydrate', () => configService.getConfig())
  ipcMain.on('settings:update', (_, config: Partial<AppSettings>) =>
    configService.setConfig(config)
  )
}
