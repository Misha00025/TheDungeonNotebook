import React, { useRef, useEffect, useState } from 'react';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs';
import TabBar, { TabItem } from './TabBar';
import GlobalSidebar from '../GlobalSidebar/GlobalSidebar';
import type { NavItem } from '../navigation';
import styles from './PageLayout.module.css';

export interface PageLayoutProps {
  breadcrumbs: BreadcrumbItem[];
  header?: React.ReactNode;
  tabs: TabItem[];
  tabBasePath: string;
  tabOrientation?: 'top' | 'bottom';
  navItems?: NavItem[];
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  breadcrumbs,
  header,
  tabs,
  tabBasePath,
  tabOrientation = 'top',
  navItems,
  children,
}) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, [header]);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!headerHeight) return;
        const stickyHeight = stickyRef.current?.offsetHeight ?? 0;
        const baseHeight = stickyHeight - headerHeight;
        const scrolled = window.scrollY;

        let progress = 0;
        if (scrolled > baseHeight) {
          if (scrolled >= stickyHeight) {
            progress = 1;
          } else {
            progress = (scrolled - baseHeight) / headerHeight;
          }
        }

        setScrollProgress(progress);
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [headerHeight]);

  const headerStyle: React.CSSProperties = {
    maxHeight: headerHeight ? Math.max(headerHeight * (1 - scrollProgress), 0) : undefined,
    opacity: 1 - scrollProgress,
    overflow: 'hidden',
    transition: 'max-height 0.1s ease-out, opacity 0.15s ease-out',
    willChange: 'max-height, opacity',
    margin: scrollProgress > 0.99 ? '0' : undefined,
    padding: scrollProgress > 0.99 ? '0 1rem' : undefined,
  };

  return (
    <>
      <div ref={stickyRef} className={styles.stickyHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {navItems && <GlobalSidebar mode="inline" navItems={navItems} />}
          <Breadcrumbs items={breadcrumbs} />
        </div>
        {header && (
          <div ref={headerRef} className={styles.pageHeader} style={headerStyle}>
            {header}
          </div>
        )}
        <TabBar
          tabs={tabs}
          basePath={tabBasePath}
          orientation={tabOrientation}
        />
      </div>
      <div
        className={styles.pageContent}
        style={
          tabOrientation === 'bottom'
            ? { paddingBottom: '5rem' }
            : undefined
        }
      >
        {children}
      </div>
    </>
  );
};

export default PageLayout;
