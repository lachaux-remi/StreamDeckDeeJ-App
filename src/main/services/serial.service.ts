import { EventEmitter } from 'node:events'
import { readFile, realpath } from 'node:fs/promises'
import { ReadlineParser, SerialPort } from 'serialport'
import type { AppSettings } from '@main/types/settings.types'
import { configService } from './config.service'
import { loggerService } from './logger.service'

const SERVICE = 'SerialService'

class SerialService extends EventEmitter {
  private serialPort: SerialPort | null = null
  private comPort: string | undefined
  private baudRate: number | undefined

  constructor() {
    super()
    loggerService.debug('INIT', SERVICE)

    configService.onUpdated((config) => this.setConfig(config))
  }

  public async listPorts(): Promise<
    { path: string; displayName: string; manufacturer?: string }[]
  > {
    const ports = await SerialPort.list()
    return Promise.all(
      ports
        .filter((port) => port.manufacturer || (port as Record<string, unknown>).friendlyName)
        .map(async (port) => {
          const product = await this.getUsbProduct(port.path)
          const name = product || port.manufacturer
          return {
            path: port.path,
            displayName: name ? `${name} (${port.path})` : port.path,
            manufacturer: port.manufacturer || undefined
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
      this.serialPort.write(data)
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

        this.serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' })).on('data', (data) => {
          try {
            const json = JSON.parse(data)
            if (json.type) {
              const type = json.type
              if (type !== 'deej') {
                loggerService.debug(`Received data: ${data}`, SERVICE)
              }
              delete json.type
              this.emit(`serial:${type}`, json)
            }
          } catch (error) {
            loggerService.error(`Error parsing data: ${error}`, SERVICE)
          }
        })
      })
  }

  private reconnect(): void {
    this.serialPort = null
    this.emit('status', this.getStatus())
    setTimeout(() => this.reloadConnection(), 1000)
  }
}

export const serialService = new SerialService()
