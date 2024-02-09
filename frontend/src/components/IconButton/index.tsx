import React from 'react'
import './index.css';

interface IconButtonProps {
    text?: string;
    icon: any;
    iconPosition?: 'left' | 'right' | 'center';
    onClick: () => void;
}

export const IconButton = ({
    text,
    icon,
    iconPosition = 'left',
    onClick
}: IconButtonProps) => {
  return (
    <button className={`iconButton icon__${iconPosition}`} onClick={onClick}>
        <img className='icon' src={icon}/>
        {text && <p> ${text}</p>}
    </button>
  )
}
