import { EventEmitter } from 'node:events'
import logger from '@main/utils/logger'

export interface LogEntry {
  timestamp: string
  level: string
  service?: string
  msg: string
}

class LoggerService extends EventEmitter {
  private logs: LogEntry[] = []

  public addLog(level: string, msg: string, service?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      msg
    }
    this.logs.push(entry)
    this.emit('log', entry)
  }

  public getLogs(): LogEntry[] {
    return this.logs
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
