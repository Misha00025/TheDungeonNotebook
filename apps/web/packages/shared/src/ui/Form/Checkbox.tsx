import React, { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ className, ...props }, ref) {
  return <input {...props} ref={ref} type="checkbox" className={[styles.checkbox, className].filter(Boolean).join(' ')} />;
});

export default Checkbox;
