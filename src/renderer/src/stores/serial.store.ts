import { create } from 'zustand'
import type { ApplicationVersions, LogEntry, SerialStatus } from '@renderer/types/serial.types'

interface SerialStore {
  sessions: string[]
  sliders: Record<string, number>
  versions: ApplicationVersions | null
  serialPorts: { path: string; displayName: string; manufacturer?: string }[]
  serialStatus: SerialStatus
  logs: LogEntry[]
  setSessions: (sessions: string[]) => void
  setSliders: (sliders: Record<string, number>) => void
  setVersions: (versions: ApplicationVersions) => void
  setSerialPorts: (ports: { path: string; displayName: string; manufacturer?: string }[]) => void
  setSerialStatus: (status: SerialStatus) => void
  setLogs: (logs: LogEntry[]) => void
  addLog: (log: LogEntry) => void
  clearLogs: () => void
}

export const useSerialStore = create<SerialStore>((set) => ({
  sessions: [],
  sliders: {},
  versions: null,
  serialPorts: [],
  serialStatus: { connected: false, port: '' },
  logs: [],

  setSessions: (sessions) => set({ sessions }),
  setSliders: (sliders) => set({ sliders }),
  setVersions: (versions) => set({ versions }),
  setSerialPorts: (ports) => set({ serialPorts: ports }),
  setSerialStatus: (status) => set({ serialStatus: status }),
  setLogs: (logs) => set({ logs: logs as LogEntry[] }),
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  clearLogs: () => set({ logs: [] })
}))
