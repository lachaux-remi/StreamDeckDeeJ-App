import { ipcRenderer } from "electron";
import { Middleware } from "redux";

import { RootState } from "@/types/StateType";

const electronConfigMiddleware: Middleware = store => next => action => {
  const result = next(action);

  const actionType = (action as { type: string }).type;
  if (actionType.startsWith("settings/") && actionType !== "settings/hydrate") {
    const state: RootState = store.getState();
    ipcRenderer.send("settings:update", state.settings);
  }

  return result;
};

export default electronConfigMiddleware;
