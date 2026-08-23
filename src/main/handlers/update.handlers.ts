import { BrowserWindow, dialog, type WebContents } from 'electron'
import {
  createSerialCommandExecutor,
  executeLinuxUpdateCommand,
  type UpdateConsent
} from '@main/services/update-command'
import { linuxUpdateService } from '@main/services/linux-update.service'
import { isLinuxUpdateCommand } from '@main/types/update.types'
import { handleIpc } from './trusted-ipc'

export function registerUpdateHandlers(trustedSender: WebContents): void {
  const runCommand = createSerialCommandExecutor()

  const confirm = async (consent: UpdateConsent): Promise<boolean> => {
    const owner = BrowserWindow.fromWebContents(trustedSender)
    if (!owner) {
      throw new Error('Updater window is unavailable')
    }
    const download = consent === 'download'
    const result = await dialog.showMessageBox(owner, {
      type: 'question',
      buttons: [download ? 'Télécharger' : 'Installer et redémarrer', 'Annuler'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: download ? 'Confirmer le téléchargement' : "Confirmer l'installation",
      message: download
        ? 'Télécharger cette mise à jour AppImage ?'
        : 'Installer la mise à jour AppImage et redémarrer maintenant ?',
      detail: download
        ? "Le téléchargement ne démarre qu'après votre confirmation. L'installation restera séparée."
        : "L'AppImage actuelle sera remplacée par electron-updater, puis l'application redémarrera."
    })
    return result.response === 0
  }

  handleIpc(trustedSender, 'update:state', (...args: unknown[]) => {
    if (args.length !== 0) {
      throw new TypeError('Invalid update state request')
    }
    return linuxUpdateService.getState()
  })
  handleIpc(trustedSender, 'update:command', async (...args: unknown[]) => {
    if (args.length !== 1 || !isLinuxUpdateCommand(args[0])) {
      throw new TypeError('Invalid update command')
    }
    const command = args[0]
    await runCommand(() => executeLinuxUpdateCommand(command, linuxUpdateService, confirm))
    return linuxUpdateService.getState()
  })
}
