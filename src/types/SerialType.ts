import { DeeJSliderKey } from "@/types/SettingsType";

export type Serial = {
  sliders: { [sliderKey: DeeJSliderKey]: number };
};
