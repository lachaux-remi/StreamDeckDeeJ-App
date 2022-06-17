import { contextBridge, ipcRenderer } from "electron"

export const api = {
    send: (channel: string, ...args: any) => ipcRenderer.send( channel, ...args ),
    get: <T>(type: string, ...args: any): T => ipcRenderer.sendSync( "get", type, ...args ),
    on: (channel: string, callback: (...args: any) => void) => ipcRenderer.on( channel, (_, data) => callback( data ) ),
    once: (channel: string, callback: (...args: any) => void) => ipcRenderer.once( channel, (_, data) => callback( data ) )
}

contextBridge.exposeInMainWorld( "api", api )
