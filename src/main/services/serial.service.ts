import { EventEmitter } from 'node:events'
import { readFile, realpath } from 'node:fs/promises'
import { SerialPort } from 'serialport'
import type { AppSettings } from '@main/types/settings.types'
import { configService } from './config.service'
import { loggerService } from './logger.service'
import {
  BoundedSerialFrameDecoder,
  ExpectedIrEchoTracker,
  parseSerialFrame,
  type SerialRejectionReason
} from './serial-protocol'
import { isOfficialFirmwarePort, preferOfficialFirmwarePorts } from './serial-port-discovery'

const SERVICE = 'SerialService'
const REJECTION_LOG_INTERVAL_MS = 5_000

class SerialService extends EventEmitter {
  private serialPort: SerialPort | null = null
  private comPort: string | undefined
  private baudRate: number | undefined
  private configEpoch = 0
  private reloadRequested = false
  private reloadPromise: Promise<void> | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private readyTimer: NodeJS.Timeout | null = null
  private isShuttingDown = false
  private lastRejectionLogAt = 0
  private suppressedRejections = 0
  private readonly expectedIrEchoes = new ExpectedIrEchoTracker()

  constructor() {
    super()
    loggerService.debug('INIT', SERVICE)

    configService.onUpdated((config) => this.setConfig(config))
  }

  public async listPorts(): Promise<
    { path: string; displayName: string; manufacturer?: string; official: boolean }[]
  > {
    const ports = await SerialPort.list()
    return Promise.all(
      preferOfficialFirmwarePorts(ports).map(async (port) => {
        const product = await this.getUsbProduct(port.path)
        const name = product || port.manufacturer
        return {
          path: port.path,
          displayName: name ? `${name} (${port.path})` : port.path,
          manufacturer: port.manufacturer || undefined,
          official: isOfficialFirmwarePort(port)
        }
      })
    )
  }

  private async getUsbProduct(portPath: string): Promise<string | undefined> {
    try {
      const ttyName = portPath.replace('/dev/', '')
      const sysLink = `/sys/class/tty/${ttyName}/device`
      const devicePath = await realpath(sysLink)
      const product = await readFile(`${devicePath}/../product`, 'utf-8')
      return product.trim()
    } catch {
      return undefined
    }
  }

  public getStatus(): { connected: boolean; port: string } {
    return {
      connected: this.serialPort !== null && this.serialPort.isOpen,
      port: this.comPort || ''
    }
  }

  public send(data: string): void {
    if (this.serialPort && this.serialPort.isOpen) {
      loggerService.debug(`Sending data: ${data}`, SERVICE)
      const port = this.serialPort
      port.write(data, (error) => {
        if (!error && this.serialPort === port && port.isOpen) {
          this.expectedIrEchoes.recordCommand(data)
        }
      })
    } else {
      loggerService.warn(`Serial port not open, cannot send data: ${data}`, SERVICE)
    }
  }

  private setConfig(config: Partial<AppSettings>): void {
    if (this.comPort !== config.comPort || this.baudRate !== config.baudRate) {
      this.comPort = config.comPort
      this.baudRate = config.baudRate
      this.configEpoch += 1
      this.clearConnectionTimers()
      this.requestReload()
    }
  }

  private requestReload(): void {
    if (this.isShuttingDown) return
    this.reloadRequested = true
    if (this.reloadPromise) return

    this.reloadPromise = this.reloadConnection()
      .catch((error) => loggerService.error(`Error reloading connection: ${error}`, SERVICE))
      .finally(() => {
        this.reloadPromise = null
        if (this.reloadRequested) this.requestReload()
      })
  }

  private async reloadConnection(): Promise<void> {
    while (this.reloadRequested && !this.isShuttingDown) {
      this.reloadRequested = false
      const epoch = this.configEpoch
      await this.closeCurrentPort()

      if (epoch !== this.configEpoch || this.isShuttingDown) continue
      this.openConnection(epoch)
    }
  }

  private async closeCurrentPort(): Promise<void> {
    const port = this.serialPort
    if (!port) return

    loggerService.info('Reloading connection', SERVICE)
    this.serialPort = null
    this.expectedIrEchoes.clear()
    await new Promise<void>((resolve) => port.close(() => resolve()))
  }

  private openConnection(epoch: number): void {
    if (!this.comPort || !this.baudRate) {
      loggerService.warn('No comPort or baudRate defined', SERVICE)
      return
    }

    const port = new SerialPort({
      path: this.comPort,
      baudRate: this.baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false
    })
    this.serialPort = port
    let ended = false

    const finish = (error?: Error): void => {
      if (ended || epoch !== this.configEpoch || this.serialPort !== port) return
      ended = true
      this.serialPort = null
      this.expectedIrEchoes.clear()
      if (this.readyTimer) clearTimeout(this.readyTimer)
      this.readyTimer = null
      if (error) {
        loggerService.error(`Connection failed: ${error.message}`, SERVICE)
      } else {
        loggerService.info('Connection closed', SERVICE)
      }
      this.emit('status', this.getStatus())
      if (error && port.isOpen) {
        port.close(() => this.scheduleReconnect(epoch))
      } else {
        this.scheduleReconnect(epoch)
      }
    }

    port
      .on('error', finish)
      .on('close', () => finish())
      .open((err) => {
        if (epoch !== this.configEpoch || this.serialPort !== port) return

        if (err) {
          finish(err)
          return
        }

        loggerService.info(
          `Connection successful on ${this.comPort} at ${this.baudRate} baud`,
          SERVICE
        )
        this.emit('status', this.getStatus())

        // Tell Arduino we're ready, it will respond with current slider values
        // Small delay to let Arduino finish USB initialization before sending
        this.readyTimer = setTimeout(() => {
          this.readyTimer = null
          if (epoch === this.configEpoch && this.serialPort === port && port.isOpen) {
            port.write('app:ready\r\n')
          }
        }, 500)

        const decoder = new BoundedSerialFrameDecoder()
        port.on('data', (chunk: Buffer) => {
          if (epoch !== this.configEpoch || this.serialPort !== port) return
          const decoded = decoder.write(chunk)
          for (const rejection of decoded.rejections) {
            this.logRejectedInput(rejection)
          }

          for (const frame of decoded.frames) {
            if (this.expectedIrEchoes.consume(frame)) continue

            const parsed = parseSerialFrame(frame)
            if ('rejection' in parsed) {
              this.logRejectedInput(parsed.rejection)
              continue
            }

            const { type, ...data } = parsed.message
            if (type === 'deck') {
              loggerService.debug('Received validated deck event', SERVICE)
            }
            this.emit(`serial:${type}`, data)
          }
        })
      })
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true
    this.configEpoch += 1
    this.reloadRequested = false
    this.clearConnectionTimers()
    await this.reloadPromise
    await this.closeCurrentPort()
  }

  private clearConnectionTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.readyTimer) clearTimeout(this.readyTimer)
    this.reconnectTimer = null
    this.readyTimer = null
  }

  private logRejectedInput(reason: SerialRejectionReason): void {
    const now = Date.now()
    if (now - this.lastRejectionLogAt < REJECTION_LOG_INTERVAL_MS) {
      this.suppressedRejections += 1
      return
    }

    const suppressed = this.suppressedRejections
      ? `; ${this.suppressedRejections} additional rejections suppressed`
      : ''
    loggerService.warn(`Rejected serial input: ${reason}${suppressed}`, SERVICE)
    this.lastRejectionLogAt = now
    this.suppressedRejections = 0
  }

  private scheduleReconnect(epoch: number): void {
    if (this.reconnectTimer || this.isShuttingDown || epoch !== this.configEpoch) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (epoch === this.configEpoch) this.requestReload()
    }, 1000)
  }
}

export const serialService = new SerialService()
