import { app, BrowserWindow, dialog } from 'electron'
import type { OpenDialogOptions, SaveDialogOptions, WebContents } from 'electron'
import { join } from 'node:path'
import { isRendererSettingsUpdate } from '@main/types/settings.types'
import { configService } from '@main/services/config.service'
import { ConfigTransferController, ConfigTransferService } from '@main/services/config-transfer'
import { handleIpc } from './trusted-ipc'

export function registerSettingsHandlers(trustedSender: WebContents): void {
  const transfer = new ConfigTransferController(
    new ConfigTransferService(
      configService,
      join(app.getPath('userData'), 'config-import-backup.json')
    ),
    {
      chooseExportPath: async () => {
        const parent = BrowserWindow.fromWebContents(trustedSender)
        const options: SaveDialogOptions = {
          title: 'Exporter la configuration',
          defaultPath: join(app.getPath('documents'), 'streamdeck-deej-settings.json'),
          filters: [{ name: 'Configuration JSON', extensions: ['json'] }]
        }
        const result = parent
          ? await dialog.showSaveDialog(parent, options)
          : await dialog.showSaveDialog(options)
        return result.canceled ? null : (result.filePath ?? null)
      },
      chooseImportPath: async () => {
        const parent = BrowserWindow.fromWebContents(trustedSender)
        const options: OpenDialogOptions = {
          title: 'Importer une configuration',
          filters: [{ name: 'Configuration JSON', extensions: ['json'] }],
          properties: ['openFile']
        }
        const result = parent
          ? await dialog.showOpenDialog(parent, options)
          : await dialog.showOpenDialog(options)
        return result.canceled ? null : (result.filePaths[0] ?? null)
      }
    }
  )

  handleIpc(trustedSender, 'settings:hydrate', () => configService.getRendererConfig())
  handleIpc(trustedSender, 'settings:update', (update: unknown) => {
    if (!isRendererSettingsUpdate(update)) {
      throw new TypeError('Invalid settings update')
    }
    configService.updateFromRenderer(update)
  })
  handleIpc(trustedSender, 'settings:export', () => transfer.exportConfiguration())
  handleIpc(trustedSender, 'settings:import', () => transfer.importConfiguration())
}
