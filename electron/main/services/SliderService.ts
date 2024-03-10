import { ipcMain } from "electron";
import { EventEmitter } from "node:events";

import { DeeJSliderKey, Settings } from "../types/SettingsType";
import { throttle } from "../utils/DebounceUtil";
import ConfigService from "./ConfigService";
import SerialService from "./SerialService";

class SliderService extends EventEmitter {
  private readonly sliders: Map<DeeJSliderKey, number> = new Map();
  private readonly pow: number = Math.pow(10, 3);
  private invertSliders: boolean = false;

  constructor(
    readonly configService: ConfigService,
    readonly serialService: SerialService
  ) {
    super();
    console.debug("SliderService   | INIT");

    configService.onUpdated(this.setConfig);
    this.setConfig(configService.getConfig());

    ipcMain.handle("deej:slider", (_, sliderKey: DeeJSliderKey) => this.getSlider(sliderKey));

    serialService.on("serial:deej", throttle(this.deejEventHandler, 50, this));
  }

  public onUpdated = (listener: (sliderKey: DeeJSliderKey, value: number) => void): void => {
    this.on("slider:updated", listener);
  };

  public getSlider(sliderKey: DeeJSliderKey): number {
    return this.sliders.get(sliderKey) || 0;
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

      const previousValue = this.sliders.get(sliderKey);
      if (!previousValue || Math.abs(previousValue - value) >= 0.009) {
        console.debug(`SliderService   | Sending ${value} to ${sliderKey}`);
        this.sliders.set(sliderKey, value);

        this.emit("slider:updated", sliderKey, value);
      }
    }
  };
}

export default SliderService;
