import React from 'react';
import styles from './ListItem.module.css';

interface ListItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  clickable?: boolean;
}

const ListItem: React.FC<ListItemProps> = ({
  children,
  className = '',
  onClick,
  clickable = false
}) => {
  const clickableClass = clickable ? styles.clickable : '';
  
  return (
    <div 
      className={`${styles.listItem} ${clickableClass} ${className}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {children}
    </div>
  );
};

export default ListItem;