import {
  isEntitySuggestions,
  isServiceNames,
  type HomeAssistantEntitySuggestion
} from '@renderer/types/home-assistant.types'

const CACHE_MS = 60_000

interface CacheEntry<T> {
  loadedAt: number
  value: Promise<T>
}

function cached<T>(load: () => Promise<unknown>, isValid: (value: unknown) => value is T[]) {
  let entry: CacheEntry<T[]> | undefined
  return (): Promise<T[]> => {
    if (!entry || Date.now() - entry.loadedAt > CACHE_MS) {
      const current: CacheEntry<T[]> = {
        loadedAt: Date.now(),
        value: load()
          .then((result) => (isValid(result) ? result : []))
          .catch(() => [] as T[])
          .then((result) => {
            // Retry on the next request when Home Assistant was unreachable.
            if (result.length === 0 && entry === current) {
              entry = undefined
            }
            return result
          })
      }
      entry = current
    }
    return entry.value
  }
}

/** Home Assistant entities for autocompletion, cached for a minute. */
export const loadHomeAssistantEntities = cached<HomeAssistantEntitySuggestion>(
  () => window.api.homeAssistant.getEntities(),
  isEntitySuggestions
)

/** Home Assistant `domain.service` names for autocompletion, cached for a minute. */
export const loadHomeAssistantServices = cached<string>(
  () => window.api.homeAssistant.getServices(),
  isServiceNames
)

/** `light.toggle` / `light.desk` → `light`. */
export function domainOf(identifier: string | undefined): string | undefined {
  const dot = identifier?.indexOf('.') ?? -1
  return dot > 0 ? identifier?.slice(0, dot) : undefined
}
