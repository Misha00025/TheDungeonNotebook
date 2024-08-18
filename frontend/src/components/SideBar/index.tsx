import React from "react";

import "./index.css";
import { IconButton } from "../IconButton";

import githubIcon from "../../assets/carbon_logo-github.svg";
import exitIcon from "../../assets/carbon_exit.svg";
import settingIcon from "../../assets/carbon_settings.svg";
import homeIcon from "../../assets/carbon_home.svg";
import backIcon from "../../assets/carbon_arrow-left.svg";

import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../store/AuthContent";

const PROJECT_GITHUB_URL = "https://github.com/Misha00025/TheDungeonNotebook";

export const SideBar = () => {
  const { logout } = useAuth();
  const { groupId, noteId } = useParams();
  const navigate = useNavigate();

  const exitAction = () => {
    logout();
    navigate("/login");
  };

  const handleBackAction = () => {
    if (noteId) {
      return navigate(`/groups/${groupId}`);
    } else if (groupId) {
      return navigate(`/groups`);
    } else {
      return navigate("/");
    }
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
};
