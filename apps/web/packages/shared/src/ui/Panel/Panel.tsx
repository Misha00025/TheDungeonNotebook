import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

export type PanelProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  as?: 'section' | 'article' | 'div';
  title?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={[styles.badge, className].filter(Boolean).join(' ')} />;
}

export default function Panel({
  as: Element = 'section',
  title,
  headingLevel = 2,
  description,
  status,
  actions,
  children,
  className,
  ...props
}: PanelProps) {
  const Heading = `h${headingLevel}` as const;
  const hasBody = React.Children.toArray(children).length > 0;

  return (
    <Element {...props} className={[styles.panel, className].filter(Boolean).join(' ')}>
      {(title != null || description != null || status != null) && (
        <header className={styles.header}>
          <div className={styles.headingContent}>
            {title != null && <Heading className={styles.title}>{title}</Heading>}
            {description != null && <div className={styles.description}>{description}</div>}
          </div>
          {status != null && <div className={styles.status}>{status}</div>}
        </header>
      )}
      {hasBody && <div className={styles.body}>{children}</div>}
      {actions != null && <footer className={styles.actions}>{actions}</footer>}
    </Element>
  );
}
