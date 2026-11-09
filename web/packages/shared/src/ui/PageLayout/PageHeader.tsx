import React from 'react';
import styles from './PageLayout.module.css';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  imageUrl,
  imageAlt,
  actions,
}) => {
  return (
    <div className={styles.pageHeader}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={imageAlt ?? title}
          className={styles.headerImage}
        />
      )}
      <div>
        <div className={styles.headerTitle}>{title}</div>
        {subtitle && <div className={styles.headerSubtitle}>{subtitle}</div>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </div>
  );
};

export default PageHeader;
