import type { LedColor, LedCondition } from '@main/types/settings.types'
import type { micService } from './mic.service'
import type { discordService } from './discord.service'

type MicSvc = typeof micService
type DiscordSvc = typeof discordService

class ConditionService {
  private micSvc: MicSvc | null = null
  private discordSvc: DiscordSvc | null = null

  init(micSvc: MicSvc, discordSvc: DiscordSvc): void {
    this.micSvc = micSvc
    this.discordSvc = discordSvc
  }

  evaluate(condition: LedCondition): boolean {
    switch (condition.type) {
      case 'mic-mute':
        return this.micSvc?.isMuted() ?? false
      case 'discord-mute':
        return this.discordSvc?.isMuted() ?? false
      case 'discord-deafen':
        return this.discordSvc?.isDeafened() ?? false
      case 'discord-stream':
        return this.discordSvc?.isStreaming() ?? false
    }
  }

  resolveColor(conditions: LedCondition[]): LedColor | undefined {
    for (const cond of conditions) {
      if (this.evaluate(cond)) return cond.color
    }
    return undefined
  }
}

export const conditionService = new ConditionService()
