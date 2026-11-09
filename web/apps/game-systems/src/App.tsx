// src/App.tsx
// Игровые системы — remote-приложение микрофронтендов.
//
// НОВЫЙ КОНТРАКТ (тикет #19): роутером владеет хаб. Remote НЕ создаёт
// собственный Router и НЕ рендерит общие провайдеры (Auth/Theme/Session) —
// их даёт хаб. Здесь — только маршруты через <Routes> (требует родительский
// Router от хаба).
//
// Хаб монтирует приложение под префиксом /systems/*, поэтому маршруты —
// ОТНОСИТЕЛЬНЫЕ (без префикса /systems): '/' = список, '/:systemId' = система.
// Автономный запуск (standalone): main.tsx оборачивает этот же компонент
// в свой Router (basename '/systems') + общие провайдеры (Auth/Theme/Session).

import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, RemoteAuthProvider } from '@tdn/shared';
import { setApiBase } from '@tdn/shared/config';
import Login from './pages/Login';
import AppLayout from './layout/AppLayout';
import SystemsList from './pages/SystemsList';
import SystemLayout from './pages/SystemLayout';
import SystemOverview from './pages/SystemOverview';
import WorkInProgress from './pages/WorkInProgress';
import type { AuthContextType } from '@tdn/shared';

const AppContent: React.FC = () => {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <Login />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<SystemsList />} />
        <Route path="/:systemId" element={<SystemLayout />}>
          <Route index element={<SystemOverview />} />
          <Route path="content" element={<WorkInProgress />} />
          <Route path="versions" element={<WorkInProgress />} />
          <Route path="rules" element={<WorkInProgress />} />
        </Route>
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
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
