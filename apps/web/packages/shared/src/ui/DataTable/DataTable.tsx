import React, { forwardRef } from 'react';
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import styles from './DataTable.module.css';

export type DataTableProps = TableHTMLAttributes<HTMLTableElement> & {
  children?: ReactNode;
  minWidth?: string;
  wrapperClassName?: string;
};

export type DataTableCellProps = TdHTMLAttributes<HTMLTableCellElement>
  & ThHTMLAttributes<HTMLTableCellElement>
  & {
    as?: 'td' | 'th';
    sizing?: 'content' | 'fill' | 'control' | 'editor';
    independent?: boolean;
    indent?: number;
    preserveWhitespace?: boolean;
  };

export type DataTableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  change?: 'modified' | 'added' | 'deleted';
  dragging?: boolean;
  dropPosition?: 'before' | 'after';
};

export type DataTableRowActionProps = ButtonHTMLAttributes<HTMLButtonElement>;
export type DataTableControlProps = HTMLAttributes<HTMLSpanElement>;

export type DataTableActionsProps = HTMLAttributes<HTMLDivElement> & {
  wrap?: boolean;
  fullWidth?: boolean;
};

export type DataTableNoteProps = HTMLAttributes<HTMLElement> & {
  tone?: 'muted' | 'error';
};

export type DataTableStackProps = HTMLAttributes<HTMLDivElement>;

export default function DataTable({
  children,
  minWidth = '0',
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
      <table
        {...props}
        className={[styles.table, className].filter(Boolean).join(' ')}
        style={tableStyle}
      >
        {children}
      </table>
    </div>
  );
}

export const DataTableCell = forwardRef<HTMLTableCellElement, DataTableCellProps>(
  function DataTableCell({
    as = 'td',
    sizing = 'fill',
    independent = false,
    indent = 0,
    preserveWhitespace = false,
    className,
    style,
    children,
    ...props
  }, ref) {
    const Component = as;
    const sizingClass = {
      content: styles.contentCell,
      fill: styles.fillCell,
      control: styles.controlCell,
      editor: styles.editorCell,
    }[sizing];

    return (
      <Component
        {...props}
        ref={ref}
        className={[
          styles.cell,
          sizingClass,
          indent > 0 && styles.indented,
          independent && styles.independent,
          preserveWhitespace && styles.preserveWhitespace,
          className,
        ].filter(Boolean).join(' ')}
        style={{
          '--cell-indent': `${Math.max(0, indent) * 1.125}rem`,
          ...style,
        } as CSSProperties}
      >
        {sizing === 'content' ? <div className={styles.content}>{children}</div> : children}
      </Component>
    );
  },
);

export const DataTableRow = forwardRef<HTMLTableRowElement, DataTableRowProps>(
  function DataTableRow({
    change,
    dragging = false,
    dropPosition,
    className,
    children,
    ...props
  }, ref) {
    return (
      <tr
        {...props}
        ref={ref}
        data-change={change}
        className={[
          styles.row,
          change && styles[change],
          dragging && styles.dragging,
          dropPosition && styles[`drop${dropPosition}`],
          className,
        ].filter(Boolean).join(' ')}
      >
        {children}
      </tr>
    );
  },
);

export const DataTableRowAction = forwardRef<HTMLButtonElement, DataTableRowActionProps>(
  function DataTableRowAction({ type = 'button', className, children, ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={[styles.rowAction, className].filter(Boolean).join(' ')}
      >
        {children}
      </button>
    );
  },
);

export const DataTableControl = forwardRef<HTMLSpanElement, DataTableControlProps>(
  function DataTableControl({ className, ...props }, ref) {
    return <span {...props} ref={ref} className={[styles.control, className].filter(Boolean).join(' ')} />;
  },
);

export const DataTableActions = forwardRef<HTMLDivElement, DataTableActionsProps>(
  function DataTableActions({ wrap = false, fullWidth = false, className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={[
          styles.actions,
          wrap && styles.wrap,
          fullWidth && styles.fullWidth,
          className,
        ].filter(Boolean).join(' ')}
      />
    );
  },
);

export const DataTableNote = forwardRef<HTMLElement, DataTableNoteProps>(
  function DataTableNote({ tone = 'muted', className, ...props }, ref) {
    return (
      <small
        {...props}
        ref={ref}
        className={[styles.note, tone === 'error' && styles.error, className].filter(Boolean).join(' ')}
      />
    );
  },
);

export const DataTableStack = forwardRef<HTMLDivElement, DataTableStackProps>(
  function DataTableStack({ className, ...props }, ref) {
    return <div {...props} ref={ref} className={[styles.stack, className].filter(Boolean).join(' ')} />;
  },
);
