import { createContext } from "react";

export type ContextMenuContextType = {
  registerMenu: (menuItem: HTMLDivElement) => void;
  registerMenuItems: (menuItem: HTMLDivElement) => void;
};

const ContextMenuContext = createContext<ContextMenuContextType>({
  registerMenu: () => {},
  registerMenuItems: () => {}
});

export default ContextMenuContext;
