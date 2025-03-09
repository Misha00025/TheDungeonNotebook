import React, { ReactNode } from "react";

import "./index.css";
import { GREEN_FILTER, RED_FILTER } from "./consts";
import Tooltip from "@mui/material/Tooltip/Tooltip";

type TButtonColor = "default" | "red" | "green";

export interface IconButtonProps {
  text?: string;
  tooltip?: string;
  icon: any;
  iconPosition?: "left" | "right" | "center";
  onClick: () => void;
  className?: string; // Additional CSS class for button and icon
  color?: TButtonColor;
  disabled?: boolean; // Whether the button is disabled
  children?: ReactNode; // Optional children to render inside the button
}

const colorFilterMap = {
  default: "", // without any filter
  red: RED_FILTER,
  green: GREEN_FILTER,
};

/**
 * A reusable button component with an icon
 */
export const IconButton: React.FC<IconButtonProps> = ({
  text,
  icon,
  iconPosition = "left",
  tooltip = "",
  onClick,
  className = "",
  color = "default",
  disabled = false,
  children,
}: IconButtonProps) => {
  const coloredStyle = {
    filter: colorFilterMap[color],
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!disabled) {
      onClick();
    }
    e.stopPropagation();
  };

  return (
    <Tooltip title={disabled ? "" : tooltip}>
      <button
        data-tooltip-id={tooltip + "/" + icon}
        data-tooltip-content={tooltip}
        className={`iconButton iconButton-icon__${iconPosition} ${className} ${disabled ? "iconButton-disabled" : ""}`}
        onClick={handleClick}
        disabled={disabled}
        type="button"
      >
        <img
          className="iconButton-icon"
          src={icon}
          style={coloredStyle}
          alt={tooltip || "icon"}
        />
        {text && (
          <p className="iconButton-text" style={coloredStyle}>
            {text}
          </p>
        )}
        {children}
      </button>
    </Tooltip>
  );
};
