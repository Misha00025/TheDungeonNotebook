import React, { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import styles from '../../styles/components/Input.module.css';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ rows = 1, className, ...props }, ref) {
  return <textarea {...props} ref={ref} rows={rows} className={[styles.input, styles.textarea, className].filter(Boolean).join(' ')} />;
});

export default Textarea;
