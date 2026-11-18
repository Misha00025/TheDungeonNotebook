import React from 'react';
import styles from './PageLayout.module.css';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  imageUrl?: string;
  imageAlt?: string;
  actions?: React.ReactNode;
  headingLevel?: 1 | 2 | 3;
  id?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  imageUrl,
  imageAlt,
  actions,
  headingLevel = 1,
  id,
}) => {
  const Heading = `h${headingLevel}` as const;
  return (
    <header className={styles.pageHeader}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={imageAlt ?? (typeof title === 'string' ? title : '')}
          className={styles.headerImage}
        />
      )}
      <div className={styles.headerText}>
        <Heading id={id} className={styles.headerTitle}>{title}</Heading>
        {subtitle && <div className={styles.headerSubtitle}>{subtitle}</div>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
};

export default PageHeader;
