import {
  ReactNode,
  MouseEvent as SyntheticMouseEvent,
  UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import ContextFrame from "@/components/context-menu/ContextFrame";
import ContextMenuContext, { ContextMenuContextType } from "@/contexts/ContextMenuContext";

export type ContextMenuItem = {
  caption: ReactNode;
  icon?: ReactNode;
  inset?: boolean;
  onClick?: () => void;
  items?: ContextMenuItem[];
};

type ContextMenuHook = {
  contextMenu: ReactNode;
  hideMenu: () => void;
  handleContextMenu: (event: UIEvent) => void;
};

type StateObject = {
  clientX: number;
  clientY: number;
  event: UIEvent;
  targetRect: DOMRect;
};

export const useContextMenu = (contextMenuItems: ContextMenuItem[]): ContextMenuHook => {
  const [state, setState] = useState<StateObject | null>(null);

  const menuRef = useRef<HTMLDivElement>();
  const menuItemsRef = useRef<HTMLDivElement[]>([]);

  const registerMenu = useCallback((menu: HTMLDivElement) => {
    menuRef.current = menu;
  }, []);

  const registerMenuItems = useCallback((menuItem: HTMLDivElement) => {
    const menuItems = menuItemsRef.current;
    menuItems.push(menuItem);
  }, []);

  useEffect(() => {
    if (state === null) {
      return;
    }

    const target = state.event.target as HTMLElement;

    const menu = menuRef.current as HTMLDivElement;
    const menuItems = menuItemsRef.current;

    const enableMenuItems = menuItems.reduce((reduced: number[], menuItem, index) => {
      if (menuItem.getAttribute("data-disabled") === "true") {
        reduced.push(index);
      }
      return reduced;
    }, []);

    const isMouseEvent = state.event.type === "contextmenu" || state.event.type === "click";

    const focusedIndex = isMouseEvent ? -1 : 0;
    if (focusedIndex >= 0) {
      menuItems[0].focus();
    } else {
      target.blur();
      menu.focus();
    }

    return () => {
      menuItems.slice(0, enableMenuItems.length);

      target.focus();
    };
  }, [state]);

  const context = useMemo<ContextMenuContextType>(
    () => ({
      contextMenuEvent: state?.event ?? null,
      registerMenu,
      registerMenuItems
    }),
    [registerMenu, registerMenuItems, state?.event]
  );

  const showMenu = (event: UIEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    const { currentTarget } = event;
    const targetRect = (currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = isMouseEvent(event) ? event.clientX : targetRect.left;
    const clientY = isMouseEvent(event) ? event.clientY : targetRect.top;

    setState({
      clientX,
      clientY,
      event,
      targetRect
    });
  };

  const hideMenu = useCallback(() => {
    if (state === null) {
      return;
    }

    setState(null);
  }, [state]);

  let contextMenu = null;
  if (state !== null) {
    contextMenu = (
      <ContextMenuContext.Provider value={context}>
        <ContextFrame clientX={state.clientX} clientY={state.clientY} hide={hideMenu} items={contextMenuItems} />
      </ContextMenuContext.Provider>
    );
  }

  return {
    contextMenu,
    hideMenu,
    handleContextMenu: showMenu
  };
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const isMouseEvent = (event: any): event is SyntheticMouseEvent => {
  return event.type === "contextmenu" || event.type === "click";
};
