import React from "react";

import "./index.css";
import { GREEN_FILTER, RED_FILTER } from "./consts";
import Tooltip from "@mui/material/Tooltip/Tooltip";

type TButtonColor = "default" | "red" | "green";

interface IconButtonProps {
  text?: string;
  tooltip?: string;
  icon: any;
  iconPosition?: "left" | "right" | "center";
  onClick: () => void;
  className?: string; // Дополнительный CSS класс для кнопки и иконки.
  color?: TButtonColor;
}

const colorFilterMap = {
  default: "", // without any filter
  red: RED_FILTER,
  green: GREEN_FILTER,
};

export const IconButton = ({
  text,
  icon,
  iconPosition = "left",
  tooltip = "",
  onClick,
  className,
  color = "default",
}: IconButtonProps) => {
  const coloredStyle = {
    filter: colorFilterMap[color],
  };

  return (
    <Tooltip title={tooltip}>
      <button
        data-tooltip-id={tooltip + "/" + icon}
        data-tooltip-content={tooltip}
        className={`iconButton iconButton-icon__${iconPosition} ${className}`}
        onClick={onClick}
      >
        <img className="iconButton-icon" src={icon} style={coloredStyle} />
        {text && (
          <p className="iconButton-text" style={coloredStyle}>
            {text}
          </p>
        )}
      </button>
    </Tooltip>
  );
};
