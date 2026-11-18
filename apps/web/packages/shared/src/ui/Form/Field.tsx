import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Field.module.css';

export type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
};

export default function Field({ label, htmlFor, hint, error, children, ...props }: FieldProps) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;

  return (
    <div {...props} className={[styles.field, props.className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={htmlFor}>{label}</label>
      {children}
      {hint != null && <div className={styles.hint} id={hintId}>{hint}</div>}
      {error != null && <div className={styles.error} id={errorId} role="alert">{error}</div>}
    </div>
  );
}
