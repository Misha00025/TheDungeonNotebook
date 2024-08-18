import React, { useEffect } from "react";
import { SideBar } from "../../components/SideBar";

import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../store/AuthContent";
import { usePlatform } from "../../store/PlatformContext";
import "../../HomeLayout.css";

export const HomeLayout = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const haveToken = token !== null && token !== undefined;

  useEffect(() => {
    if (!haveToken) {
      navigate("/login");
    }
  }, [token]);

  if (!haveToken) {
    navigate("/login");
    return <>token not found login redirect</>;
  }
  const theme = "HomeLayout";
  return (
    <>
      <main className="app-container">
        {/* <link ref='stylesheet' href='$HomeLayout.css' /> */}
        <SideBar />
        <Outlet />
      </main>
    </>
  );
};
