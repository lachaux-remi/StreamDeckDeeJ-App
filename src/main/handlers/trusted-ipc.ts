import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { isTrustedSender } from './trusted-ipc-core'

function assertTrustedSender(event: IpcMainInvokeEvent, trustedSender: WebContents): void {
  if (!isTrustedSender(event, trustedSender)) {
    throw new Error('Blocked IPC message from an untrusted sender')
  }
}

export function handleIpc<Args extends unknown[], Result>(
  trustedSender: WebContents,
  channel: string,
  listener: (...args: Args) => Result
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event, trustedSender)
    return listener(...(args as Args))
  })
}

export function onIpc<Args extends unknown[]>(
  trustedSender: WebContents,
  channel: string,
  listener: (...args: Args) => void
): void {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event, trustedSender)) return
    listener(...(args as Args))
  })
}
