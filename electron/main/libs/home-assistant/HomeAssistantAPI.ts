import fetch from "electron-fetch";

import KeyUsageEnum from "../../types/KeyUsageEnum";

class HomeAssistantAPI {
  constructor(protected readonly url: string) {}

  public send = async (
    webhookId: string,
    state: KeyUsageEnum.Hold | KeyUsageEnum.Pressed,
    entityId: string
  ): Promise<void> => {
    await fetch(`${this.url}/api/webhook/${webhookId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ press_type: state, entity_id: entityId })
    });
  };
}

export default HomeAssistantAPI;
