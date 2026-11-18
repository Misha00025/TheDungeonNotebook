import React from 'react';
import type { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { To } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import styles from './SectionNav.module.css';

export type SectionNavItem = {
  label: ReactNode;
  to: To;
  active?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export type SectionNavProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  items: SectionNavItem[];
  'aria-label': string;
  hideOnMobile?: boolean;
};

export default function SectionNav({ items, className, hideOnMobile = false, ...props }: SectionNavProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  if (hideOnMobile && isMobile) return null;
  return (
    <nav {...props} className={[styles.navigation, hideOnMobile && styles.hideOnMobile, className].filter(Boolean).join(' ')}>
      {items.map(({ label, to, active, onClick }, index) => (
        <Link
          key={index}
          to={to}
          onClick={onClick}
          aria-current={active ? 'page' : undefined}
          className={styles.link}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
