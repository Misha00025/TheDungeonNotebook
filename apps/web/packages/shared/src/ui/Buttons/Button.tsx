import React, { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from '../../styles/components/Button.module.css';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  busy?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { type = 'button', variant = 'primary', busy = false, disabled, className, ...props },
  ref
) {
  const classes = [styles.button, variant === 'secondary' && styles.secondary, className]
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
