import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { To } from 'react-router-dom';
import DropdownMenu from '../DropdownMenu/DropdownMenu';
import useMediaQuery from '../hooks/useMediaQuery';
import styles from './BottomNavigation.module.css';

export type BottomNavigationItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  to: To;
  active?: boolean;
};

export type BottomNavigationProps = {
  'aria-label': string;
  items: BottomNavigationItem[];
};

export default function BottomNavigation({ items, 'aria-label': ariaLabel }: BottomNavigationProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigationRef = useRef<HTMLElement>(null);
  const measurementRef = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    if (!isMobile) return;
    const navigation = navigationRef.current;
    const measurement = measurementRef.current;
    if (!navigation || !measurement) return;

    const updateCapacity = () => {
      const navigationRect = navigation.getBoundingClientRect();
      const navigationStyle = window.getComputedStyle(navigation);
      const horizontalPadding = (parseFloat(navigationStyle.paddingLeft) || 0) + (parseFloat(navigationStyle.paddingRight) || 0);
      const availableWidth = Math.max(0, navigationRect.width - horizontalPadding);
      const slotWidth = measurement.getBoundingClientRect().width;
      if (availableWidth <= 0 || slotWidth <= 0) return;
      const capacity = Math.max(1, Math.floor(availableWidth / slotWidth));
      setVisibleCount(items.length <= capacity ? items.length : Math.max(1, capacity - 1));
    };

    updateCapacity();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateCapacity);
      observer.observe(navigation);
      window.addEventListener('resize', updateCapacity);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateCapacity);
      };
    }
    window.addEventListener('resize', updateCapacity);
    return () => window.removeEventListener('resize', updateCapacity);
  }, [items.length, isMobile]);

  if (!isMobile) return null;

  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);
  const overflowActive = overflowItems.some(item => item.active);

  return createPortal(
    <nav ref={navigationRef} className={styles.navigation} aria-label={ariaLabel}>
      {visibleItems.map(item => (
        <Link key={item.id} to={item.to} className={styles.item} aria-current={item.active ? 'page' : undefined}>
          <span className={styles.icon} aria-hidden="true">{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </Link>
      ))}
      {overflowItems.length > 0 && (
        <DropdownMenu
          className={styles.moreWrapper}
          buttonClassName={overflowActive ? styles.moreActive : ''}
          buttonContent={<><span className={styles.icon} aria-hidden="true">⋯</span><span className={styles.label}>Ещё</span></>}
          buttonTitle="Ещё"
          align="right"
          position="top"
          items={overflowItems.map(item => ({ label: item.label, icon: item.icon, to: item.to, active: item.active }))}
        />
      )}
      <span ref={measurementRef} className={styles.measurementSlot} aria-hidden="true" />
    </nav>,
    document.body
  );
}
