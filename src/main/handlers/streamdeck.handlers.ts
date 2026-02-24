import { ipcMain } from 'electron'
import { deckService } from '@main/services/deck.service'

export function registerStreamdeckHandlers(): void {
  ipcMain.handle('streamdeck:keys', (_, deckKey: string) => deckService.getKeyInfo(deckKey))
}
