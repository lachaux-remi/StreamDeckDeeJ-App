import { contextBridge, ipcRenderer } from 'electron'

const api = {
  settings: {
    hydrate: (): Promise<unknown> => ipcRenderer.invoke('settings:hydrate'),
    update: (config: unknown): Promise<void> => ipcRenderer.invoke('settings:update', config)
  },
  serial: {
    list: (): Promise<{ path: string; displayName: string }[]> => ipcRenderer.invoke('serial:list'),
    status: (): Promise<{ connected: boolean; port: string }> => ipcRenderer.invoke('serial:status')
  },
  hardwarePermissions: {
    diagnose: (): Promise<{
      hid: 'accessible' | 'permission-denied' | 'not-detected'
      serial: 'accessible' | 'permission-denied' | 'not-detected'
      rule: 'installed' | 'missing' | 'different'
      installAction: 'available' | 'unavailable'
      manualCommand?: string
    }> => ipcRenderer.invoke('hardware-permissions:diagnose'),
    install: (): Promise<{
      result: 'installed' | 'cancelled' | 'failed'
      diagnostic: {
        hid: 'accessible' | 'permission-denied' | 'not-detected'
        serial: 'accessible' | 'permission-denied' | 'not-detected'
        rule: 'installed' | 'missing' | 'different'
        installAction: 'available' | 'unavailable'
        manualCommand?: string
      }
    }> => ipcRenderer.invoke('hardware-permissions:install')
  },
  streamdeck: {
    getKeys: (key: string): Promise<unknown> => ipcRenderer.invoke('streamdeck:keys', key),
    setLedOverride: (
      streamdeck: unknown,
      previewKey: string,
      previewColor: { r: number; g: number; b: number } | null
    ): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('streamdeck:setLedOverride', streamdeck, previewKey, previewColor),
    setLedProfile: (profile: unknown): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('led:setProfile', profile)
  },
  deej: {
    getSliders: (): Promise<Record<string, number>> => ipcRenderer.invoke('deej:sliders'),
    getSessions: (): Promise<string[]> => ipcRenderer.invoke('deej:sessions')
  },
  app: {
    getVersions: (): Promise<unknown> => ipcRenderer.invoke('electron:versions'),
    getLogs: (): Promise<unknown[]> => ipcRenderer.invoke('electron:logs'),
    toggleDevTools: (): void => ipcRenderer.send('app:toggle-devtools')
  },
  conditions: {
    getState: (): Promise<{
      micMuted: boolean
      discordMuted: boolean
      discordDeafened: boolean
      discordStreaming: boolean
      discordConnected: boolean
    }> => ipcRenderer.invoke('conditions:state'),
    onChange: (
      callback: (
        state: Partial<{
          micMuted: boolean
          discordMuted: boolean
          discordDeafened: boolean
          discordStreaming: boolean
          discordConnected: boolean
        }>
      ) => void
    ): (() => void) => {
      const handler = (
        _: unknown,
        state: Partial<{
          micMuted: boolean
          discordMuted: boolean
          discordDeafened: boolean
          discordStreaming: boolean
          discordConnected: boolean
        }>
      ): void => callback(state)
      ipcRenderer.on('conditions:change', handler)
      return () => ipcRenderer.removeListener('conditions:change', handler)
    }
  },
  on: {
    slidersUpdate: (callback: (sliders: Record<string, number>) => void): (() => void) => {
      const handler = (_: unknown, sliders: Record<string, number>): void => callback(sliders)
      ipcRenderer.on('deej:sliders', handler)
      return () => ipcRenderer.removeListener('deej:sliders', handler)
    },
    streamdeckUpdate: (callback: (key: string, data: unknown) => void): (() => void) => {
      const handler = (_: unknown, key: string, data: unknown): void => callback(key, data)
      ipcRenderer.on('streamdeck:update', handler)
      return () => ipcRenderer.removeListener('streamdeck:update', handler)
    },
    serialStatus: (
      callback: (status: { connected: boolean; port: string }) => void
    ): (() => void) => {
      const handler = (_: unknown, status: { connected: boolean; port: string }): void =>
        callback(status)
      ipcRenderer.on('serial:status', handler)
      return () => ipcRenderer.removeListener('serial:status', handler)
    },
    log: (callback: (log: unknown) => void): (() => void) => {
      const handler = (_: unknown, log: unknown): void => callback(log)
      ipcRenderer.on('electron:log', handler)
      return () => ipcRenderer.removeListener('electron:log', handler)
    }
  }
}

export type StreamDeckDeeJAPI = typeof api

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  ;(window as unknown as Record<string, unknown>).api = api
}
