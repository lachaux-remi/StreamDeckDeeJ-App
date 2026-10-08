export interface HomeAssistantEntitySuggestion {
  entityId: string
  name?: string
  state: string
}

const MAX_ENTITIES = 5_000
const MAX_SERVICES = 2_000
const MAX_TEXT_LENGTH = 255

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT_LENGTH
}

/** Validates the entity suggestions sent by the main process. */
export function isEntitySuggestions(value: unknown): value is HomeAssistantEntitySuggestion[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_ENTITIES &&
    value.every(
      (entity) =>
        typeof entity === 'object' &&
        entity !== null &&
        isText(entity.entityId) &&
        isText(entity.state) &&
        (entity.name === undefined || isText(entity.name)) &&
        Object.keys(entity).every((key) => ['entityId', 'name', 'state'].includes(key))
    )
  )
}

/** Validates the `domain.service` names sent by the main process. */
export function isServiceNames(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_SERVICES && value.every(isText)
}
