import { ipcMain } from "electron";
import { EventEmitter } from "node:events";
import { Logger } from "pino";

import { DeeJSliderKey, Settings } from "../types/SettingsType";
import { throttle } from "../utils/DebounceUtil";
import ConfigService from "./ConfigService";
import LoggerService from "./LoggerService";
import SerialService from "./SerialService";

class SliderService extends EventEmitter {
  private readonly logger: Logger;
  private readonly sliders: { [sliderKey: DeeJSliderKey]: number } = {};
  private readonly pow: number = Math.pow(10, 3);
  private invertSliders: boolean = false;

  constructor(
    loggerService: LoggerService,
    readonly configService: ConfigService,
    readonly serialService: SerialService
  ) {
    super();
    this.logger = loggerService.getLogger().child({ service: "SliderService" });
    this.logger.info("INIT");

    configService.onUpdated(this.setConfig);
    this.setConfig(configService.getConfig());

    ipcMain.handle("deej:sliders", () => this.sliders);

    serialService.on("serial:deej", throttle(this.deejEventHandler, 50, this));
  }

  public onUpdated = (listener: (sliderKey: DeeJSliderKey, value: number) => void): void => {
    this.on("slider:updated", listener);
  };

  public getSlider(sliderKey: DeeJSliderKey): number {
    return this.sliders[sliderKey] || 0;
  }

  private setConfig = (config: Partial<Settings>): void => {
    if (this.invertSliders !== config.invertSliders) {
      this.invertSliders = config.invertSliders || false;
    }
  };

  private deejEventHandler = (data: { value: { [sliderKey: DeeJSliderKey]: number } }) => {
    for (const [sliderKey, sliderValue] of Object.entries(data.value)) {
      let value = sliderValue / 2 ** 10;
      value = value > 1 ? 1 : value < 0 ? 0 : value;
      value = this.invertSliders ? 1 - value : value;
      value = Math.round(value * this.pow * (1 + Number.EPSILON)) / this.pow;

      const previousValue = this.sliders[sliderKey];
      if (!previousValue || Math.abs(previousValue - value) >= 0.009) {
        this.logger.info(`Sending ${value} to ${sliderKey}`);
        this.sliders[sliderKey] = value;

        this.emit("slider:updated", sliderKey, value);
      }
    }
  };
}

export default SliderService;
