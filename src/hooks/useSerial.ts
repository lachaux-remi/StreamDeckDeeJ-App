import { useSelector } from "react-redux";

import { Serial } from "@/types/SerialType";
import { DeeJSliderKey } from "@/types/SettingsType";
import { type RootState } from "@/types/StateType";

const userSerial = () => {
  const serial: Serial = useSelector((state: RootState) => state.serial);

  const getSliderVolume = (sliderKey: DeeJSliderKey): number => {
    return Math.round((serial.sliders[sliderKey] || 0) * 100);
  };

  const getSerialsList = () => {
    return serial.serialPortList;
  };

  const getVersions = () => {
    return serial.versions;
  };

  return {
    getSliderVolume,
    getSerialsList,
    getVersions
  };
};

export default userSerial;
