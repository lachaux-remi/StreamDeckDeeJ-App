import type { AppSettings } from '@main/types/settings.types'
import { homeAssistantButtonEntities } from './home-assistant-state-sync'

const AUTH_TIMEOUT_MS = 10_000
const PING_INTERVAL_MS = 30_000
const PONG_TIMEOUT_MS = 10_000
const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 60_000
/** Wait before retrying a server that rejected the token or the subscription. */
const REJECTED_RETRY_DELAY_MS = 5 * 60_000
const MAX_MESSAGE_LENGTH = 4 * 1024 * 1024

type LiveConfig = Pick<AppSettings, 'homeAssistant' | 'streamdeck'>

/** The subset of the WHATWG WebSocket API used here (global in Node 24). */
export interface LiveSocket {
  readonly readyState: number
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  send(data: string): void
  close(): void
}

export interface HomeAssistantLiveStatesOptions {
  setButtonState(key: string, state: string): void
  /** Called when live updates start (true) or stop (false) being delivered. */
  onLiveChange(live: boolean): void
  log?(level: 'debug' | 'warn' | 'error', message: string): void
  createSocket?(url: string): LiveSocket
  setTimeout?: typeof setTimeout
  clearTimeout?: typeof clearTimeout
}

type Message = Record<string, unknown>

function isRecord(value: unknown): value is Message {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `http(s)://host[/prefix]` → `ws(s)://host[/prefix]/api/websocket`. */
export function homeAssistantWebSocketUrl(url: string): string {
  return `${url.replace(/^http/, 'ws').replace(/\/+$/, '')}/api/websocket`
}

/**
 * Keeps Stream Deck LEDs in sync with Home Assistant through its WebSocket
 * API. `subscribe_entities` filters on the server to the entities used by the
 * buttons and pushes their current state, then only their changes.
 */
export class HomeAssistantLiveStates {
  private readonly options: Required<Omit<HomeAssistantLiveStatesOptions, 'log'>> &
    Pick<HomeAssistantLiveStatesOptions, 'log'>
  private config: LiveConfig | undefined
  private entities = new Map<string, string[]>()
  private subscribedMapping: string | undefined
  private socket: LiveSocket | undefined
  private generation = 0
  private nextId = 1
  private authenticated = false
  private subscriptionId: number | undefined
  private live = false
  private stopped = true
  private failures = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private authTimer: ReturnType<typeof setTimeout> | undefined
  private pingTimer: ReturnType<typeof setTimeout> | undefined
  private pongTimer: ReturnType<typeof setTimeout> | undefined

  constructor(options: HomeAssistantLiveStatesOptions) {
    this.options = {
      createSocket: (url) => new WebSocket(url) as unknown as LiveSocket,
      setTimeout,
      clearTimeout,
      ...options
    }
  }

  start(config: LiveConfig): void {
    this.stopped = false
    this.update(config)
  }

  update(config: LiveConfig): void {
    const previous = this.config
    this.config = config
    this.entities = homeAssistantButtonEntities(config)
    if (this.stopped) {
      return
    }
    const endpointChanged =
      config.homeAssistant.url !== previous?.homeAssistant.url ||
      config.homeAssistant.token !== previous?.homeAssistant.token
    if (endpointChanged || !this.socket) {
      this.failures = 0
      this.reconnect(0)
      return
    }
    if (this.authenticated && this.mappingKey() !== this.subscribedMapping) {
      this.subscribe()
    }
  }

  private mappingKey(): string {
    return JSON.stringify([...this.entities].sort(([a], [b]) => a.localeCompare(b)))
  }

  shutdown(): void {
    this.stopped = true
    this.disconnect()
  }

  private log(level: 'debug' | 'warn' | 'error', message: string): void {
    this.options.log?.(level, message)
  }

  private setLive(live: boolean): void {
    if (live !== this.live) {
      this.live = live
      this.options.onLiveChange(live)
    }
  }

  private clearTimer(timer: ReturnType<typeof setTimeout> | undefined): undefined {
    if (timer) {
      this.options.clearTimeout(timer)
    }
    return undefined
  }

  private disconnect(): void {
    this.generation += 1
    this.reconnectTimer = this.clearTimer(this.reconnectTimer)
    this.authTimer = this.clearTimer(this.authTimer)
    this.pingTimer = this.clearTimer(this.pingTimer)
    this.pongTimer = this.clearTimer(this.pongTimer)
    this.authenticated = false
    this.subscriptionId = undefined
    this.subscribedMapping = undefined
    const socket = this.socket
    this.socket = undefined
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null
      socket.close()
    }
    this.setLive(false)
  }

  private reconnect(delay: number): void {
    this.disconnect()
    if (this.stopped) {
      return
    }
    const generation = this.generation
    this.reconnectTimer = this.options.setTimeout(() => {
      this.reconnectTimer = undefined
      if (generation === this.generation) {
        this.connect()
      }
    }, delay)
  }

  private retryLater(): void {
    this.failures += 1
    const delay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** Math.min(this.failures - 1, 6)
    )
    this.reconnect(delay)
  }

  private connect(): void {
    const config = this.config
    if (this.stopped || !config?.homeAssistant.url || !config.homeAssistant.token) {
      return
    }
    const generation = this.generation
    let socket: LiveSocket
    try {
      socket = this.options.createSocket(homeAssistantWebSocketUrl(config.homeAssistant.url))
    } catch (error) {
      this.log('warn', `Home Assistant WebSocket unavailable: ${String(error)}`)
      this.retryLater()
      return
    }
    this.socket = socket
    this.nextId = 1

    const current = (): boolean => generation === this.generation && this.socket === socket
    socket.onmessage = (event) => {
      if (current()) {
        this.handleRaw(event.data)
      }
    }
    socket.onclose = () => {
      if (current()) {
        this.log('debug', 'Home Assistant WebSocket closed')
        this.retryLater()
      }
    }
    socket.onerror = () => {
      if (current()) {
        this.log('debug', 'Home Assistant WebSocket error')
      }
    }
    this.authTimer = this.options.setTimeout(() => {
      if (current()) {
        this.log('warn', 'Home Assistant WebSocket authentication timed out')
        this.retryLater()
      }
    }, AUTH_TIMEOUT_MS)
  }

  private send(message: Message): void {
    try {
      this.socket?.send(JSON.stringify(message))
    } catch (error) {
      this.log('debug', `Home Assistant WebSocket send failed: ${String(error)}`)
    }
  }

  private handleRaw(data: unknown): void {
    if (typeof data !== 'string' || data.length > MAX_MESSAGE_LENGTH) {
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    // Home Assistant may coalesce several messages into one JSON array.
    for (const message of Array.isArray(parsed) ? parsed : [parsed]) {
      if (isRecord(message)) {
        this.handleMessage(message)
      }
    }
  }

  private handleMessage(message: Message): void {
    switch (message.type) {
      case 'auth_required':
        this.send({ type: 'auth', access_token: this.config?.homeAssistant.token })
        return
      case 'auth_ok':
        this.authTimer = this.clearTimer(this.authTimer)
        this.authenticated = true
        this.failures = 0
        this.schedulePing()
        this.subscribe()
        return
      case 'auth_invalid':
        this.log('error', 'Home Assistant rejected the access token')
        this.reconnect(REJECTED_RETRY_DELAY_MS)
        return
      case 'result':
        this.handleResult(message)
        return
      case 'pong':
        this.pongTimer = this.clearTimer(this.pongTimer)
        this.schedulePing()
        return
      case 'event':
        if (message.id === this.subscriptionId && isRecord(message.event)) {
          this.applyStates(message.event)
        }
        return
      default:
        return
    }
  }

  private subscribe(): void {
    const previous = this.subscriptionId
    if (previous !== undefined) {
      this.send({ id: this.nextId++, type: 'unsubscribe_events', subscription: previous })
      this.subscriptionId = undefined
    }
    this.subscribedMapping = this.mappingKey()
    const entityIds = [...this.entities.keys()].sort()
    if (entityIds.length === 0) {
      // Nothing to watch: no subscription, and polling has nothing to do either.
      this.setLive(true)
      return
    }
    this.subscriptionId = this.nextId++
    this.send({ id: this.subscriptionId, type: 'subscribe_entities', entity_ids: entityIds })
  }

  private handleResult(message: Message): void {
    if (message.id !== this.subscriptionId) {
      return
    }
    if (message.success === true) {
      this.setLive(true)
      return
    }
    // Older Home Assistant versions do not know subscribe_entities.
    this.log('warn', 'Home Assistant refused the entity subscription; polling instead')
    this.reconnect(REJECTED_RETRY_DELAY_MS)
  }

  /** Applies a compressed state event: additions (a), changes (c), removals (r). */
  private applyStates(event: Message): void {
    const updates = new Map<string, string>()
    if (isRecord(event.a)) {
      for (const [entityId, entity] of Object.entries(event.a)) {
        if (isRecord(entity) && typeof entity.s === 'string') {
          updates.set(entityId, entity.s)
        }
      }
    }
    if (isRecord(event.c)) {
      for (const [entityId, diff] of Object.entries(event.c)) {
        const added = isRecord(diff) ? diff['+'] : undefined
        if (isRecord(added) && typeof added.s === 'string') {
          updates.set(entityId, added.s)
        }
      }
    }
    if (Array.isArray(event.r)) {
      for (const entityId of event.r) {
        if (typeof entityId === 'string') {
          updates.set(entityId, 'unavailable')
        }
      }
    }
    for (const [entityId, state] of updates) {
      for (const key of this.entities.get(entityId) ?? []) {
        this.options.setButtonState(key, state)
      }
    }
  }

  // Detects half-open connections (e.g. after sleep or a network change).
  private schedulePing(): void {
    this.pingTimer = this.clearTimer(this.pingTimer)
    const generation = this.generation
    this.pingTimer = this.options.setTimeout(() => {
      if (generation !== this.generation) {
        return
      }
      this.send({ id: this.nextId++, type: 'ping' })
      this.pongTimer = this.options.setTimeout(() => {
        if (generation === this.generation) {
          this.log('warn', 'Home Assistant WebSocket stopped answering pings')
          this.retryLater()
        }
      }, PONG_TIMEOUT_MS)
    }, PING_INTERVAL_MS)
  }
}
