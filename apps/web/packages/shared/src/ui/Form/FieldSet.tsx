import React from 'react';
import type { FieldsetHTMLAttributes, ReactNode } from 'react';
import styles from './FieldSet.module.css';

export type FieldSetProps = FieldsetHTMLAttributes<HTMLFieldSetElement> & {
  legend?: ReactNode;
  children?: ReactNode;
};

export default function FieldSet({ legend, children, className, ...props }: FieldSetProps) {
  return <fieldset {...props} className={[styles.fieldSet, className].filter(Boolean).join(' ')}>{legend != null && <legend>{legend}</legend>}{children}</fieldset>;
}
