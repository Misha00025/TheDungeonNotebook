// Навигация хаба (верхний уровень).
//
// Хаб знает только верхний уровень маршрутов (префиксы), не детали доменов:
//   - Главная  → /            (общая вкладка, подгружает ТОЛЬКО страницу
//                              «Главная» из campaign как готовый модуль)
//   - Игровые системы → /systems/*
//   - Группы (кампания) → /groups/*
//   - Профиль   → /profile
// Панель рендерит общий GlobalSidebar из @tdn/shared (рейл + drawer).

import type { NavItem } from '@tdn/shared';

export const hubNavItems: NavItem[] = [
  { id: 'home', label: 'Главная', icon: '🏠', path: '/' },
  { id: 'groups', label: 'Группы', icon: '👥', path: '/groups' },
  { id: 'profile', label: 'Профиль', icon: '👤', path: '/profile' },
];
