import React from "react";
import { Tooltip } from "react-tooltip";

import "./index.css";

interface IconButtonProps {
  text?: string;
  tooltip?: string;
  icon: any;
  iconPosition?: "left" | "right" | "center";
  onClick: () => void;
  className?: string; // Дополнительный CSS класс для кнопки и иконки.
}

export const IconButton = ({
  text,
  icon,
  iconPosition = "left",
  tooltip = "",
  onClick,
  className,
}: IconButtonProps) => {
  const tooltipId = tooltip + "/" + icon;
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
      <img className="iconButton-icon" src={icon} />
      {text && <p className="iconButton-text">{text}</p>}
    </button>
  );
};
