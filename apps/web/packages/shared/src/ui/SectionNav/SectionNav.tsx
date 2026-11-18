import React from 'react';
import type { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { To } from 'react-router-dom';
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
};

export default function SectionNav({ items, className, ...props }: SectionNavProps) {
  return (
    <nav {...props} className={[styles.navigation, className].filter(Boolean).join(' ')}>
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
