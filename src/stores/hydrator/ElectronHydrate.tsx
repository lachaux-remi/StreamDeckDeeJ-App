import { ipcRenderer } from "electron";
import { ReactNode } from "react";
import { useDispatch } from "react-redux";

import { hydrate } from "@/stores/slices/settingsReducer";

type ElectronHydrateType = {
  children: ReactNode;
};

const ElectronHydrate = (props: ElectronHydrateType) => {
  const { children } = props;
  const dispatch = useDispatch();

  ipcRenderer.invoke("setting:hydrate").then(config => dispatch(hydrate(config)));

  return children;
};

export default ElectronHydrate;
