import React, { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from '../../styles/components/Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  busy?: boolean;
  size?: 'default' | 'small';
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { type = 'button', variant = 'primary', busy = false, size = 'default', disabled, className, ...props },
  ref
) {
  const classes = [styles.button, size === 'small' && styles.small, variant === 'secondary' && styles.secondary, variant === 'ghost' && styles.ghost, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    />
  );
});

export default Button;
