import { ArrowBackRounded, SettingsRounded, TuneRounded, ViewCompactRounded } from "@mui/icons-material";
import { MenuList, Paper } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import SidebarItem from "@/components/sidebar/components/SidebarItem";

import "./Sidebar.scss";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Paper className="sidebar" square>
      <MenuList className="sidebar__list">
        <SidebarItem onclick={() => navigate(-1)} title={"Retour"} disabled={location.key === "default"}>
          <ArrowBackRounded />
        </SidebarItem>
        <SidebarItem to="/" title={"StreamDeck"}>
          <ViewCompactRounded />
        </SidebarItem>
        <SidebarItem to="/deej" title={"DeeJ"}>
          <TuneRounded sx={{ transform: "rotate(-90deg)" }} />
        </SidebarItem>
      </MenuList>
      <MenuList className="sidebar__list">
        <SidebarItem to="/settings" title={"Paramètres"}>
          <SettingsRounded />
        </SidebarItem>
      </MenuList>
    </Paper>
  );
};

export default Sidebar;
