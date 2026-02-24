import { KeyUsageEnum } from '@main/types/enums'

class HomeAssistantAPI {
  constructor(private readonly url: string) {}

  public async send(
    webhookId: string,
    state: KeyUsageEnum.Hold | KeyUsageEnum.Pressed,
    entityId: string
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.url}/api/webhook/${webhookId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ press_type: state, entity_id: entityId })
    })

    if (!response.ok) {
      throw new Error(`Home Assistant API error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    return text ? JSON.parse(text) : {}
  }
}

export default HomeAssistantAPI
