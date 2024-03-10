import { ipcMain } from "electron";
import { EventEmitter } from "node:events";

import OctopiLedAPI from "../libs/octoprint-led-api/OctopiLedAPI";
import TapoAPI from "../libs/tapo-api/TapoAPI";
import KeyUsageEnum from "../types/KeyUsageEnum";
import ModuleEnum from "../types/ModuleEnum";
import { StreamdeckInputConfig, StreamdeckInputKey, StreamdeckKey } from "../types/SettingsType";
import ConfigService from "./ConfigService";
import SerialService from "./SerialService";

class DeckService extends EventEmitter {
  private keyState: { [key: StreamdeckInputKey]: KeyUsageEnum.Hold | KeyUsageEnum.Pressed } = {};

  constructor(
    readonly configService: ConfigService,
    readonly serialService: SerialService
  ) {
    super();
    console.debug("DeckService     | INIT");

    ipcMain.handle("streamdeck:keys", (_, deckKey: StreamdeckInputKey) => this.getKeyInfo(deckKey));

    serialService.on("serial:deck", this.deckEventHandler);
  }

  public onUpdated = (listener: (deckKey: StreamdeckInputKey, value: object) => void): void => {
    this.on("deck:updated", listener);
  };

  private async getKeyInfo(deckKey: StreamdeckInputKey) {
    const info: { [key: string]: object } = {};

    const deckConfig: StreamdeckInputConfig | undefined = this.configService.getConfig().streamdeck?.[deckKey];
    if (!deckConfig) {
      return;
    }

    const keyPressedConfig = deckConfig[KeyUsageEnum.Pressed];
    if (keyPressedConfig) {
      info[KeyUsageEnum.Pressed.toString()] = await this.getModuleInfo(keyPressedConfig);
    }

    const keyHoldConfig = deckConfig[KeyUsageEnum.Hold];
    if (keyHoldConfig) {
      info[KeyUsageEnum.Hold.toString()] = await this.getModuleInfo(keyHoldConfig);
    }

    return info;
  }

  private async getModuleInfo(keyPressedConfig: StreamdeckKey) {
    if (keyPressedConfig.module === ModuleEnum.Tapo) {
      const tapoAccount = this.configService.getConfig().tapo;
      if (!tapoAccount) {
        return;
      }

      const api = new TapoAPI(keyPressedConfig.params[0], tapoAccount.username, tapoAccount.password);
      return await api.getInfo();
    } else if (keyPressedConfig.module === ModuleEnum.OctopiLed) {
      const api = new OctopiLedAPI(keyPressedConfig.params[0]);
      return await api.getDeviceInfo();
    }
  }

  private deckEventHandler = (data: { state: KeyUsageEnum; value: string }) => {
    const deckKey: StreamdeckInputKey = parseInt(data.value, 16).toString().toLowerCase();

    if (data.state === KeyUsageEnum.Released) {
      const deckConfig: StreamdeckInputConfig | undefined = this.configService.getConfig().streamdeck?.[deckKey];
      if (!deckConfig) {
        return;
      }

      const stateConfig: StreamdeckKey | undefined = deckConfig[this.keyState[deckKey]];
      if (!stateConfig) {
        return;
      }

      console.debug(
        `DeckService     | Key ${deckKey} ${this.keyState[deckKey]} run action ${stateConfig.module}: ${stateConfig.params.join(", ")}`
      );

      if (stateConfig.module === ModuleEnum.Macro || stateConfig.module === ModuleEnum.Ir) {
        this.serialService.send(`${stateConfig.module}:${stateConfig.params[0]}`);
      } else if (stateConfig.module === ModuleEnum.Tapo) {
        const tapoAccount = this.configService.getConfig().tapo;
        if (!tapoAccount) {
          return;
        }

        const api = new TapoAPI(stateConfig.params[0], tapoAccount.username, tapoAccount.password);

        api[stateConfig.params[1] as keyof TapoAPI]()
          .then(info => this.emit("deck:updated", deckKey, info))
          .catch(err => console.debug("DeckService     | Error while calling Tapo API", err));
      } else if (stateConfig.module === ModuleEnum.OctopiLed) {
        const api = new OctopiLedAPI(stateConfig.params[0]);

        api[stateConfig.params[1] as keyof OctopiLedAPI]()
          .then(info => this.emit("deck:updated", deckKey, info))
          .catch(err => console.debug("DeckService     | Error while calling OctoPi LED API", err));
      }
    } else {
      this.keyState[deckKey] = data.state;
    }
  };
}

export default DeckService;
