import { DeeJSliderKey } from "@/types/SettingsType";

export type Serial = {
  sliders: { [key: DeeJSliderKey]: number };
  versions: ApplicationVersions;
  serialPortList: string[];
};

export type ApplicationVersions = {
  version: string;
  electron: string;
  node: string;
  platform: string;
  arch: string;
  chrome: string;
};
