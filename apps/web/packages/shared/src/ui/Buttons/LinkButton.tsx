import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import styles from '../../styles/components/Button.module.css';
import type { ButtonVariant } from './Button';

export type LinkButtonProps = LinkProps & {
  variant?: ButtonVariant;
};

const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  { variant = 'primary', className, ...props },
  ref
) {
  const classes = [styles.button, variant === 'secondary' && styles.secondary, className]
    .filter(Boolean)
    .join(' ');

  return <Link {...props} ref={ref} className={classes} />;
});

export default LinkButton;
