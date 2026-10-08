/** An entity offered for autocompletion: no attributes ever reach the renderer. */
export interface HomeAssistantEntitySuggestion {
  entityId: string
  name?: string
  state: string
}

export const MAX_ENTITY_SUGGESTIONS = 5_000
export const MAX_SERVICE_SUGGESTIONS = 2_000
const MAX_TEXT_LENGTH = 255
const IDENTIFIER = /^[a-z0-9_]+\.[a-z0-9_]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT_LENGTH
    ? value
    : undefined
}

/** Keeps id, friendly name and state of well-formed entities, sorted by id. */
export function toEntitySuggestions(states: unknown): HomeAssistantEntitySuggestion[] {
  if (!Array.isArray(states)) {
    return []
  }
  const suggestions: HomeAssistantEntitySuggestion[] = []
  for (const entity of states) {
    if (!isRecord(entity)) {
      continue
    }
    const entityId = boundedText(entity.entity_id)
    if (!entityId || !IDENTIFIER.test(entityId)) {
      continue
    }
    const name = isRecord(entity.attributes)
      ? boundedText(entity.attributes.friendly_name)
      : undefined
    suggestions.push({
      entityId,
      ...(name ? { name } : {}),
      state: boundedText(entity.state) ?? 'unknown'
    })
  }
  return suggestions
    .sort((a, b) => a.entityId.localeCompare(b.entityId))
    .slice(0, MAX_ENTITY_SUGGESTIONS)
}

/** Flattens `[{ domain, services: { name: … } }]` into sorted `domain.service` names. */
export function toServiceNames(domains: unknown): string[] {
  if (!Array.isArray(domains)) {
    return []
  }
  const names = new Set<string>()
  for (const entry of domains) {
    if (!isRecord(entry) || typeof entry.domain !== 'string' || !isRecord(entry.services)) {
      continue
    }
    for (const service of Object.keys(entry.services)) {
      const name = `${entry.domain}.${service}`
      if (name.length <= MAX_TEXT_LENGTH && IDENTIFIER.test(name)) {
        names.add(name)
      }
    }
  }
  return [...names].sort().slice(0, MAX_SERVICE_SUGGESTIONS)
}
