import React, { memo } from "react";

import "./index.css";
import { IconButton } from "../IconButton";

import githubIcon from "../../assets/carbon_logo-github.svg";
import exitIcon from "../../assets/carbon_exit.svg";
import settingIcon from "../../assets/carbon_settings.svg";
import homeIcon from "../../assets/carbon_home.svg";
import backIcon from "../../assets/carbon_arrow-left.svg";
import themeToggleIcon from "../../assets/theme-toggle.svg";

import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../store/AuthContent";
import { useTheme } from "../../store/ThemeContext";

const PROJECT_GITHUB_URL = "https://github.com/Misha00025/TheDungeonNotebook";

/**
 * Sidebar component with navigation and action buttons
 */
export const SideBar = memo(function SideBar() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { groupId, noteId } = useParams();
  const navigate = useNavigate();

  const exitAction = () => {
    logout();
    navigate("/login");
  };

  const handleBackAction = () => {
    const pathSegments = location.pathname
      .split("/")
      .filter((segment) => segment);

    let lastSegment;
    if (pathSegments.length > 0) {
      lastSegment = pathSegments.pop();
      if (lastSegment === "items" || "notes") {
        pathSegments.pop();
      }
    }

    const newPath = "/" + pathSegments.join("/");

    navigate(newPath);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-topItems">
        <IconButton
          icon={backIcon}
          tooltip="Назад"
          onClick={handleBackAction}
        />
        <Link to={"/groups"}>
          <IconButton
            icon={homeIcon}
            tooltip="Список групп"
            onClick={() => undefined}
          />
        </Link>
      </div>

      <div className="sidebar-bottomItems">
        <IconButton
          icon={themeToggleIcon}
          tooltip={theme === "dark" ? "Светлая тема" : "Темная тема"}
          onClick={toggleTheme}
        />
        <Link to={PROJECT_GITHUB_URL}>
          <IconButton
            icon={githubIcon}
            tooltip="Страница на github"
            onClick={() => undefined}
          />
        </Link>
        <IconButton
          icon={settingIcon}
          tooltip="Настройки"
          onClick={() => alert("Ха ха, ты думал тут что-то будет?")}
        />
        <IconButton
          icon={exitIcon}
          tooltip="Перейти на страницу авторизации"
          onClick={() => exitAction()}
        />
      </div>
    </div>
  );
});
