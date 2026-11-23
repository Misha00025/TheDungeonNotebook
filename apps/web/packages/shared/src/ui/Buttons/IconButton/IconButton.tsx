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

const iconGlyphs: Record<IconType, React.ReactNode> = {
  edit: <g strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></g>,
  delete: <g strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></g>,
  add: <g strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></g>,
  view: <g strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></g>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  undo: <path d="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12h-2" />,
  sort: <g strokeWidth="2"><path d="M3 6h18" /><path d="M7 12h10" /><path d="M3 18h18" /></g>,
  'sort-up': <g strokeWidth="2"><path d="M3 18h12" /><path d="M7 15l-4 4-4-4" /><path d="M7 3v18" /></g>,
  'sort-down': <g strokeWidth="2"><path d="M3 6h12" /><path d="M7 10l4 4 4-4" /><path d="M7 3v18" /></g>,
  'arrow-up': <g strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></g>,
  'arrow-down': <g strokeWidth="2"><polyline points="6 9 12 15 18 9" /></g>,
  people: <g strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></g>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  'expand-all': <><path d="m8 4 4 4 4-4M8 10l4 4 4-4M4 6v12M20 6v12" /><path d="M4 6h2M18 6h2M4 18h2M18 18h2" /></>,
  'collapse-all': <><path d="m8 8 4-4 4 4M8 14l4-4 4 4M4 6v12M20 6v12" /><path d="M4 6h2M18 6h2M4 18h2M18 18h2" /></>,
};

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
      <svg className={styles.svgIcon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{iconGlyphs[icon]}</svg>
    </button>
  );
};

export default IconButton;
