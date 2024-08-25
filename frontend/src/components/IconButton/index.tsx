import React from "react";
import { Tooltip } from "react-tooltip";

import "./index.css";
import { GREEN_FILTER, RED_FILTER } from "./consts";

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
  const tooltipId = tooltip + "/" + icon;

  const coloredStyle = {
    filter: colorFilterMap[color],
  };

  return (
    <button
      data-tooltip-id={tooltip + "/" + icon}
      data-tooltip-content={tooltip}
      className={`iconButton iconButton-icon__${iconPosition} ${className}`}
      onClick={onClick}
    >
      {tooltip ? (
        <Tooltip
          id={tooltipId}
          style={{ zIndex: 100 }}
          openEvents={{
            mouseenter: true,
            mousedown: true,
            click: true,
          }}
        />
      ) : undefined}
      <img className="iconButton-icon" src={icon} style={coloredStyle} />
      {text && (
        <p className="iconButton-text" style={coloredStyle}>
          {text}
        </p>
      )}
    </button>
  );
};
