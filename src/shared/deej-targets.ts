/**
 * A DeeJ slider maps to audio session names. A `ha:<entity_id>` entry maps it
 * to a Home Assistant entity instead; audio services ignore those entries.
 */
export const HOME_ASSISTANT_TARGET_PREFIX = 'ha:'

/** Entity domains a slider can drive, with the value each one receives. */
export const HOME_ASSISTANT_SLIDER_DOMAINS = ['light', 'media_player', 'fan', 'cover'] as const

const ENTITY_ID = /^([a-z0-9_]+)\.[a-z0-9_]+$/

export function homeAssistantTarget(entityId: string): string {
  return `${HOME_ASSISTANT_TARGET_PREFIX}${entityId}`
}

export function isHomeAssistantTarget(target: string): boolean {
  return target.startsWith(HOME_ASSISTANT_TARGET_PREFIX)
}

/** `ha:light.desk` → `light.desk`, or undefined for audio sessions and unsupported entities. */
export function homeAssistantSliderEntity(target: string): string | undefined {
  if (!isHomeAssistantTarget(target)) {
    return undefined
  }
  const entityId = target.slice(HOME_ASSISTANT_TARGET_PREFIX.length)
  const domain = ENTITY_ID.exec(entityId)?.[1]
  return domain && (HOME_ASSISTANT_SLIDER_DOMAINS as readonly string[]).includes(domain)
    ? entityId
    : undefined
}

/** Slider targets as shown in the UI: `ha:light.desk` → `HA · light.desk`. */
export function deejTargetLabel(target: string): string {
  return isHomeAssistantTarget(target)
    ? `HA · ${target.slice(HOME_ASSISTANT_TARGET_PREFIX.length)}`
    : target
}

/** The slider mapping without its Home Assistant entries. */
export function audioSessionTargets(config: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(config).map(([slider, targets]) => [
      slider,
      targets.filter((target) => !isHomeAssistantTarget(target))
    ])
  )
}
