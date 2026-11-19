import React from 'react';
import type { CSSProperties, ReactNode, TableHTMLAttributes } from 'react';
import styles from './DataTable.module.css';

export type DataTableProps = TableHTMLAttributes<HTMLTableElement> & {
  children?: ReactNode;
  minWidth?: string;
  wrapperClassName?: string;
};

export default function DataTable({
  children,
  minWidth = '40rem',
  wrapperClassName,
  className,
  style,
  ...props
}: DataTableProps) {
  const tableStyle = {
    '--table-min-width': minWidth,
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 'var(--table-min-width)',
    ...style,
  } as CSSProperties;

  return (
    <div className={[styles.wrapper, wrapperClassName].filter(Boolean).join(' ')}>
      <table {...props} className={[styles.table, className].filter(Boolean).join(' ')} style={tableStyle}>
        {children}
      </table>
    </div>
  );
}
