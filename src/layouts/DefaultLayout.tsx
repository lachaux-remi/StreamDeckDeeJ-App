import { Outlet } from "react-router-dom";

import Sidebar from "@/components/sidebar/Sidebar";
import Titlebar from "@/components/titlebar/Titlebar";

const DefaultLayout = () => {
  return (
    <>
      <Titlebar />
      <Sidebar />
      <Outlet />
    </>
  );
};

export default DefaultLayout;
