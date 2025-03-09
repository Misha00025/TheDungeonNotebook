import React, { useEffect } from "react";
import { Groups } from "../../pages/Groups";
import { usePlatform } from "../../store/PlatformContext";
import { Outlet, useParams } from "react-router-dom";

export const GroupsLayout = () => {
  const platform = usePlatform();
  const { groupId } = useParams();

  if (platform.platform === "touch" && groupId) {
    return (
      <div style={{ display: "flex", flex: 1, width: "100%", height: "100%" }}>
        <Outlet />
      </div>
    );
  } else {
    return (
      <div style={{ display: "flex", flex: 1, width: "100%", height: "100%" }}>
        <Groups />
        <Outlet />
      </div>
    );
  }
};
