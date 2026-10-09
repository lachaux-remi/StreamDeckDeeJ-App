import HomeAssistantAPI from '@main/libs/home-assistant/HomeAssistantAPI'
import type { AppSettings } from '@main/types/settings.types'
import { homeAssistantSliderEntity } from '../../shared/deej-targets'
import { configService } from './config.service'
import { loggerService } from './logger.service'
import { sliderService } from './slider.service'

const SERVICE = 'HomeAssistantSliders'
/** Minimum delay between two calls for one entity while a slider moves. */
const MIN_INTERVAL_MS = 250

type SliderConfig = Pick<AppSettings, 'deej' | 'homeAssistant'>

interface ServiceCall {
  service: string
  data?: Record<string, unknown>
}

export interface HomeAssistantSlidersOptions {
  getConfig(): SliderConfig
  callService(service: string, entityId: string, data?: Record<string, unknown>): Promise<unknown>
  log?(level: 'debug' | 'warn', message: string): void
  setTimeout?: typeof setTimeout
  clearTimeout?: typeof clearTimeout
}

/** The Home Assistant call that sets `entityId` to a slider position (0–1). */
export function sliderServiceCall(entityId: string, value: number): ServiceCall | undefined {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  switch (entityId.slice(0, entityId.indexOf('.'))) {
    case 'light':
      return percent === 0
        ? { service: 'light.turn_off' }
        : { service: 'light.turn_on', data: { brightness_pct: percent } }
    case 'media_player':
      return { service: 'media_player.volume_set', data: { volume_level: percent / 100 } }
    case 'fan':
      return percent === 0
        ? { service: 'fan.turn_off' }
        : { service: 'fan.set_percentage', data: { percentage: percent } }
    case 'cover':
      return { service: 'cover.set_cover_position', data: { position: percent } }
    default:
      return undefined
  }
}

/**
 * Drives Home Assistant entities mapped to DeeJ sliders. Only movements are
 * sent: the position read when the app starts never changes an entity. Calls
 * are rate limited per entity and always end on the latest position.
 */
export class HomeAssistantSliders {
  private readonly options: Required<Omit<HomeAssistantSlidersOptions, 'log'>> &
    Pick<HomeAssistantSlidersOptions, 'log'>
  private readonly positions = new Map<string, number>()
  private readonly pending = new Map<string, ServiceCall>()
  private readonly busy = new Set<string>()
  private readonly lastSent = new Map<string, string>()
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()
  private stopped = false

  constructor(options: HomeAssistantSlidersOptions) {
    this.options = { setTimeout, clearTimeout, ...options }
  }

  update(sliders: Record<string, number>): void {
    const moved: [string, number][] = []
    for (const [slider, value] of Object.entries(sliders)) {
      const previous = this.positions.get(slider)
      this.positions.set(slider, value)
      if (previous !== undefined && previous !== value) {
        moved.push([slider, value])
      }
    }
    if (moved.length === 0 || this.stopped) {
      return
    }
    const config = this.options.getConfig()
    if (!config.homeAssistant?.url || !config.homeAssistant?.token) {
      return
    }
    for (const [slider, value] of moved) {
      for (const target of config.deej?.[slider] ?? []) {
        const entityId = homeAssistantSliderEntity(target)
        const call = entityId && sliderServiceCall(entityId, value)
        if (entityId && call) {
          this.pending.set(entityId, call)
          this.flush(entityId)
        }
      }
    }
  }

  shutdown(): void {
    this.stopped = true
    this.pending.clear()
    for (const timer of this.timers) {
      this.options.clearTimeout(timer)
    }
    this.timers.clear()
  }

  private flush(entityId: string): void {
    const call = this.pending.get(entityId)
    if (!call || this.busy.has(entityId) || this.stopped) {
      return
    }
    this.pending.delete(entityId)
    const key = JSON.stringify(call)
    if (this.lastSent.get(entityId) === key) {
      return
    }
    this.lastSent.set(entityId, key)
    this.busy.add(entityId)
    void this.options
      .callService(call.service, entityId, call.data)
      .catch((error) => {
        // Let the next movement retry the same position.
        this.lastSent.delete(entityId)
        this.options.log?.('warn', `Home Assistant slider call failed: ${String(error)}`)
      })
      .finally(() => {
        const timer = this.options.setTimeout(() => {
          this.timers.delete(timer)
          this.busy.delete(entityId)
          this.flush(entityId)
        }, MIN_INTERVAL_MS)
        this.timers.add(timer)
      })
  }
}

export function startHomeAssistantSliders(): HomeAssistantSliders {
  const sliders = new HomeAssistantSliders({
    getConfig: () => configService.getConfig(),
    callService: (service, entityId, data) => {
      const { url, token } = configService.getConfig().homeAssistant
      return new HomeAssistantAPI(url, token).callService(service, entityId, data)
    },
    log: (level, message) => loggerService[level](message, SERVICE)
  })
  sliderService.onUpdated((values) => sliders.update(values))
  return sliders
}
