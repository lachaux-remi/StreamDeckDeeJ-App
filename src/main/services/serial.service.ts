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
      this.reloadConnection().catch((error) =>
        loggerService.error(`Error reloading connection: ${error}`, SERVICE)
      )
    }
  }

  private async reloadConnection(): Promise<void> {
    if (this.serialPort) {
      loggerService.info('Reloading connection', SERVICE)
      this.expectedIrEchoes.clear()
      await new Promise<void>((resolve) => this.serialPort?.close(() => resolve()))
      this.serialPort = null
      return
    }

    if (!this.comPort || !this.baudRate) {
      loggerService.warn('No comPort or baudRate defined', SERVICE)
      return
    }

    this.serialPort = new SerialPort({
      path: this.comPort,
      baudRate: this.baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false
    })

    this.serialPort
      .on('close', () => {
        loggerService.info('Connection closed', SERVICE)
        this.reconnect()
      })
      .open((err) => {
        if (!this.serialPort) return

        if (err) {
          const msg = (err as Error)?.message
          loggerService.error(`Connection failed: ${msg}`, SERVICE)
          this.reconnect()
          return
        }

        loggerService.info(
          `Connection successful on ${this.comPort} at ${this.baudRate} baud`,
          SERVICE
        )
        this.emit('status', this.getStatus())

        // Tell Arduino we're ready, it will respond with current slider values
        // Small delay to let Arduino finish USB initialization before sending
        setTimeout(() => this.serialPort?.write('app:ready\r\n'), 500)

        const decoder = new BoundedSerialFrameDecoder()
        this.serialPort.on('data', (chunk: Buffer) => {
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

  private reconnect(): void {
    this.serialPort = null
    this.expectedIrEchoes.clear()
    this.emit('status', this.getStatus())
    setTimeout(() => this.reloadConnection(), 1000)
  }
}

export const serialService = new SerialService()
