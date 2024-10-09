import React, { useEffect } from "react";
import { Groups } from "../../pages/Groups";
import { usePlatform } from "../../store/PlatformContext";
import { Outlet, useParams } from "react-router-dom";

export const GroupsLayout = () => {
  const platform = usePlatform();
  const { groupId } = useParams();

  if (platform.platform === "touch" && groupId) {
    return (
      <>
        <Outlet />
      </>
    );
  } else {
    return (
      <>
        <Groups />
        <Outlet />
      </>
    );
  }
};
