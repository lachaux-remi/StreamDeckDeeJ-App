import type { AppSettings, RendererSettings } from '@main/types/settings.types'

export function toRendererSettings(settings: AppSettings): RendererSettings {
  const { homeAssistant, discord, ...sharedSettings } = settings
  return {
    ...sharedSettings,
    homeAssistant: {
      url: homeAssistant.url,
      tokenConfigured: homeAssistant.token.length > 0
    },
    discord: {
      clientId: discord?.clientId ?? '',
      clientSecretConfigured: Boolean(discord?.clientSecret),
      authenticated: Boolean(discord?.accessToken)
    }
  }
}
