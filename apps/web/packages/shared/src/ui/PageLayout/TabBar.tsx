import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import styles from './PageLayout.module.css';

export interface TabItem {
  id: string;
  label: string;
  path: string;
}

export interface TabBarProps {
  tabs: TabItem[];
  basePath: string;
  orientation?: 'top' | 'bottom';
  'aria-label'?: string;
  hideOnMobile?: boolean;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, basePath, orientation = 'top', 'aria-label': ariaLabel = 'Разделы', hideOnMobile = false }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const location = useLocation();
  const route = (tabPath: string) => `${basePath.replace(/\/+$/, '')}/${tabPath.replace(/^\/+/, '')}` || '/';

  const isActive = (tabPath: string) => {
    const fullPath = route(tabPath).replace(/\/$/, '');
    return location.pathname === fullPath || location.pathname.endsWith(`/${tabPath}`);
  };

  if (hideOnMobile && isMobile) return null;

  return (
    <nav
      className={`${styles.tabBar}${orientation === 'bottom' ? ` ${styles.tabBarBottom}` : ''}${hideOnMobile ? ` ${styles.tabBarHiddenOnMobile}` : ''}`}
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={route(tab.path)}
          aria-current={isActive(tab.path) ? 'page' : undefined}
          className={`${styles.tabItem}${isActive(tab.path) ? ` ${styles.tabItemActive}` : ''}${orientation === 'bottom' ? ` ${styles.tabItemBottom}` : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
};

export default TabBar;
