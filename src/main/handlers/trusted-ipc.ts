import { ipcMain } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'

function isTrustedSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
  trustedSender: WebContents
): boolean {
  return event.sender === trustedSender && event.senderFrame === trustedSender.mainFrame
}

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
