import { BrowserWindow, dialog, type WebContents } from 'electron'
import type { UpdateCapability } from '@main/platform-runtime'
import {
  createSerialCommandExecutor,
  executeUpdateCommand,
  type UpdateConsent
} from '@main/services/update-command'
import { isUpdateCommand } from '@main/types/update.types'
import { handleIpc } from './trusted-ipc'

export function registerUpdateHandlers(
  trustedSender: WebContents,
  updater: UpdateCapability
): void {
  const runCommand = createSerialCommandExecutor()

  const confirm = async (consent: UpdateConsent): Promise<boolean> => {
    const owner = BrowserWindow.fromWebContents(trustedSender)
    if (!owner) {
      throw new Error('Updater window is unavailable')
    }
    const download = consent === 'download'
    const windows = updater.getState().mode === 'nsis'
    const packageDescription = windows
      ? 'ce programme d’installation Windows'
      : 'cette mise à jour AppImage'
    const result = await dialog.showMessageBox(owner, {
      type: 'question',
      buttons: [download ? 'Télécharger' : 'Installer et redémarrer', 'Annuler'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: download ? 'Confirmer le téléchargement' : "Confirmer l'installation",
      message: download
        ? `Télécharger ${packageDescription} ?`
        : `Installer ${packageDescription} et redémarrer maintenant ?`,
      detail: download
        ? "Le téléchargement ne démarre qu'après votre confirmation. L'installation restera séparée."
        : windows
          ? "Le programme d'installation NSIS vérifié sera lancé par electron-updater, puis l'application redémarrera."
          : "L'AppImage actuelle sera remplacée par electron-updater, puis l'application redémarrera."
    })
    return result.response === 0
  }

  handleIpc(trustedSender, 'update:state', (...args: unknown[]) => {
    if (args.length !== 0) {
      throw new TypeError('Invalid update state request')
    }
    return updater.getState()
  })
  handleIpc(trustedSender, 'update:command', async (...args: unknown[]) => {
    if (args.length !== 1 || !isUpdateCommand(args[0])) {
      throw new TypeError('Invalid update command')
    }
    const command = args[0]
    await runCommand(() => executeUpdateCommand(command, updater, confirm))
    return updater.getState()
  })
}
