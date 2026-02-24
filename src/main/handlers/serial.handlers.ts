import { ipcMain } from 'electron'
import { serialService } from '@main/services/serial.service'

export function registerSerialHandlers(): void {
  ipcMain.handle('serial:list', () => serialService.listPorts())
  ipcMain.handle('serial:status', () => serialService.getStatus())
}
