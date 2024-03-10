import { ArrowRight } from "@mui/icons-material";
import { ListItemIcon, ListItemText, MenuItem, MenuList, Paper } from "@mui/material";
import { ReactNode, useEffect, useRef, useState } from "react";

import ContextMenu from "@/components/context-menu/ContextMenu";
import { ContextMenuItem } from "@/hooks/useContextMenu";

type ContextSubMenuProps = {
  caption: ReactNode;
  icon?: ReactNode;
  inset?: boolean;
  items: ContextMenuItem[];
};

const ContextSubMenu = (props: ContextSubMenuProps) => {
  const { caption, icon, inset = false, items } = props;

  const refParent = useRef<HTMLLIElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const parent = refParent.current!;
    const rectParent = parent.getBoundingClientRect();

    const contextMenu = ref.current!;
    contextMenu.style.display = open ? "initial" : "none";
    const rect = contextMenu.getBoundingClientRect();

    const offsets = { x: rectParent.width, y: -8 };
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
          offsets.y = 0 - rect.height + 40;
        } else {
          offsets.y = 0 - rect.y;
        }
      }
    }

    contextMenu.style.left = `${offsets.x}px`;
    contextMenu.style.top = `${offsets.y}px`;
  }, [open]);

  return (
    <MenuItem
      className="context__menu-sub"
      ref={refParent}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {icon && <ListItemIcon>{icon}</ListItemIcon>}
      <ListItemText inset={inset}>{caption}</ListItemText>
      <ArrowRight />

      <Paper elevation={10} className="context__menu" ref={ref}>
        <MenuList dense>
          <ContextMenu items={items} />
        </MenuList>
      </Paper>
    </MenuItem>
  );
};

export default ContextSubMenu;
