import { EventEmitter } from 'node:events'
import logger from '@main/utils/logger'

export interface LogEntry {
  timestamp: string
  level: string
  service?: string
  msg: string
}

const MAX_LOG_ENTRIES = 1_000

class LoggerService extends EventEmitter {
  private readonly logs: (LogEntry | undefined)[] = new Array(MAX_LOG_ENTRIES)
  private logStart = 0
  private logCount = 0

  public addLog(level: string, msg: string, service?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      msg
    }

    const index = (this.logStart + this.logCount) % MAX_LOG_ENTRIES
    this.logs[index] = entry

    if (this.logCount === MAX_LOG_ENTRIES) {
      this.logStart = (this.logStart + 1) % MAX_LOG_ENTRIES
    } else {
      this.logCount += 1
    }

    this.emit('log', entry)
  }

  public getLogs(): LogEntry[] {
    return Array.from(
      { length: this.logCount },
      (_, index) => this.logs[(this.logStart + index) % MAX_LOG_ENTRIES]!
    )
  }

  public info(msg: string, service?: string): void {
    logger.info({ service }, msg)
    this.addLog('info', msg, service)
  }

  public debug(msg: string, service?: string): void {
    logger.debug({ service }, msg)
    this.addLog('debug', msg, service)
  }

  public warn(msg: string, service?: string): void {
    logger.warn({ service }, msg)
    this.addLog('warn', msg, service)
  }

  public error(msg: string, service?: string): void {
    logger.error({ service }, msg)
    this.addLog('error', msg, service)
  }
}

export const loggerService = new LoggerService()
