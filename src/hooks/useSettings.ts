import { useSelector } from "react-redux";

import {
  type DeeJConfig,
  type DeeJSliderConfig,
  type DeeJSliderKey,
  type Settings,
  type StreamdeckConfig,
  type StreamdeckInputConfig,
  type StreamdeckInputKey,
  type TapoConfig
} from "@/types/SettingsType";
import { type RootState } from "@/types/StateType";

const useSettings = () => {
  const settings: Settings = useSelector((state: RootState) => state.settings);

  const getConfig = (): Settings => {
    return settings;
  };

  const getStreamdeckConfig = (): StreamdeckConfig => {
    return settings.streamdeck;
  };

  const getStreamdeckInputConfig = (inputIndex: StreamdeckInputKey): StreamdeckInputConfig | null => {
    return settings.streamdeck[inputIndex] || null;
  };

  const getDeeJConfig = (): DeeJConfig => {
    return settings.deej;
  };

  const getDeeJSliderConfig = (sliderIndex: DeeJSliderKey): DeeJSliderConfig | null => {
    return settings.deej[sliderIndex] || null;
  };

  const getTapoConfig = (): TapoConfig => {
    return settings.tapo;
  };

  return {
    getConfig,
    getStreamdeckConfig,
    getStreamdeckInputConfig,
    getDeeJConfig,
    getDeeJSliderConfig,
    getTapoConfig
  };
};

export default useSettings;
