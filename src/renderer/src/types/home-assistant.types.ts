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

export interface HomeAssistantAttributeSuggestion {
  name: string
  preview: string
}

const MAX_ATTRIBUTES = 200

/** Validates the attribute suggestions of one entity sent by the main process. */
export function isAttributeSuggestions(
  value: unknown
): value is HomeAssistantAttributeSuggestion[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_ATTRIBUTES &&
    value.every(
      (attribute) =>
        typeof attribute === 'object' &&
        attribute !== null &&
        isText(attribute.name) &&
        typeof attribute.preview === 'string' &&
        attribute.preview.length <= MAX_TEXT_LENGTH &&
        Object.keys(attribute).every((key) => key === 'name' || key === 'preview')
    )
  )
}
