// Общая боковая панель приложения (тикет #36).
//
// Единый компонент для всех приложений (хаб и remotes) — раньше логика
// дублировалась в apps/hub/src/components/HubSidebar и в
// packages/shared/src/ui/GlobalSidebar/SidebarDrawer. Теперь один источник.
//
// Поведение (1:1 по прототипу sidebar-rail.html):
//   ПК (≥768px), свёрнуто (isOpen=false): постоянный рейл ~60px слева с
//     иконками, всегда виден. Рабочая область занимает остаток окна
//     (margin-left: var(--rail-width) — см. .app-content в globals.css).
//   ПК, развёрнуто (isOpen=true): drawer 300px ПОВЕРХ контента (overlay +
//     затемнение). Контент НЕ сдвигается.
//   Мобильный (<768px): рейл скрыт; сверху липкая плашка с ☰ и названием;
//     drawer открывается во всю ширину (overlay); контент получает padding-top.
//
// Состояние isOpen берётся из общего SidebarContext (персистится в localStorage).
// Тема — только через переменные темы (--bg-primary, --text-primary,
// --border-color, --accent-color, --bg-secondary); prefers-color-scheme не
// используется.

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSidebar } from '../SidebarContext';
import { useAuth } from '../../auth/useAuth';
import ThemeToggle from '../Buttons/ThemeToggle/ThemeToggle';
import type { NavItem } from '../navigation';
import styles from './GlobalSidebar.module.css';

interface GlobalSidebarProps {
  navItems: NavItem[];
  /** Название приложения в верхней плашке (мобильные). */
  brand?: string;
  /** Заголовок drawer'а. */
  title?: string;
  /** Оставлено для обратной совместимости; на раскладку не влияет. */
  mode?: 'inline' | 'fixed';
}

const GlobalSidebar: React.FC<GlobalSidebarProps> = ({
  navItems,
  brand = 'The Dungeon Notebook',
  title = 'Меню',
}) => {
  const { isOpen, open, close } = useSidebar();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Верхняя плашка — только мобильные. */}
      <header className={styles.topbar}>
        <button className={styles.burger} onClick={open} aria-label="Открыть меню">
          ☰
        </button>
        <span className={styles.brand}>{brand}</span>
      </header>

      {/* Рейл — только ПК, свёрнутое состояние. */}
      <nav className={styles.rail} aria-label="Основная навигация">
        <button
          className={`${styles.railItem} ${styles.railToggle}`}
          onClick={open}
          title="Развернуть меню"
          aria-label="Развернуть меню"
        >
          ☰<span className={styles.tip}>Развернуть</span>
        </button>
        <div className={styles.railSep} />
        {navItems.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className={`${styles.railItem} ${isActive(item.path) ? styles.active : ''}`}
            aria-label={item.label}
          >
            {item.icon}
            <span className={styles.tip}>{item.label}</span>
          </Link>
        ))}
        <div className={styles.spacer} />
        <ThemeToggle variant="rail" />
      </nav>

      {isOpen && <div className={styles.overlay} onClick={close} />}

      <aside className={`${styles.drawer} ${isOpen ? styles.open : styles.closed}`}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>{title}</span>
          <button className={styles.closeBtn} onClick={close} aria-label="Закрыть меню">
            ✕
          </button>
        </div>

        <nav className={styles.drawerNav}>
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
              onClick={close}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.drawerFooter}>
          <div className={styles.footerRow}>
            <button className={styles.footerBtn} onClick={handleLogout}>
              <span className={styles.icon}>🚪</span>
              <span className={styles.label}>Выйти</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
};

export default GlobalSidebar;
