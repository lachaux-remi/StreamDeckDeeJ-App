import { MenuList, Paper } from "@mui/material";
import { MouseEvent, useContext, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import ContextMenu from "@/components/context-menu/ContextMenu";
import ContextMenuContext from "@/contexts/ContextMenuContext";
import { ContextMenuItem } from "@/hooks/useContextMenu";
import useContextMenuDismissSignal from "@/hooks/useContextMenuDismissSignal";

import "./Context.scss";

type ContextMenuProps = {
  items: ContextMenuItem[];
  clientX: number;
  clientY: number;
  hide: () => void;
};

const ContextFrame = (props: ContextMenuProps) => {
  const { items, clientX, clientY, hide } = props;

  const { registerMenu } = useContext(ContextMenuContext);

  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    registerMenu(ref.current!);
  }, [registerMenu]);

  const offsetsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useContextMenuDismissSignal(ref, hide, true);

  useLayoutEffect(() => {
    const contextMenu = ref.current!;
    const rect = contextMenu.getBoundingClientRect();

    const offsets = offsetsRef.current;
    if (rect.width < window.innerWidth) {
      if (rect.right > window.innerWidth) {
        if (rect.x - rect.width > 0) {
          offsets.x = 0 - rect.width;
        } else {
          offsets.x = 0 - rect.x;
        }
      }
    }

    if (rect.height < window.innerHeight) {
      if (rect.bottom > window.innerHeight) {
        if (rect.y - rect.height > 0) {
          offsets.y = 0 - rect.height;
        } else {
          offsets.y = 0 - rect.y;
        }
      }
    }

    contextMenu.style.left = `${clientX + offsets.x}px`;
    contextMenu.style.top = `${clientY + offsets.y}px`;
  }, [clientX, clientY]);

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    hide();
  };

  const offsets = offsetsRef.current;

  const style = {
    left: clientX + offsets.x,
    top: clientY + offsets.y
  };

  return createPortal(
    <div className="context__frame" onClick={onClick}>
      <Paper elevation={10} className="context__menu" ref={ref} style={style}>
        <MenuList dense>
          <ContextMenu items={items} />
        </MenuList>
      </Paper>
    </div>,
    document.body
  );
};

export default ContextFrame;
