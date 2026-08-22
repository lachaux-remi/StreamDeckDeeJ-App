import { create } from 'zustand'
import type {
  ApplicationVersions,
  LogEntry,
  SerialPortInfo,
  SerialStatus
} from '@renderer/types/serial.types'

const MAX_LOG_ENTRIES = 1_000

class LogBuffer {
  private readonly entries: (LogEntry | undefined)[] = new Array(MAX_LOG_ENTRIES)
  private start = 0
  private size = 0

  public replace(logs: LogEntry[]): void {
    this.clear()

    const firstLog = Math.max(0, logs.length - MAX_LOG_ENTRIES)
    for (let index = firstLog; index < logs.length; index += 1) {
      this.push(logs[index])
    }
  }

  public push(log: LogEntry): void {
    const index = (this.start + this.size) % MAX_LOG_ENTRIES
    this.entries[index] = log

    if (this.size === MAX_LOG_ENTRIES) {
      this.start = (this.start + 1) % MAX_LOG_ENTRIES
    } else {
      this.size += 1
    }
  }

  public clear(): void {
    this.entries.fill(undefined)
    this.start = 0
    this.size = 0
  }

  public toArray(): LogEntry[] {
    return Array.from(
      { length: this.size },
      (_, index) => this.entries[(this.start + index) % MAX_LOG_ENTRIES]!
    )
  }
}

interface SerialStore {
  sessions: string[]
  sliders: Record<string, number>
  versions: ApplicationVersions | null
  serialPorts: SerialPortInfo[]
  serialStatus: SerialStatus
  logs: LogEntry[]
  setSessions: (sessions: string[]) => void
  setSliders: (sliders: Record<string, number>) => void
  setVersions: (versions: ApplicationVersions) => void
  setSerialPorts: (ports: SerialPortInfo[]) => void
  setSerialStatus: (status: SerialStatus) => void
  setLogs: (logs: LogEntry[]) => void
  addLog: (log: LogEntry) => void
  clearLogs: () => void
}

export const useSerialStore = create<SerialStore>((set) => {
  const logs = new LogBuffer()

  return {
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
    setLogs: (newLogs) => {
      logs.replace(newLogs)
      set({ logs: logs.toArray() })
    },
    addLog: (log) => {
      logs.push(log)
      set({ logs: logs.toArray() })
    },
    clearLogs: () => {
      logs.clear()
      set({ logs: [] })
    }
  }
})
