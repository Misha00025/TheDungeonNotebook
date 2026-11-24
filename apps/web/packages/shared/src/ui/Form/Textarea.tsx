import React, { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import type { FormControlVariant } from './Input';
import styles from '../../styles/components/Input.module.css';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { variant?: FormControlVariant };

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ rows = 1, variant, className, ...props }, ref) {
  return <textarea {...props} ref={ref} rows={rows} className={[styles.input, styles.textarea, variant && styles[variant], className].filter(Boolean).join(' ')} />;
});

export default Textarea;
