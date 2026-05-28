import * as net from 'node:net'
import { EventEmitter } from 'node:events'
import { configService } from './config.service'
import { loggerService } from './logger.service'

const SERVICE = 'DiscordService'
const RECONNECT_DELAY = 10_000
// Discord's internal redirect URI used for the RPC authorization code flow
const DISCORD_REDIRECT_URI = 'https://discord.com/api/oauth2/authorize'

const OP_HANDSHAKE = 0
const OP_FRAME = 1

interface RpcMessage {
  cmd?: string
  evt?: string
  nonce?: string
  data?: unknown
}

class DiscordService extends EventEmitter {
  private socket: net.Socket | null = null
  private muted = false
  private deafened = false
  private _connected = false
  private buf = Buffer.alloc(0)
  private reconnectTimer: NodeJS.Timeout | null = null

  async init(): Promise<void> {
    void this.connect()
    loggerService.info('DiscordService initialisé', SERVICE)
  }

  reconnect(): void {
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

  isMuted(): boolean { return this.muted }
  isDeafened(): boolean { return this.deafened }
  isConnected(): boolean { return this._connected }

  private socketPaths(index: number): string[] {
    const paths = [`/tmp/discord-ipc-${index}`]
    const xdg = process.env['XDG_RUNTIME_DIR']
    if (xdg) {
      paths.push(`${xdg}/discord-ipc-${index}`)
      paths.push(`${xdg}/app/com.discordapp.Discord/discord-ipc-${index}`)
    }
    return paths
  }

  private async connect(): Promise<void> {
    const clientId = configService.getConfig().discord?.clientId
    if (!clientId) {
      loggerService.debug('Discord RPC: client_id non configuré — ignoré', SERVICE)
      return
    }

    for (let i = 0; i < 10; i++) {
      for (const path of this.socketPaths(i)) {
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
        this.buf = Buffer.alloc(0)
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
    this.buf = Buffer.concat([this.buf, data])
    while (this.buf.length >= 8) {
      const payloadLen = this.buf.readUInt32LE(4)
      if (this.buf.length < 8 + payloadLen) break
      const op = this.buf.readUInt32LE(0)
      const payload = this.buf.subarray(8, 8 + payloadLen).toString('utf8')
      this.buf = this.buf.subarray(8 + payloadLen)
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
      if (code) void this.handleAuthCode(code)
    } else if (msg.cmd === 'AUTHENTICATE') {
      if (msg.evt === 'ERROR') {
        loggerService.warn('Discord RPC: token invalide, relance authentification', SERVICE)
        const discord = configService.getConfig().discord
        if (discord) configService.setConfig({ discord: { ...discord, accessToken: undefined } })
        this.authorize()
      } else {
        loggerService.info('Discord RPC: authentifié avec succès', SERVICE)
        this.subscribeVoiceSettings()
      }
    } else if (msg.evt === 'VOICE_SETTINGS_UPDATE' || msg.cmd === 'GET_VOICE_SETTINGS') {
      const d = msg.data as { mute?: boolean; deaf?: boolean } | null | undefined
      if (!d) return
      const nm = !!d.mute
      const nd = !!d.deaf
      if (nm !== this.muted || nd !== this.deafened) {
        this.muted = nm
        this.deafened = nd
        this.emit('change')
      }
    } else if (msg.evt === 'ERROR') {
      const code = (msg.data as { code?: number } | undefined)?.code
      loggerService.debug(`Discord RPC: erreur code=${code ?? '?'}`, SERVICE)
    }
  }

  private async onReady(): Promise<void> {
    const discord = configService.getConfig().discord
    if (!discord) return

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
    if (!clientId) return
    loggerService.info('Discord RPC: demande d\'autorisation (accepte la popup dans Discord)', SERVICE)
    this.writeFrame(OP_FRAME, {
      cmd: 'AUTHORIZE',
      args: {
        client_id: clientId,
        scopes: [
          'rpc','rpc.voice.write','rpc.voice.read','rpc.video.write','rpc.activities.write','rpc.notifications.read','rpc.video.read','rpc.screenshare.write','rpc.screenshare.read'
        ],
        prompt: 'consent'
      },
      nonce: 'authorize'
    })
  }

  private async handleAuthCode(code: string): Promise<void> {
    const discord = configService.getConfig().discord
    if (!discord?.clientId || !discord?.clientSecret) return

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

      const data = await resp.json() as { access_token?: string; error?: string }

      if (data.access_token) {
        configService.setConfig({ discord: { ...discord, accessToken: data.access_token } })
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
  }

  private onDisconnect(): void {
    if (!this._connected && !this.socket) return
    this.socket?.destroy()
    this.socket = null
    const hadState = this._connected
    this._connected = false
    if (this.muted || this.deafened) {
      this.muted = false
      this.deafened = false
      this.emit('change')
    } else if (hadState) {
      this.emit('change')
    }
    loggerService.debug('Discord RPC: déconnecté', SERVICE)
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, RECONNECT_DELAY)
  }

  private writeFrame(op: number, data: unknown): void {
    if (!this.socket) return
    const json = JSON.stringify(data)
    const buf = Buffer.allocUnsafe(8 + Buffer.byteLength(json))
    buf.writeUInt32LE(op, 0)
    buf.writeUInt32LE(Buffer.byteLength(json), 4)
    buf.write(json, 8)
    this.socket.write(buf)
  }
}

export const discordService = new DiscordService()
