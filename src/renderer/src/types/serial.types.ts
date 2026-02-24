export interface SerialStatus {
  connected: boolean
  port: string
}

export interface ApplicationVersions {
  app: string
  electron: string
  node: string
  chrome: string
}

export interface LogEntry {
  timestamp: string
  level: string
  service?: string
  msg: string
}
