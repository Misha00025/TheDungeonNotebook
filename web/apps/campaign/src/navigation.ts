// src/navigation.ts
// Навигация кампании.
//
// Кампания — remote: монтируется хабом под префиксом (/groups/*) либо
// автономно (standalone, префикс ''). Внутренняя навигация должна быть
// относительной к корню кампании, чтобы работать в обоих случаях.
// Здесь — хелпер, который вычисляет базовый префикс кампании из текущего
// URL и навигирует относительно него.

import { useLocation, useNavigate } from 'react-router-dom';

// Первые сегменты маршрутов кампании (верхний уровень). По ним определяем,
// где начинается корень кампании в текущем pathname.
const CAMPAIGN_ROUTE_SEGMENTS = [
  'groups',
  'profile',
  'complete-registration',
  'login',
];

/**
 * Возвращает базовый префикс кампании в текущем pathname.
 * Например: '/hub' (под хабом на /hub/groups/*) или '' (кампания в корне
 * роутера — хаб на /groups/* либо standalone на /).
 *
 * Если в pathname нет ни одного сегмента маршрута кампании — значит, весь
 * путь и есть базовый префикс (например '/hub').
 * Это нужно для вычисления basename роутера при монтировании хабом.
 *
 * ВАЖНО: когда кампания смонтирована в корне роутера (idx === 0 или путь
 * пуст), возвращаем '' (пустую строку), а НЕ '/'. Иначе склейка base + to
 * даёт двойной слэш '//groups' вместо '/groups' (тикет #28).
 */
export const getCampaignBase = (pathname: string): string => {
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.findIndex((p) => CAMPAIGN_ROUTE_SEGMENTS.includes(p));
  const prefix = idx === -1 ? parts : parts.slice(0, idx);
  return prefix.length ? '/' + prefix.join('/') : '';
};

/**
 * Склеивает базовый префикс кампании с абсолютным путём внутри кампании
 * без двойного слэша. Если base пустой или '/', возвращаем просто `to`.
 */
const joinCampaignPath = (base: string, to: string): string => {
  if (!base || base === '/') return to;
  return `${base}${to}`;
};

/**
 * useNavigate, но относительно корня кампании.
 * Аргумент `to` — абсолютный путь внутри кампании (например '/groups'),
 * к нему автоматически добавляется базовый префикс кампании.
 */
export const useCampaignNavigate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const base = getCampaignBase(location.pathname);
  return (to: string, opts?: { replace?: boolean }) =>
    navigate(joinCampaignPath(base, to), opts);
};

/**
 * useCampaignPath — возвращает функцию, которая превращает абсолютный путь
 * внутри кампании (например '/groups') в путь с учётом базового префикса
 * кампании ('/groups/groups' под хабом, '/groups' standalone).
 * Полезно для ссылок (breadcrumbs, табы).
 */
export const useCampaignPath = () => {
  const location = useLocation();
  const base = getCampaignBase(location.pathname);
  return (to: string) => joinCampaignPath(base, to);
};
