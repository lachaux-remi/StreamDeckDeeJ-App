import { MenuItem, Tooltip } from "@mui/material";
import { ForwardRefExoticComponent, MouseEvent, ReactElement } from "react";
import { Link, LinkProps, To, useLocation } from "react-router-dom";

type SidebarItemProps = {
  children: ReactElement;
  title: string;
  disabled?: boolean;
  onclick?: () => void;
  to?: To;
};

type SidebarItemCalculatedProps =
  | { onClick: (event: MouseEvent) => void }
  | { component: ForwardRefExoticComponent<LinkProps>; to: To }
  | object;

const SidebarItem = (props: SidebarItemProps) => {
  const { children, title, disabled = false, onclick, to } = props;

  const { pathname } = useLocation();

  let calculatedProps: SidebarItemCalculatedProps = {};
  if (onclick) {
    calculatedProps = {
      ...calculatedProps,
      onClick: event => {
        event.preventDefault();
        onclick();
      }
    };
  } else if (to) {
    if (typeof to === "string" && to === pathname) {
      calculatedProps = { ...calculatedProps, onClick: event => event.preventDefault() };
    }
    calculatedProps = { ...calculatedProps, component: Link, to };
  }

  return (
    <Tooltip title={title} placement={"right"} describeChild>
      <MenuItem {...calculatedProps} disabled={disabled} className="sidebar__list__item">
        {children}
      </MenuItem>
    </Tooltip>
  );
};

export default SidebarItem;
