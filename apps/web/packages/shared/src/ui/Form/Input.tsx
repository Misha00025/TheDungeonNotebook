import React, { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import styles from '../../styles/components/Input.module.css';

export type FormControlVariant = 'embedded' | 'single-line' | 'multiline';
export type InputProps = InputHTMLAttributes<HTMLInputElement> & { variant?: FormControlVariant };

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ variant, className, ...props }, ref) {
  return <input {...props} ref={ref} className={[styles.input, variant && styles[variant], className].filter(Boolean).join(' ')} />;
});

export default Input;
