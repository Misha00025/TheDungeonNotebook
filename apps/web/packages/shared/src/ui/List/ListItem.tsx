import React from 'react';
import type { ReactNode } from 'react';
import styles from './ListItem.module.css';

export interface ListItemProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  clickable?: boolean;
  meta?: ReactNode;
  actions?: ReactNode;
}

const ListItem: React.FC<ListItemProps> = ({
  children,
  className = '',
  onClick,
  clickable = false,
  meta,
  actions
}) => {
  const clickableClass = clickable ? styles.clickable : '';
  const hasDetails = meta != null || actions != null;
  
  return (
    <div 
      className={`${styles.listItem} ${clickableClass} ${hasDetails ? styles.withDetails : ''} ${className}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {hasDetails ? <>
        <div className={styles.content}>{children}</div>
        {meta != null && <div className={styles.meta}>{meta}</div>}
        {actions != null && <div className={styles.actions}>{actions}</div>}
      </> : children}
    </div>
  );
};

export default ListItem;
