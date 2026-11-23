import React from 'react';
import buttonStyles from '../../../styles/components/Button.module.css';
import styles from './IconButton.module.css';

export type IconType = 'edit' | 'delete' | 'add' | 'view' | 'close' | 'check' | 'undo' | 'sort' | 'sort-up' | 'sort-down' | 'arrow-up' | 'arrow-down' | 'people' | 'copy' | 'more' | 'expand-all' | 'collapse-all';

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
  const inlineIcon = icon === 'check' || icon === 'close' || icon === 'undo' || icon === 'copy' || icon === 'more' || icon === 'expand-all' || icon === 'collapse-all';
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
        ? <svg className={styles.svgIcon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{icon === 'check' ? <path d="m5 12 4 4L19 6" /> : icon === 'close' ? <path d="m6 6 12 12M18 6 6 18" /> : icon === 'copy' ? <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></> : icon === 'more' ? <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></> : icon === 'expand-all' ? <><path d="m8 4 4 4 4-4M8 10l4 4 4-4M4 6v12M20 6v12" /><path d="M4 6h2M18 6h2M4 18h2M18 18h2" /></> : icon === 'collapse-all' ? <><path d="m8 8 4-4 4 4M8 14l4-4 4 4M4 6v12M20 6v12" /><path d="M4 6h2M18 6h2M4 18h2M18 18h2" /></> : <path d="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12h-2" />}</svg>
        : <span aria-hidden="true" className={`${styles.icon} ${styles[icon]}`}></span>}
    </button>
  );
};

export default IconButton;
