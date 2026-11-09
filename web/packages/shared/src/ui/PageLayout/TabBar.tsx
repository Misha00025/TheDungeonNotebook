import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './PageLayout.module.css';

export interface TabItem {
  id: string;
  label: string;
  path: string;
}

interface TabBarProps {
  tabs: TabItem[];
  basePath: string;
  orientation?: 'top' | 'bottom';
}

const TabBar: React.FC<TabBarProps> = ({ tabs, basePath, orientation = 'top' }) => {
  const location = useLocation();

  const isActive = (tabPath: string) => {
    const fullPath = `${basePath}/${tabPath}`.replace(/\/$/, '');
    return location.pathname === fullPath || location.pathname.endsWith(`/${tabPath}`);
  };

  return (
    <nav
      className={`${styles.tabBar}${orientation === 'bottom' ? ` ${styles.tabBarBottom}` : ''}`}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={`${basePath}/${tab.path}`}
          className={`${styles.tabItem}${isActive(tab.path) ? ` ${styles.tabItemActive}` : ''}${orientation === 'bottom' ? ` ${styles.tabItemBottom}` : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
};

export default TabBar;
