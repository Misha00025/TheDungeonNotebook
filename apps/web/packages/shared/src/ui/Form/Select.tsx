import React, { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import styles from '../../styles/components/Input.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, ...props }, ref) {
  return <select {...props} ref={ref} className={[styles.input, className].filter(Boolean).join(' ')} />;
});

export default Select;
