import { EventEmitter } from 'node:events'
import HomeAssistantAPI from '@main/libs/home-assistant/HomeAssistantAPI'
import { KeyUsageEnum, ModuleEnum } from '@main/types/enums'
import type { StreamdeckInputConfig, StreamdeckInputKey } from '@main/types/settings.types'
import { configService } from './config.service'
import { loggerService } from './logger.service'
import { serialService } from './serial.service'

const SERVICE = 'DeckService'

class DeckService extends EventEmitter {
  private keyState: Record<string, KeyUsageEnum.Hold | KeyUsageEnum.Pressed> = {}

  constructor() {
    super()
    loggerService.debug('INIT', SERVICE)
    serialService.on('serial:deck', (data) => this.deckEventHandler(data))
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
        if (!homeAssistant?.url) return

        new HomeAssistantAPI(homeAssistant.url)
          .send(stateConfig.params[0], currentState, stateConfig.params[1])
          .then((info) => this.emit('deck:updated', deckKey, info))
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
