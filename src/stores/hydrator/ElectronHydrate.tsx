import { ipcRenderer } from "electron";
import { ReactNode, useEffect } from "react";
import { useDispatch } from "react-redux";

import {
  setLog,
  setLogs,
  setSerialPortList,
  setSliderVolume,
  setSlidersVolume,
  setVersions
} from "@/stores/slices/serialReducer";
import { hydrate } from "@/stores/slices/settingsReducer";
import { Log } from "@/types/SerialType";
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

  ipcRenderer.invoke("serial:list").then(serialPorts => dispatch(setSerialPortList(serialPorts)));
  ipcRenderer.invoke("electron:logs").then((logs: Log[]) => dispatch(setLogs(logs)));

  useEffect(() => {
    const serialLogHandler = (_: unknown, log: Log) => dispatch(setLog(log));
    const sliderHandler = (_: unknown, sliderKey: DeeJSliderKey, volume: number) =>
      dispatch(
        setSliderVolume({
          sliderKey,
          volume
        })
      );

    ipcRenderer.on("electron:log", serialLogHandler);
    ipcRenderer.on("deej:slider", sliderHandler);

    return () => {
      ipcRenderer.removeListener("electron:log", serialLogHandler);
      ipcRenderer.removeListener("deej:slider", sliderHandler);
    };
  }, []);

  return children;
};

export default ElectronHydrate;
