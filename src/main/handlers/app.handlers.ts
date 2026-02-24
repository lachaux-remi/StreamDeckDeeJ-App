import { app, BrowserWindow, ipcMain } from 'electron'
import { loggerService } from '@main/services/logger.service'

export function registerAppHandlers(): void {
  ipcMain.handle('electron:versions', () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }))

  ipcMain.handle('electron:logs', () => loggerService.getLogs())

  ipcMain.on('app:toggle-devtools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.webContents.toggleDevTools()
    }
  })
}
