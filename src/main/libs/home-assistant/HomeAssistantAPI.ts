class HomeAssistantAPI {
  constructor(
    private readonly url: string,
    private readonly token: string
  ) {}

  public async getState(
    entityId: string,
    signal?: AbortSignal
  ): Promise<{ state: string; attributes: Record<string, unknown> }> {
    const response = await fetch(`${this.url}/api/states/${encodeURIComponent(entityId)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal
    })
    if (!response.ok) {
      throw new Error(`Home Assistant state error: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<{ state: string; attributes: Record<string, unknown> }>
  }

  /** All entity states (GET /api/states), as returned by Home Assistant. */
  public async getStates(signal?: AbortSignal): Promise<unknown> {
    return this.getJson('/api/states', 'states', signal)
  }

  /** All services by domain (GET /api/services), as returned by Home Assistant. */
  public async getServices(signal?: AbortSignal): Promise<unknown> {
    return this.getJson('/api/services', 'services', signal)
  }

  private async getJson(path: string, label: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(`${this.url}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal
    })
    if (!response.ok) {
      throw new Error(`Home Assistant ${label} error: ${response.status} ${response.statusText}`)
    }
    return response.json()
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
      body: JSON.stringify({ ...extraData, entity_id: entityId })
    })

    if (!response.ok) {
      throw new Error(`Home Assistant API error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    return text ? (JSON.parse(text) as Record<string, unknown>[]) : []
  }
}

export default HomeAssistantAPI
