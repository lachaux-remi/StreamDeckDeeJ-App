import KeyUsageEnum from "./KeyUsageEnum";
import ModuleEnum from "./ModuleEnum";

export type Settings = {
  comPort: string;
  baudRate: number;
  streamdeck: StreamdeckConfig;
  deej: DeeJConfig;
  invertSliders: boolean;
  runOnStartup: boolean;
  runInBackground: boolean;
  closeToTray: boolean;
  devTools: boolean;
  tapo: TapoConfig;
  homeAssistant: HomeAssistantConfig;
};

export type StreamdeckConfig = {
  [key: StreamdeckInputKey]: StreamdeckInputConfig;
};

export type StreamdeckInputKey = string;

export type StreamdeckInputConfig = {
  icon?: string;
  [KeyUsageEnum.Pressed]?: StreamdeckKey;
  [KeyUsageEnum.Hold]?: StreamdeckKey;
};

export type StreamdeckKey = {
  icon?: string;
  module: ModuleEnum;
  params: string[];
};

export type DeeJConfig = {
  [key: DeeJSliderKey]: DeeJSliderConfig;
};

export type DeeJSliderKey = string;

export type DeeJSliderConfig = string[];

/** @deprecated */
export type TapoConfig = {
  username: string;
  password: string;
};

export type HomeAssistantConfig = {
  url: string;
};
