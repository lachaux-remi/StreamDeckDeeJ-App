import type { LedColor, LedCondition, LedConditionOperator } from '@main/types/settings.types'

const NUMBER = /^\s*-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?\s*$/i

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  return typeof value === 'string' && NUMBER.test(value) ? Number(value) : undefined
}

function asText(value: unknown): string {
  return (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value))
    .trim()
    .toLowerCase()
}

/**
 * Compares a Home Assistant attribute with a reference: numerically when both
 * are complete numbers, otherwise as case-insensitive text. `contains` also
 * matches list attributes (e.g. supported_color_modes) element by element.
 */
export function compareHomeAssistantAttribute(
  attribute: unknown,
  operator: LedConditionOperator,
  reference: string
): boolean {
  if (attribute === undefined || attribute === null) {
    return false
  }
  const expected = reference.trim().toLowerCase()
  if (operator === 'contains') {
    return Array.isArray(attribute)
      ? attribute.some((item) => asText(item) === expected)
      : asText(attribute).includes(expected)
  }
  const actualNumber = asNumber(attribute)
  const expectedNumber = asNumber(reference)
  if (actualNumber !== undefined && expectedNumber !== undefined) {
    switch (operator) {
      case 'eq':
        return actualNumber === expectedNumber
      case 'neq':
        return actualNumber !== expectedNumber
      case 'gt':
        return actualNumber > expectedNumber
      case 'gte':
        return actualNumber >= expectedNumber
      case 'lt':
        return actualNumber < expectedNumber
      case 'lte':
        return actualNumber <= expectedNumber
    }
  }
  const actual = asText(attribute)
  switch (operator) {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    default:
      // Ordering only makes sense between numbers.
      return false
  }
}

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

  evaluate(
    condition: LedCondition,
    haState?: string,
    haAttributes?: Record<string, unknown>
  ): boolean {
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
      case 'ha-attr':
        return (
          condition.haAttribute !== undefined &&
          condition.haOperator !== undefined &&
          compareHomeAssistantAttribute(
            haAttributes?.[condition.haAttribute],
            condition.haOperator,
            condition.haValue ?? ''
          )
        )
    }
  }

  resolveColor(
    conditions: LedCondition[],
    haState?: string,
    haAttributes?: Record<string, unknown>
  ): LedColor | undefined {
    for (const cond of conditions) {
      if (this.evaluate(cond, haState, haAttributes)) {
        return cond.color
      }
    }
    return undefined
  }
}

export const conditionService = new ConditionService()
