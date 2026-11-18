import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './WorkspaceLayout.module.css';

export type WorkspaceLayoutProps = HTMLAttributes<HTMLDivElement> & {
  navigation: ReactNode;
  children: ReactNode;
  mobileNavigation?: ReactNode;
};

export default function WorkspaceLayout({ navigation, children, mobileNavigation, className, ...props }: WorkspaceLayoutProps) {
  return (
    <div {...props} className={[styles.workspace, mobileNavigation != null && styles.hasMobileNavigation, className].filter(Boolean).join(' ')}>
      <div className={styles.grid}>
        <aside className={styles.navigation}>{navigation}</aside>
        <div className={styles.content}>{children}</div>
      </div>
      {mobileNavigation}
    </div>
  );
}
