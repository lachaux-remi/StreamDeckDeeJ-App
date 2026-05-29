class HomeAssistantAPI {
  constructor(
    private readonly url: string,
    private readonly token: string
  ) {}

  public async getState(entityId: string): Promise<{ state: string; attributes: Record<string, unknown> }> {
    const response = await fetch(`${this.url}/api/states/${encodeURIComponent(entityId)}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    })
    if (!response.ok) {
      throw new Error(`Home Assistant state error: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<{ state: string; attributes: Record<string, unknown> }>
  }

  public async callService(
    service: string,
    entityId: string,
    extraData?: Record<string, unknown>
  ): Promise<Record<string, unknown>[]> {
    const dotIndex = service.indexOf('.')
    if (dotIndex === -1) {
      throw new Error(`Invalid HA service format: "${service}". Expected "domain.service"`)
    }
    const domain = service.slice(0, dotIndex)
    const serviceName = service.slice(dotIndex + 1)

    const response = await fetch(`${this.url}/api/services/${domain}/${serviceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify({ entity_id: entityId, ...extraData })
    })

    if (!response.ok) {
      throw new Error(`Home Assistant API error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    return text ? (JSON.parse(text) as Record<string, unknown>[]) : []
  }
}

export default HomeAssistantAPI
