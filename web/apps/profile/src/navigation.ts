// src/navigation.ts
// Навигация профиля.
//
// Профиль — remote: монтируется хабом под префиксом (/profile) либо
// автономно (standalone, префикс ''). Внутренняя навигация должна быть
// относительной к корню приложения, чтобы работать в обоих случаях.
// Здесь — хелпер, который вычисляет базовый префикс из текущего URL и
// навигирует относительно него.

import { useLocation, useNavigate } from 'react-router-dom';

// Первые сегменты маршрутов профиля (верхний уровень). По ним определяем,
// где начинается корень приложения в текущем pathname.
const PROFILE_ROUTE_SEGMENTS = ['profile', 'login'];

/**
 * Возвращает базовый префикс приложения в текущем pathname.
 * Например: '/profile' (под хабом) или '' (standalone).
 */
export const getProfileBase = (pathname: string): string => {
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((p) => PROFILE_ROUTE_SEGMENTS.includes(p));
  if (idx === -1) return '';
  return '/' + parts.slice(0, idx).join('/');
};

/**
 * useNavigate, но относительно корня приложения.
 * Аргумент `to` — абсолютный путь внутри приложения (например '/profile'),
 * к нему автоматически добавляется базовый префикс.
 */
export const useProfileNavigate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const base = getProfileBase(location.pathname);
  return (to: string, opts?: { replace?: boolean }) =>
    navigate(`${base}${to}`, opts);
};

/**
 * useProfilePath — возвращает функцию, которая превращает абсолютный путь
 * внутри приложения (например '/profile') в путь с учётом базового префикса
 * ('/profile/profile' под хабом, '/profile' standalone).
 * Полезно для ссылок (breadcrumbs, табы).
 */
export const useProfilePath = () => {
  const location = useLocation();
  const base = getProfileBase(location.pathname);
  return (to: string) => `${base}${to}`;
};
