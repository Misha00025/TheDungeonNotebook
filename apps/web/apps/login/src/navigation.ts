// src/navigation.ts
// Навигация логина.
//
// Login — remote: монтируется хабом под префиксом (/login) либо автономно
// (standalone, префикс ''). Внутренняя навигация должна быть относительной
// к корню приложения, чтобы работать в обоих случаях.
// Здесь — хелпер, который вычисляет базовый префикс из текущего URL и
// навигирует относительно него.

import { useLocation, useNavigate } from 'react-router-dom';

// Первые сегменты маршрутов логина (верхний уровень). По ним определяем,
// где начинается корень приложения в текущем pathname.
const LOGIN_ROUTE_SEGMENTS = ['login'];

/**
 * Возвращает базовый префикс приложения в текущем pathname.
 * Например: '/login' (под хабом) или '' (standalone).
 */
export const getLoginBase = (pathname: string): string => {
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((p) => LOGIN_ROUTE_SEGMENTS.includes(p));
  if (idx === -1) return '';
  return '/' + parts.slice(0, idx).join('/');
};

/**
 * useNavigate, но относительно корня приложения.
 * Аргумент `to` — абсолютный путь внутри приложения (например '/'),
 * к нему автоматически добавляется базовый префикс.
 */
export const useLoginNavigate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const base = getLoginBase(location.pathname);
  return (to: string, opts?: { replace?: boolean }) =>
    navigate(`${base}${to}`, opts);
};
