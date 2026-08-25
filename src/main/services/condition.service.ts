import type { LedColor, LedCondition } from '@main/types/settings.types'

interface MicState {
  isMuted(): boolean
}

interface DiscordState {
  isMuted(): boolean
  isDeafened(): boolean
  isStreaming(): boolean
}

class ConditionService {
  private micSvc: MicState | null = null
  private discordSvc: DiscordState | null = null

  init(micSvc: MicState, discordSvc: DiscordState): void {
    this.micSvc = micSvc
    this.discordSvc = discordSvc
  }

  evaluate(condition: LedCondition, haState?: string): boolean {
    switch (condition.type) {
      case 'mic-mute':
        return this.micSvc?.isMuted() ?? false
      case 'discord-mute':
        return this.discordSvc?.isMuted() ?? false
      case 'discord-deafen':
        return this.discordSvc?.isDeafened() ?? false
      case 'discord-stream':
        return this.discordSvc?.isStreaming() ?? false
      case 'ha-on':
        return haState === 'on'
      case 'ha-off':
        return haState === 'off'
    }
  }

  resolveColor(conditions: LedCondition[], haState?: string): LedColor | undefined {
    for (const cond of conditions) {
      if (this.evaluate(cond, haState)) {
        return cond.color
      }
    }
    return undefined
  }
}

export const conditionService = new ConditionService()
