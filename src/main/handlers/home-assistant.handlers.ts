import type { WebContents } from 'electron'
import HomeAssistantAPI from '@main/libs/home-assistant/HomeAssistantAPI'
import { configService } from '@main/services/config.service'
import {
  isHomeAssistantEntityId,
  toAttributeSuggestions,
  toEntitySuggestions,
  toServiceNames
} from '@main/services/home-assistant-catalog'
import { loggerService } from '@main/services/logger.service'
import { handleIpc } from './trusted-ipc'

const SERVICE = 'HomeAssistantHandlers'
const REQUEST_TIMEOUT_MS = 5_000

async function fromHomeAssistant<T>(
  label: string,
  load: (api: HomeAssistantAPI, signal: AbortSignal) => Promise<T>
): Promise<T | []> {
  const { url, token } = configService.getConfig().homeAssistant
  if (!url || !token) {
    return []
  }
  try {
    return await load(new HomeAssistantAPI(url, token), AbortSignal.timeout(REQUEST_TIMEOUT_MS))
  } catch (error) {
    loggerService.warn(`Cannot list Home Assistant ${label}: ${String(error)}`, SERVICE)
    return []
  }
}

/** Autocompletion data for the button dialog; the token stays in the main process. */
export function registerHomeAssistantHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'ha:entities', () =>
    fromHomeAssistant('entities', async (api, signal) =>
      toEntitySuggestions(await api.getStates(signal))
    )
  )
  handleIpc(trustedSender, 'ha:attributes', (entityId: unknown) => {
    if (!isHomeAssistantEntityId(entityId)) {
      return []
    }
    return fromHomeAssistant('attributes', async (api, signal) =>
      toAttributeSuggestions(await api.getState(entityId, signal))
    )
  })
  handleIpc(trustedSender, 'ha:services', () =>
    fromHomeAssistant('services', async (api, signal) =>
      toServiceNames(await api.getServices(signal))
    )
  )
}
