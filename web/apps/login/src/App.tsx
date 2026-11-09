// src/App.tsx
// Login — remote-приложение микрофронтендов.
//
// НОВЫЙ КОНТРАКТ (тикет #19): роутером владеет хаб. Remote НЕ создаёт
// собственный Router и НЕ рендерит общие провайдеры (Auth/Theme/Session) —
// их даёт хаб. Здесь — только маршруты через <Routes> (требует родительский
// Router от хаба).
//
// Login — отдельный домен, полностью независим от остальных приложений.
// Он пишет токен в общее хранилище сессии (shared-синглтон @tdn/shared
// tokenManager/AuthContext), которое разделяют все приложения.
//
// Хаб монтирует приложение под префиксом /login/*, поэтому маршруты —
// ОТНОСИТЕЛЬНЫЕ (без префикса /login): '/' = страница входа.
// Автономный запуск (standalone): main.tsx оборачивает этот же компонент
// в свой Router (basename '/login') + общие провайдеры (Auth/Theme/Session).

import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, RemoteAuthProvider } from '@tdn/shared';
import { setApiBase } from '@tdn/shared/config';
import Login from './pages/Login';
import type { AuthContextType } from '@tdn/shared';

const AppContent: React.FC = () => {
  const { accessToken } = useAuth();

  // Уже залогинен — на корень (хаб сам решает, куда вести после входа).
  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC<{ apiBase?: string; auth?: Partial<AuthContextType> }> = ({ apiBase, auth }) => {
  // В режиме хаба хаб прокидывает свой API_BASE — переопределяем фолбэк.
  useEffect(() => {
    if (apiBase) setApiBase(apiBase);
  }, [apiBase]);

  return (
    <RemoteAuthProvider auth={auth}>
      <AppContent />
    </RemoteAuthProvider>
  );
};

export default App;
