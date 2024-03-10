import fetch from "electron-fetch";

export type DeviceInfo = {
  lights_on: boolean;
  torch_on: boolean;
};

class OctopiLedAPI {
  constructor(protected readonly ipAddress: string) {}

  public toggleLight = async (): Promise<DeviceInfo> => {
    return this.sendPayloadToDevice({
      command: "lights_toggle"
    });
  };

  public turnLightOn = (): Promise<DeviceInfo> => {
    return this.sendPayloadToDevice({
      command: "lights_on"
    });
  };

  public turnLightOff = (): Promise<DeviceInfo> => {
    return this.sendPayloadToDevice({
      command: "lights_off"
    });
  };

  public toggleTorche = (): Promise<DeviceInfo> => {
    return new Promise(resolve => {
      this.getDeviceInfo().then(info => {
        switch (info.torch_on) {
          case true:
            return resolve(this.turnTorcheOff());
          case false:
            return resolve(this.turnTorcheOn());
        }
      });
    });
  };

  public turnTorcheOn = (): Promise<DeviceInfo> => {
    return this.sendPayloadToDevice({
      command: "torch_on"
    });
  };

  public turnTorcheOff = (): Promise<DeviceInfo> => {
    return this.sendPayloadToDevice({
      command: "torch_off"
    });
  };

  public getDeviceInfo = (): Promise<DeviceInfo> => {
    return this.sendPayloadToDevice({
      command: "test_os_config"
    });
  };

  private sendPayloadToDevice = async (payload: object): Promise<DeviceInfo> => {
    const response = await fetch(`http://${this.ipAddress}/api/plugin/ws281x_led_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await response.json();
  };
}

export default OctopiLedAPI;
