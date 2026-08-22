import { EventEmitter } from 'node:events'
import HomeAssistantAPI from '@main/libs/home-assistant/HomeAssistantAPI'
import { KeyUsageEnum, ModuleEnum } from '@main/types/enums'
import type { StreamdeckInputConfig, StreamdeckInputKey } from '@main/types/settings.types'
import { configService } from './config.service'
import { HomeAssistantStateSync } from './home-assistant-state-sync'
import { ledService } from './led.service'
import { loggerService } from './logger.service'
import { serialService } from './serial.service'
import type { DeckSerialMessage } from './serial-protocol'

const SERVICE = 'DeckService'

class DeckService extends EventEmitter {
  private keyState: Record<string, KeyUsageEnum.Hold | KeyUsageEnum.Pressed> = {}
  private brightnessState: Record<string, number> = {}
  private readonly homeAssistantStateSync = new HomeAssistantStateSync({
    setButtonState: (key, state) => ledService.setHAButtonState(key, state)
  })

  constructor() {
    super()
    loggerService.debug('INIT', SERVICE)
    serialService.on('serial:deck', (data) => this.deckEventHandler(data))
    configService.onUpdated((config) => this.homeAssistantStateSync.update(config))
    this.homeAssistantStateSync.start(configService.getConfig())
  }

  public shutdown(): void {
    this.homeAssistantStateSync.shutdown()
  }

  public onUpdated(listener: (deckKey: string, value: Record<string, unknown>) => void): void {
    this.on('deck:updated', listener)
  }

  public getKeyInfo(deckKey: string): Record<string, unknown> | undefined {
    const deckConfig: StreamdeckInputConfig | undefined =
      configService.getConfig().streamdeck?.[deckKey]
    if (!deckConfig) return undefined

    const info: Record<string, unknown> = {}
    if (deckConfig.pressed) {
      info[KeyUsageEnum.Pressed] = deckConfig.pressed
    }
    if (deckConfig.hold) {
      info[KeyUsageEnum.Hold] = deckConfig.hold
    }
    return info
  }

  private deckEventHandler(data: Omit<DeckSerialMessage, 'type'>): void {
    const deckKey = data.value.toString().toLowerCase()

    if (data.state === KeyUsageEnum.Released) {
      const deckConfig: StreamdeckInputConfig | undefined =
        configService.getConfig().streamdeck?.[deckKey]
      if (!deckConfig) return

      const currentState = this.keyState[deckKey]
      if (!currentState) return

      const stateConfig: StreamdeckInputKey | undefined =
        currentState === KeyUsageEnum.Pressed ? deckConfig.pressed : deckConfig.hold
      if (!stateConfig) return

      loggerService.debug(
        `Key ${deckKey} ${currentState} -> ${stateConfig.module}: ${stateConfig.params.join(', ')}`,
        SERVICE
      )

      if (stateConfig.module === ModuleEnum.Macro || stateConfig.module === ModuleEnum.Ir) {
        serialService.send(`${stateConfig.module}:${stateConfig.params[0]}`)
      } else if (stateConfig.module === ModuleEnum.HomeAssistant) {
        const homeAssistant = configService.getConfig().homeAssistant
        if (!homeAssistant?.url || !homeAssistant?.token) return

        const stepParam = stateConfig.params[2]
        let service = stateConfig.params[0]
        let extraData: Record<string, unknown> | undefined
        if (stepParam) {
          const step = parseInt(stepParam, 10)
          if (!isNaN(step) && step > 0) {
            const current = this.brightnessState[deckKey] ?? 0
            const next = current + step > 100 ? step : current + step
            this.brightnessState[deckKey] = next
            service = 'light.turn_on'
            extraData = { brightness_pct: next }
          }
        }

        new HomeAssistantAPI(homeAssistant.url, homeAssistant.token)
          .callService(service, stateConfig.params[1], extraData)
          .then((states) => {
            const result = states[0] ?? {}
            const entityState = result.state as string | undefined
            if (entityState) ledService.setHAButtonState(deckKey, entityState)
            this.emit('deck:updated', deckKey, result)
          })
          .catch((err) => loggerService.error(`Error calling Home Assistant: ${err}`, SERVICE))
      }
    } else {
      this.keyState[deckKey] = data.state === 'pressed' ? KeyUsageEnum.Pressed : KeyUsageEnum.Hold
    }
  }
}

export const deckService = new DeckService()
