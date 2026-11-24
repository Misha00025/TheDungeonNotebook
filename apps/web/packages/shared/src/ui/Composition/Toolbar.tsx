import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Composition.module.css';

export type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  sticky?: boolean;
};

export default function Toolbar({ children, sticky = false, className, ...props }: ToolbarProps) {
  return <div {...props} className={[styles.toolbar, sticky && styles.sticky, className].filter(Boolean).join(' ')}>{children}</div>;
}
