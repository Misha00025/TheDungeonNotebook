import React from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import styles from './FormGrid.module.css';

export type FormGridProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  minColumnWidth?: string;
};

export default function FormGrid({ children, minColumnWidth = '12rem', className, style, ...props }: FormGridProps) {
  const gridStyle = { ...style, '--form-column-min': minColumnWidth } as CSSProperties;
  return <div {...props} className={[styles.formGrid, className].filter(Boolean).join(' ')} style={gridStyle}>{children}</div>;
}
