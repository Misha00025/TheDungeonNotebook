import React from 'react';
import { Tooltip } from 'react-tooltip';

// import './index.css';

interface IconButtonProps {
    text?: string;
    tooltip?: string;
    icon: any;
    iconPosition?: 'left' | 'right' | 'center';
    onClick: () => void;
}

export const IconButton = ({
    text,
    icon,
    iconPosition = 'left',
    tooltip = '123',
    onClick
}: IconButtonProps) => {

  const tooltipId = tooltip + '/' + icon;
  return (
    <button data-tooltip-id={tooltip + '/' + icon} data-tooltip-content={tooltip} className={`iconButton icon__${iconPosition}`} onClick={onClick}>
        {tooltip ? <Tooltip id={tooltipId}/> : undefined}
        <img className='icon' src={icon}/>
        {text && <p>${text}</p>}
    </button>
  )
}
