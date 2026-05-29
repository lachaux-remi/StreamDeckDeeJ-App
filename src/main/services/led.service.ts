import HID from 'node-hid'
import type { AppSettings, LedColor, LedProfile, StreamdeckConfig } from '@main/types/settings.types'
import { configService } from './config.service'
import { loggerService } from './logger.service'
import { conditionService } from './condition.service'
import { discordService } from './discord.service'
import { micService } from './mic.service'
import { LedEngine, applyBrightness } from './led-engine'

const SERVICE = 'LedService'
const VID = 0x5239
const PID = 0x0001
const PACKET_SIZE = 64
const LED_COUNT = 16

const DEFAULT_PROFILE: LedProfile = {
  mode: 'rainbow',
  speed: 50,
  brightness: 80,
  startColor: { r: 0, g: 0, b: 255 },
  endColor: { r: 255, g: 0, b: 255 },
  direction: 'horizontal'
}

class LedService {
  private device: HID.HIDAsync | null = null
  private engine = new LedEngine()
  private animTimer: ReturnType<typeof setInterval> | null = null
  private profile: LedProfile = { ...DEFAULT_PROFILE }
  private overrides: Record<number, LedColor> = {}
  private buttonConfigs: StreamdeckConfig = {}
  private gridCols = 4
  private isShuttingDown = false
  private haButtonStates: Record<string, string> = {}

  async init(): Promise<void> {
    const config = configService.getConfig()
    this.profile = config.ledProfile ?? { ...DEFAULT_PROFILE }
    this.gridCols = config.gridCols ?? 4
    this.loadOverrides(config.streamdeck)
    this.buttonConfigs = config.streamdeck

    await this.connect()

    if (this.device) {
      this.startAnimation()
    }

    micService.on('change', () => void this.flush())
    discordService.on('change', () => void this.flush())

    configService.onUpdated((newConfig: AppSettings) => {
      this.profile = newConfig.ledProfile ?? { ...DEFAULT_PROFILE }
      this.gridCols = newConfig.gridCols ?? 4
      this.loadOverrides(newConfig.streamdeck)
      this.buttonConfigs = newConfig.streamdeck
    })
  }

  setHAButtonState(buttonKey: string, state: string): void {
    this.haButtonStates[buttonKey] = state
    void this.flush()
  }

  private loadOverrides(streamdeck: StreamdeckConfig): void {
    this.overrides = {}
    for (const [key, config] of Object.entries(streamdeck)) {
      const idx = Number(key)
      if (Number.isInteger(idx) && idx >= 0 && idx < LED_COUNT && config.color) {
        this.overrides[idx] = config.color
      }
    }
  }

  updateProfile(profile: LedProfile): void {
    this.profile = profile
  }

  updateOverrides(streamdeck: StreamdeckConfig): void {
    this.loadOverrides(streamdeck)
  }

  async flush(): Promise<void> {
    if (!this.device || this.isShuttingDown) return
    try {
      const base = this.engine.compute(this.profile, LED_COUNT, this.gridCols, performance.now())

      for (let i = 0; i < LED_COUNT; i++) {
        const btnCfg = this.buttonConfigs[String(i)]
        if (btnCfg?.ledConditions?.length) {
          const haState = this.haButtonStates[String(i)]
          const condColor = conditionService.resolveColor(btnCfg.ledConditions, haState)
          if (condColor) {
            base[i] = applyBrightness(condColor, this.profile.brightness)
            continue
          }
        }
        if (this.overrides[i]) {
          base[i] = applyBrightness(this.overrides[i], this.profile.brightness)
        }
      }

      const packet = this.buildPacket(base)
      await this.device.write(packet)
    } catch (err) {
      loggerService.warn(`LED flush error: ${err}`, SERVICE)
      this.device = null
      this.stopAnimation()
      setTimeout(() => {
        void this.connect().then(() => {
          if (this.device) this.startAnimation()
        })
      }, 5000)
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    this.stopAnimation()

    if (!this.device) return
    try {
      const blackPacket = this.buildPacket(
        Array.from({ length: LED_COUNT }, () => ({ r: 0, g: 0, b: 0 }))
      )
      await this.device.write(blackPacket)
      await this.device.close()
    } catch {
      // ignore shutdown errors
    } finally {
      this.device = null
    }
  }

  private buildPacket(colors: LedColor[]): number[] {
    const packet = new Array(PACKET_SIZE).fill(0)
    packet[0] = 0x02
    packet[1] = 0xaa

    for (let i = 0; i < LED_COUNT && i < colors.length; i++) {
      const offset = 2 + i * 3
      packet[offset] = colors[i].r
      packet[offset + 1] = colors[i].g
      packet[offset + 2] = colors[i].b
    }

    return packet
  }

  private startAnimation(): void {
    this.stopAnimation()
    this.animTimer = setInterval(() => void this.flush(), 33)
    void this.flush()
  }

  private stopAnimation(): void {
    if (this.animTimer) {
      clearInterval(this.animTimer)
      this.animTimer = null
    }
  }

  private async connect(): Promise<void> {
    try {
      const devices = HID.devices(VID, PID)
      const deviceInfo = devices.find((d) => d.interface === 2 && d.usage === 1)

      if (!deviceInfo?.path) {
        loggerService.warn('Stream Deck RGB non détecté', SERVICE)
        return
      }

      this.device = await HID.HIDAsync.open(deviceInfo.path)
      loggerService.info(`Stream Deck RGB initialisé : ${deviceInfo.path}`, SERVICE)
    } catch (err) {
      loggerService.warn(`Stream Deck RGB : erreur HID : ${err}`, SERVICE)
    }
  }
}

export const ledService = new LedService()
