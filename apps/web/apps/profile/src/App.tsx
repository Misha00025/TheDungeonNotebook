// src/App.tsx
// Профиль — remote-приложение микрофронтендов.
//
// НОВЫЙ КОНТРАКТ (тикет #19): роутером владеет хаб. Remote НЕ создаёт
// собственный Router и НЕ рендерит общие провайдеры (Auth/Theme/Session) —
// их даёт хаб. Здесь — только маршруты через <Routes> (требует родительский
// Router от хаба).
//
// Хаб монтирует приложение под префиксом /profile/*, поэтому маршруты —
// ОТНОСИТЕЛЬНЫЕ (без префикса /profile): '/' = профиль.
// Автономный запуск (standalone): main.tsx оборачивает этот же компонент
// в свой Router (basename '/profile') + общие провайдеры (Auth/Theme/Session).

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, RemoteAuthProvider } from '@tdn/shared';
import { setApiBase } from '@tdn/shared/config';
import Login from './pages/Login';
import Profile from './pages/Profile';
import type { AuthContextType } from '@tdn/shared';

const AppContent: React.FC = () => {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Profile />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC<{ apiBase?: string; auth?: Partial<AuthContextType> }> = ({ apiBase, auth }) => {
  // В режиме хаба хаб прокидывает свой API_BASE — переопределяем фолбэк.
  // Вызываем СИНХРОННО во время рендера (а не в useEffect): React выполняет
  // эффекты снизу вверх (сначала дочерние), поэтому Profile.tsx вызывает
  // fetchProfile() в своём useEffect РАНЬШЕ, чем сработал бы эффект App.
  // Если setApiBase отложить в эффект, первый запрос /whoami уйдёт на фолбэк
  // localhost:5000 → «Failed to fetch». Синхронный вызов гарантирует, что
  // apiBase уже установлен до любых дочерних эффектов.
  if (apiBase) setApiBase(apiBase);

  return (
    <RemoteAuthProvider auth={auth}>
      <AppContent />
    </RemoteAuthProvider>
  );
};

export default App;
