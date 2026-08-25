import { EventEmitter } from 'node:events'
import type { AppSettings } from '@main/types/settings.types'
import { configService } from './config.service'
import { loggerService } from './logger.service'
import { serialService } from './serial.service'
import type { DeejSerialMessage } from './serial-protocol'

const SERVICE = 'SliderService'

class SliderService extends EventEmitter {
  private readonly sliders: Record<string, number> = {}
  private readonly pow: number = Math.pow(10, 3)
  private invertSliders: boolean = false

  constructor() {
    super()
    loggerService.debug('INIT', SERVICE)

    configService.onUpdated((config) => this.setConfig(config))

    serialService.on('serial:deej', (data) => this.deejEventHandler(data))
  }

  public getSliders(): Record<string, number> {
    return this.sliders
  }

  public getSlider(sliderKey: string): number {
    return this.sliders[sliderKey] || 0
  }

  public onUpdated(listener: (sliders: Record<string, number>) => void): () => void {
    this.on('sliders:batch', listener)
    return () => this.off('sliders:batch', listener)
  }

  private setConfig(config: Partial<AppSettings>): void {
    if (this.invertSliders !== config.invertSliders) {
      this.invertSliders = config.invertSliders || false
    }
  }

  private deejEventHandler(data: Omit<DeejSerialMessage, 'type'>): void {
    let changed = false
    for (const [sliderKey, sliderValue] of Object.entries(data.value)) {
      let value = sliderValue / 2 ** 10
      value = value > 1 ? 1 : value < 0 ? 0 : value
      value = this.invertSliders ? 1 - value : value
      value = Math.round(value * this.pow * (1 + Number.EPSILON)) / this.pow

      const previousValue = this.sliders[sliderKey]
      if (previousValue === undefined || Math.abs(previousValue - value) >= 0.009) {
        this.sliders[sliderKey] = value
        changed = true
      }
    }
    if (changed) {
      this.emit('sliders:batch', this.sliders)
    }
  }
}

export const sliderService = new SliderService()
