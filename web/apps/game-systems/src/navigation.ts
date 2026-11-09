// src/navigation.ts
// Навигация игровых систем.
//
// Игровые системы — remote: монтируются хабом под префиксом (/systems/*)
// либо автономно (standalone, префикс ''). Внутренняя навигация должна быть
// относительной к корню приложения, чтобы работать в обоих случаях.
// Здесь — хелпер, который вычисляет базовый префикс из текущего URL и
// навигирует относительно него.

import { useLocation, useNavigate } from 'react-router-dom';

// Первые сегменты маршрутов игровых систем (верхний уровень). По ним
// определяем, где начинается корень приложения в текущем pathname.
const GAME_SYSTEMS_ROUTE_SEGMENTS = ['systems', 'profile', 'login'];

/**
 * Возвращает базовый префикс приложения в текущем pathname.
 * Например: '/systems' (под хабом) или '' (standalone).
 */
export const getGameSystemsBase = (pathname: string): string => {
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((p) => GAME_SYSTEMS_ROUTE_SEGMENTS.includes(p));
  if (idx === -1) return '';
  return '/' + parts.slice(0, idx).join('/');
};

/**
 * useNavigate, но относительно корня приложения.
 * Аргумент `to` — абсолютный путь внутри приложения (например '/systems'),
 * к нему автоматически добавляется базовый префикс.
 */
export const useGameSystemsNavigate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const base = getGameSystemsBase(location.pathname);
  return (to: string, opts?: { replace?: boolean }) =>
    navigate(`${base}${to}`, opts);
};

/**
 * useGameSystemsPath — возвращает функцию, которая превращает абсолютный путь
 * внутри приложения (например '/systems') в путь с учётом базового префикса
 * ('/systems/systems' под хабом, '/systems' standalone).
 * Полезно для ссылок (breadcrumbs, табы).
 */
export const useGameSystemsPath = () => {
  const location = useLocation();
  const base = getGameSystemsBase(location.pathname);
  return (to: string) => `${base}${to}`;
};
