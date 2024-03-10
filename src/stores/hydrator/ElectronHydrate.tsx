import { ipcRenderer } from "electron";
import { ReactNode } from "react";
import { useDispatch } from "react-redux";

import { setSerialPortList, setSliderVolume, setSlidersVolume, setVersions } from "@/stores/slices/serialReducer";
import { hydrate } from "@/stores/slices/settingsReducer";
import { DeeJSliderKey } from "@/types/SettingsType";

type ElectronHydrateType = {
  children: ReactNode;
};

const ElectronHydrate = (props: ElectronHydrateType) => {
  const { children } = props;
  const dispatch = useDispatch();

  ipcRenderer.invoke("setting:hydrate").then(config => dispatch(hydrate(config)));
  ipcRenderer.invoke("electron:versions").then(versions => dispatch(setVersions(versions)));
  ipcRenderer.invoke("deej:sliders").then(sliders => dispatch(setSlidersVolume(sliders)));
  ipcRenderer.on("deej:slider", (_, sliderKey: DeeJSliderKey, volume: number) => {
    dispatch(setSliderVolume({ sliderKey, volume }));
  });
  ipcRenderer.invoke("serial:list").then(serialPorts => dispatch(setSerialPortList(serialPorts)));

  return children;
};

export default ElectronHydrate;
