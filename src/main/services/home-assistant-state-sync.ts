import HomeAssistantAPI from '@main/libs/home-assistant/HomeAssistantAPI'
import { ModuleEnum } from '@main/types/enums'
import type { AppSettings } from '@main/types/settings.types'

const DEFAULT_POLL_INTERVAL_MS = 10_000
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000

type SyncConfig = Pick<AppSettings, 'homeAssistant' | 'streamdeck'>

interface HomeAssistantStateSyncOptions {
  pollIntervalMs?: number
  requestTimeoutMs?: number
  getState?(
    url: string,
    token: string,
    entityId: string,
    signal: AbortSignal
  ): Promise<{ state: string }>
  setButtonState(key: string, state: string): void
}

interface InFlightRequest {
  endpoint: string
  entityId: string
  controller: AbortController
}

export class HomeAssistantStateSync {
  private readonly pollIntervalMs: number
  private readonly requestTimeoutMs: number
  private readonly getState: NonNullable<HomeAssistantStateSyncOptions['getState']>
  private readonly setButtonState: HomeAssistantStateSyncOptions['setButtonState']
  private readonly inFlight: InFlightRequest[] = []
  private config: SyncConfig | undefined
  private interval: ReturnType<typeof setInterval> | undefined
  private revision = 0
  private stopped = true

  constructor(options: HomeAssistantStateSyncOptions) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.getState =
      options.getState ??
      ((url, token, entityId, signal) =>
        new HomeAssistantAPI(url, token).getState(entityId, signal))
    this.setButtonState = options.setButtonState
  }

  public start(config: SyncConfig): void {
    if (this.interval) return
    this.stopped = false
    this.update(config)
    this.interval = setInterval(() => this.sync(), this.pollIntervalMs)
  }

  public update(config: SyncConfig): void {
    const targetChanged =
      config.homeAssistant.url !== this.config?.homeAssistant.url ||
      config.homeAssistant.token !== this.config?.homeAssistant.token
    this.config = config
    this.revision += 1
    if (targetChanged) this.abortInFlight()
    this.sync()
  }

  public shutdown(): void {
    this.stopped = true
    this.revision += 1
    if (this.interval) clearInterval(this.interval)
    this.interval = undefined
    this.abortInFlight()
    this.inFlight.length = 0
  }

  private sync(): void {
    const config = this.config
    if (this.stopped || !config?.homeAssistant.url || !config.homeAssistant.token) return

    const entities = new Map<string, string[]>()
    for (const [key, button] of Object.entries(config.streamdeck ?? {})) {
      const entityId =
        button.pressed?.module === ModuleEnum.HomeAssistant
          ? button.pressed.params[1]
          : button.hold?.module === ModuleEnum.HomeAssistant
            ? button.hold.params[1]
            : undefined
      const hasHomeAssistantCondition = button.ledConditions?.some(
        (condition) => condition.type === 'ha-on' || condition.type === 'ha-off'
      )
      if (!entityId || !hasHomeAssistantCondition) continue
      entities.set(entityId, [...(entities.get(entityId) ?? []), key])
    }

    for (const [entityId, keys] of entities) {
      if (
        this.inFlight.some(
          (request) =>
            request.endpoint === config.homeAssistant.url && request.entityId === entityId
        )
      ) {
        continue
      }
      this.requestState(config, entityId, keys)
    }
  }

  private requestState(config: SyncConfig, entityId: string, keys: string[]): void {
    const controller = new AbortController()
    const request = { endpoint: config.homeAssistant.url, entityId, controller }
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(this.requestTimeoutMs)])
    const revision = this.revision
    void this.getState(config.homeAssistant.url, config.homeAssistant.token, entityId, signal)
      .then(({ state }) => {
        if (this.stopped || revision !== this.revision) return
        for (const key of keys) this.setButtonState(key, state)
      })
      .catch(() => {})
      .finally(() => {
        const index = this.inFlight.indexOf(request)
        if (index === -1) return
        this.inFlight.splice(index, 1)
        if (!this.stopped && revision !== this.revision) this.sync()
      })
    this.inFlight.push(request)
  }

  private abortInFlight(): void {
    for (const request of this.inFlight) request.controller.abort()
  }
}
