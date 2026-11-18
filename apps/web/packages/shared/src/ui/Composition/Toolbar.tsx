import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Composition.module.css';

export type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export default function Toolbar({ children, className, ...props }: ToolbarProps) {
  return <div {...props} className={[styles.toolbar, className].filter(Boolean).join(' ')}>{children}</div>;
}
