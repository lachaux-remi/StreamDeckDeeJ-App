import * as net from 'node:net'
import { EventEmitter } from 'node:events'
import { lstat } from 'node:fs/promises'
import { configService } from './config.service'
import { DiscordRpcFrameReader } from './discord-rpc-codec'
import { loggerService } from './logger.service'

const SERVICE = 'DiscordService'
const RECONNECT_DELAY = 10_000
// Discord's internal redirect URI used for the RPC authorization code flow
const DISCORD_REDIRECT_URI = 'https://discord.com/api/oauth2/authorize'

const OP_HANDSHAKE = 0
const OP_FRAME = 1
const WINDOWS_DISCORD_PIPE_PREFIX = '\\\\?\\pipe\\discord-ipc-'

interface RpcMessage {
  cmd?: string
  evt?: string
  nonce?: string
  data?: unknown
}

export function discordSocketPaths(
  platform: NodeJS.Platform,
  index: number,
  environment: NodeJS.ProcessEnv
): string[] {
  if (platform === 'win32') {
    return [`${WINDOWS_DISCORD_PIPE_PREFIX}${index}`]
  }
  const paths: string[] = []
  const xdg = environment['XDG_RUNTIME_DIR']
  if (xdg) {
    paths.push(`${xdg}/discord-ipc-${index}`)
    paths.push(`${xdg}/app/com.discordapp.Discord/discord-ipc-${index}`)
  }
  paths.push(`/tmp/discord-ipc-${index}`)
  return paths
}

class DiscordService extends EventEmitter {
  private socket: net.Socket | null = null
  private muted = false
  private deafened = false
  private streaming = false
  private _connected = false
  private isShuttingDown = false
  private readonly frameReader = new DiscordRpcFrameReader(() => {
    loggerService.warn('Discord RPC: oversized frame rejected', SERVICE)
    this.socket?.destroy()
  })
  private reconnectTimer: NodeJS.Timeout | null = null

  async init(): Promise<void> {
    void this.connect()
    loggerService.info('DiscordService initialisé', SERVICE)
  }

  reconnect(): void {
    if (this.isShuttingDown) {
      return
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this._connected = false
    void this.connect()
  }

  isMuted(): boolean {
    return this.muted
  }
  isDeafened(): boolean {
    return this.deafened
  }
  isStreaming(): boolean {
    return this.streaming
  }
  isConnected(): boolean {
    return this._connected
  }

  shutdown(): void {
    this.isShuttingDown = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.destroy()
    this.socket = null
    this._connected = false
  }

  private socketPaths(index: number): string[] {
    return discordSocketPaths(process.platform, index, process.env)
  }

  private async isTrustedSocket(path: string): Promise<boolean> {
    if (process.platform === 'win32') {
      return path.startsWith(WINDOWS_DISCORD_PIPE_PREFIX)
    }
    const uid = process.getuid?.()
    if (uid === undefined) {
      return false
    }

    try {
      const socket = await lstat(path)
      return socket.isSocket() && socket.uid === uid && (socket.mode & 0o022) === 0
    } catch {
      return false
    }
  }

  private async connect(): Promise<void> {
    const clientId = configService.getConfig().discord?.clientId
    if (!clientId) {
      loggerService.debug('Discord RPC: client_id non configuré — ignoré', SERVICE)
      return
    }

    for (let i = 0; i < 10; i++) {
      for (const path of this.socketPaths(i)) {
        if (!(await this.isTrustedSocket(path))) {
          continue
        }

        try {
          await this.tryConnect(path, clientId)
          return
        } catch {
          // try next
        }
      }
    }
    loggerService.debug('Discord: aucun socket IPC trouvé, réessai dans 10s', SERVICE)
    this.scheduleReconnect()
  }

  private tryConnect(path: string, clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(path)

      const timeout = setTimeout(() => {
        sock.destroy()
        reject(new Error('connection timeout'))
      }, 1000)

      sock.once('connect', () => {
        clearTimeout(timeout)
        sock.removeAllListeners('error')
        this.socket = sock
        this.frameReader.reset()
        sock.on('data', (d: Buffer) => this.onData(d))
        sock.on('close', () => this.onDisconnect())
        sock.on('error', () => this.onDisconnect())
        this.writeFrame(OP_HANDSHAKE, { v: 1, client_id: clientId })
        resolve()
      })

      sock.once('error', (err) => {
        clearTimeout(timeout)
        sock.destroy()
        reject(err)
      })
    })
  }

  private onData(data: Buffer): void {
    for (const { op, payload } of this.frameReader.push(data)) {
      if (op === OP_FRAME) {
        try {
          this.onMessage(JSON.parse(payload) as RpcMessage)
        } catch {
          // ignore malformed JSON
        }
      }
    }
  }

  private onMessage(msg: RpcMessage): void {
    if (msg.evt === 'READY') {
      this._connected = true
      this.emit('change')
      void this.onReady()
    } else if (msg.cmd === 'AUTHORIZE' && msg.evt !== 'ERROR') {
      const code = (msg.data as { code?: string } | undefined)?.code
      if (code) {
        void this.handleAuthCode(code)
      }
    } else if (msg.cmd === 'AUTHENTICATE') {
      if (msg.evt === 'ERROR') {
        loggerService.warn('Discord RPC: token invalide, tentative de refresh', SERVICE)
        const discord = configService.getConfig().discord
        if (discord?.refreshToken) {
          void this.tryRefreshToken(discord.refreshToken)
        } else {
          if (discord) {
            configService.setConfig({
              discord: { ...discord, accessToken: undefined, refreshToken: undefined }
            })
          }
          this.authorize()
        }
      } else {
        loggerService.info('Discord RPC: authentifié avec succès', SERVICE)
        this.subscribeVoiceSettings()
      }
    } else if (msg.evt === 'VOICE_SETTINGS_UPDATE' || msg.cmd === 'GET_VOICE_SETTINGS') {
      const d = msg.data as { mute?: boolean; deaf?: boolean } | null | undefined
      if (!d) {
        return
      }
      const nm = !!d.mute
      const nd = !!d.deaf
      if (nm !== this.muted || nd !== this.deafened) {
        this.muted = nm
        this.deafened = nd
        this.emit('change')
      }
    } else if (msg.evt === 'SCREENSHARE_STATE_UPDATE') {
      const d = msg.data as { active?: boolean } | null | undefined
      const ns = !!d?.active
      if (ns !== this.streaming) {
        this.streaming = ns
        this.emit('change')
      }
    } else if (msg.evt === 'ERROR') {
      const code = (msg.data as { code?: number } | undefined)?.code
      loggerService.debug(`Discord RPC: erreur code=${code ?? '?'}`, SERVICE)
    }
  }

  private async onReady(): Promise<void> {
    const discord = configService.getConfig().discord
    if (!discord) {
      return
    }

    if (discord.accessToken) {
      this.authenticate(discord.accessToken)
    } else if (discord.clientSecret) {
      this.authorize()
    } else {
      loggerService.warn('Discord RPC: client_secret manquant dans les paramètres', SERVICE)
    }
  }

  private authorize(): void {
    const clientId = configService.getConfig().discord?.clientId
    if (!clientId) {
      return
    }
    loggerService.info(
      "Discord RPC: demande d'autorisation (accepte la popup dans Discord)",
      SERVICE
    )
    this.writeFrame(OP_FRAME, {
      cmd: 'AUTHORIZE',
      args: {
        client_id: clientId,
        scopes: [
          'rpc',
          'rpc.voice.read',
          'rpc.notifications.read',
          'rpc.video.read',
          'rpc.screenshare.read'
        ],
        prompt: 'consent'
      },
      nonce: 'authorize'
    })
  }

  private async handleAuthCode(code: string): Promise<void> {
    const discord = configService.getConfig().discord
    if (!discord?.clientId || !discord?.clientSecret) {
      return
    }

    try {
      const resp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: discord.clientId,
          client_secret: discord.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: DISCORD_REDIRECT_URI
        })
      })

      const data = (await resp.json()) as {
        access_token?: string
        refresh_token?: string
        error?: string
      }

      if (data.access_token) {
        configService.setConfig({
          discord: { ...discord, accessToken: data.access_token, refreshToken: data.refresh_token }
        })
        loggerService.info('Discord RPC: token OAuth obtenu et sauvegardé', SERVICE)
        this.authenticate(data.access_token)
      } else {
        loggerService.warn(
          `Discord RPC: échange de token échoué (${data.error ?? 'unknown'}) — vérifiez client_secret`,
          SERVICE
        )
      }
    } catch (err) {
      loggerService.warn(`Discord RPC: erreur réseau lors de l'échange: ${err}`, SERVICE)
    }
  }

  private async tryRefreshToken(refreshToken: string): Promise<void> {
    const discord = configService.getConfig().discord
    if (!discord?.clientId || !discord?.clientSecret) {
      return
    }
    try {
      const resp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: discord.clientId,
          client_secret: discord.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      })
      const data = (await resp.json()) as {
        access_token?: string
        refresh_token?: string
        error?: string
      }
      if (data.access_token) {
        configService.setConfig({
          discord: {
            ...discord,
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? refreshToken
          }
        })
        loggerService.info('Discord RPC: token rafraîchi silencieusement', SERVICE)
        this.authenticate(data.access_token)
      } else {
        loggerService.warn('Discord RPC: refresh échoué, relance autorisation', SERVICE)
        configService.setConfig({
          discord: { ...discord, accessToken: undefined, refreshToken: undefined }
        })
        this.authorize()
      }
    } catch (err) {
      loggerService.warn(`Discord RPC: erreur réseau lors du refresh: ${err}`, SERVICE)
      configService.setConfig({
        discord: { ...discord, accessToken: undefined, refreshToken: undefined }
      })
      this.authorize()
    }
  }

  private authenticate(token: string): void {
    this.writeFrame(OP_FRAME, {
      cmd: 'AUTHENTICATE',
      args: { access_token: token },
      nonce: 'authenticate'
    })
  }

  private subscribeVoiceSettings(): void {
    this.writeFrame(OP_FRAME, {
      cmd: 'SUBSCRIBE',
      args: {},
      evt: 'VOICE_SETTINGS_UPDATE',
      nonce: 'sub-voice'
    })
    this.writeFrame(OP_FRAME, {
      cmd: 'GET_VOICE_SETTINGS',
      args: {},
      nonce: `get-voice-${Date.now()}`
    })
    this.writeFrame(OP_FRAME, {
      cmd: 'SUBSCRIBE',
      args: {},
      evt: 'SCREENSHARE_STATE_UPDATE',
      nonce: 'sub-screenshare'
    })
  }

  private onDisconnect(): void {
    if (!this._connected && !this.socket) {
      return
    }
    this.socket?.destroy()
    this.socket = null
    const hadState = this._connected
    this._connected = false
    if (this.muted || this.deafened || this.streaming) {
      this.muted = false
      this.deafened = false
      this.streaming = false
      this.emit('change')
    } else if (hadState) {
      this.emit('change')
    }
    loggerService.debug('Discord RPC: déconnecté', SERVICE)
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) {
      return
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, RECONNECT_DELAY)
  }

  private writeFrame(op: number, data: unknown): void {
    if (!this.socket) {
      return
    }
    const json = JSON.stringify(data)
    const buf = Buffer.allocUnsafe(8 + Buffer.byteLength(json))
    buf.writeUInt32LE(op, 0)
    buf.writeUInt32LE(Buffer.byteLength(json), 4)
    buf.write(json, 8)
    this.socket.write(buf)
  }
}

export const discordService = new DiscordService()
