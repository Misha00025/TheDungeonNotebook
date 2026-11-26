import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../Panel/Panel';
import styles from './NavigationListItem.module.css';

export type NavigationListItemTag = {
  key: string;
  label: string;
};

export type NavigationListItemProps = Omit<HTMLAttributes<HTMLElement>, 'title' | 'children'> & {
  title: string;
  titleAside?: ReactNode;
  description?: string;
  tags?: readonly NavigationListItemTag[];
  actions?: ReactNode;
  accented?: boolean;
} & ({ to: string; href?: never } | { href: string; to?: never });

const NavigationListItem: React.FC<NavigationListItemProps> = ({
  title,
  titleAside,
  description,
  tags = [],
  actions,
  accented = false,
  to,
  href,
  className,
  ...props
}) => <article {...props} className={styles.item}>
  <Link className={[styles.link, actions != null && styles.hasActions, accented && styles.accented, className].filter(Boolean).join(' ')} to={to ?? href!}>
    <span className={styles.header}>
      <span className={styles.titleGroup}>
        <span className={styles.title}>{title}</span>
        {titleAside != null && <span className={styles.titleAside}>{titleAside}</span>}
      </span>
      {tags.length > 0 && <span className={styles.tagArea}>
        {tags.map(tag => <Badge key={tag.key}>{tag.label}</Badge>)}
      </span>}
    </span>
    {description !== undefined && <span className={styles.description}>
      {description.length > 0 ? description : 'Описание отсутствует.'}
    </span>}
  </Link>
  {actions != null && <div className={styles.actions}>{actions}</div>}
</article>;

export default NavigationListItem;
