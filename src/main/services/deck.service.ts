import { EventEmitter } from 'node:events'
import HomeAssistantAPI from '@main/libs/home-assistant/HomeAssistantAPI'
import { KeyUsageEnum, ModuleEnum } from '@main/types/enums'
import type { AppSettings, StreamdeckInputConfig, StreamdeckInputKey } from '@main/types/settings.types'
import { configService } from './config.service'
import { ledService } from './led.service'
import { loggerService } from './logger.service'
import { serialService } from './serial.service'

const SERVICE = 'DeckService'

class DeckService extends EventEmitter {
  private keyState: Record<string, KeyUsageEnum.Hold | KeyUsageEnum.Pressed> = {}
  private brightnessState: Record<string, number> = {}

  constructor() {
    super()
    loggerService.debug('INIT', SERVICE)
    serialService.on('serial:deck', (data) => this.deckEventHandler(data))
    configService.onUpdated((config) => this.syncHAStates(config))
    setInterval(() => this.syncHAStates(configService.getConfig()), 10_000)
  }

  private syncHAStates(config: AppSettings): void {
    const { homeAssistant, streamdeck } = config
    if (!homeAssistant?.url || !homeAssistant?.token) return
    const api = new HomeAssistantAPI(homeAssistant.url, homeAssistant.token)
    for (const [key, btnCfg] of Object.entries(streamdeck ?? {})) {
      const entityId = btnCfg.pressed?.module === ModuleEnum.HomeAssistant
        ? btnCfg.pressed.params[1]
        : btnCfg.hold?.module === ModuleEnum.HomeAssistant
          ? btnCfg.hold.params[1]
          : undefined
      const hasHACondition = btnCfg.ledConditions?.some(
        (c) => c.type === 'ha-on' || c.type === 'ha-off'
      )
      if (!entityId || !hasHACondition) continue
      api.getState(entityId)
        .then(({ state }) => ledService.setHAButtonState(key, state))
        .catch(() => {})
    }
  }

  public onUpdated(
    listener: (deckKey: string, value: Record<string, unknown>) => void
  ): void {
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

  private deckEventHandler(data: { state: KeyUsageEnum; value: string }): void {
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
          .catch((err) =>
            loggerService.error(`Error calling Home Assistant: ${err}`, SERVICE)
          )
      }
    } else {
      this.keyState[deckKey] = data.state as KeyUsageEnum.Hold | KeyUsageEnum.Pressed
    }
  }
}

export const deckService = new DeckService()
