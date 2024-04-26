import * as process from "process";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import Sidebar from "@/components/sidebar/Sidebar";
import Titlebar from "@/components/titlebar/Titlebar";

import "./DefaultLayout.scss";

const DefaultLayout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (process.argv.includes("notification")) {
      navigate("/notification");
    }
  }, []);

  return (
    <div className="layout-default">
      <Titlebar />
      <Sidebar />
      <Outlet />
    </div>
  );
};

export default DefaultLayout;
