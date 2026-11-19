import React from 'react';
import type { ButtonProps } from './Button';
import styles from './DragHandle.module.css';

export type DragHandleProps = Omit<ButtonProps, 'children' | 'aria-label' | 'type' | 'variant'> & { label: string };

const DragHandle: React.FC<DragHandleProps> = ({ label, title, disabled, busy, draggable, className, ...props }) => (
  <button
    {...props}
    type="button"
    className={[styles.handle, className].filter(Boolean).join(' ')}
    aria-label={label}
    title={title ?? label}
    aria-busy={busy || undefined}
    disabled={disabled || busy}
    draggable={disabled || busy ? false : draggable}
  >
    <svg aria-hidden="true" viewBox="0 0 12 18" className={styles.dots}>
      <circle cx="3" cy="3" r="1.25" /><circle cx="9" cy="3" r="1.25" />
      <circle cx="3" cy="9" r="1.25" /><circle cx="9" cy="9" r="1.25" />
      <circle cx="3" cy="15" r="1.25" /><circle cx="9" cy="15" r="1.25" />
    </svg>
  </button>
);

export default DragHandle;
