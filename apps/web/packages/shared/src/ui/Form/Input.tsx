import React, { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import styles from '../../styles/components/Input.module.css';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return <input {...props} ref={ref} className={[styles.input, className].filter(Boolean).join(' ')} />;
});

export default Input;
