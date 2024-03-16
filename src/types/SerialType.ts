import { DeeJSliderKey } from "@/types/SettingsType";

export type Serial = {
  sliders: { [key: DeeJSliderKey]: number };
  versions: ApplicationVersions;
  serialPortList: string[];
  logs: Log[];
};

export type ApplicationVersions = {
  version: string;
  electron: string;
  node: string;
  platform: string;
  arch: string;
  chrome: string;
};

export type Log = { service: string; level: string; args: any[] };
