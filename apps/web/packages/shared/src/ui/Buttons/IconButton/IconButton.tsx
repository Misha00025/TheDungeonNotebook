import React from 'react';
import buttonStyles from '../../../styles/components/Button.module.css';
import styles from './IconButton.module.css';

export type IconType = 'edit' | 'delete' | 'add' | 'view' | 'close' | 'check' | 'sort' | 'sort-up' | 'sort-down' | 'arrow-up' | 'arrow-down' | 'people';

export interface IconButtonProps {
  icon: IconType;
  onClick: () => void;
  title: string;
  ariaLabel?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  className?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  title,
  ariaLabel,
  size = 'small',
  variant = 'primary',
  disabled = false,
  busy = false,
  className
}) => {
  const inlineIcon = icon === 'check' || icon === 'close';
  return (
    <button
      type='button'
      className={`${buttonStyles.button} ${styles.iconButton} ${styles[size]} ${styles[variant]}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
    >
      {inlineIcon
        ? <svg className={styles.svgIcon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{icon === 'check' ? <path d="m5 12 4 4L19 6" /> : <path d="m6 6 12 12M18 6 6 18" />}</svg>
        : <span aria-hidden="true" className={`${styles.icon} ${styles[icon]}`}></span>}
    </button>
  );
};

export default IconButton;
