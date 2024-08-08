import React, { ReactNode } from 'react'

import './index.css';
import { Link } from 'react-router-dom';
import { IconButton } from '../../components/IconButton';
import del_icon from '../../assets/delete-1487-svgrepo-com.svg'

interface ListItemProps {
    children: ReactNode;
    onClick?: () => void;
    isActive?: boolean;
    linkPath?: string;
    deletable?: boolean;
}

export const ListItem = ({
    children,
    isActive = false,
    linkPath,
    onClick
}: ListItemProps) => {
    return (
        <li onClick={onClick} className={`listItem ${isActive ? 'listItem__active' : ''}`}>
            {
                linkPath ?
                    <Link className='listItem-link' to={linkPath}>{children}</Link> :
                    children
            }
        </li>
    )
}
