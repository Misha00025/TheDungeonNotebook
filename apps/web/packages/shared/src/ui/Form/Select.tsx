import React, { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import type { FormControlVariant } from './Input';
import styles from '../../styles/components/Input.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { variant?: FormControlVariant };

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ variant, className, ...props }, ref) {
  return <select {...props} ref={ref} className={[styles.input, variant && styles[variant], className].filter(Boolean).join(' ')} />;
});

export default Select;
