// src/Home.tsx
// Модуль «Главная» — подгружается хабом на общей вкладке «Главная».
// Хаб не тянет домен кампании: он монтирует только этот готовый модуль
// (campaign/Home), а не всё приложение.
//
// Модуль самодостаточен: предоставляет нужные доменные провайдеры
// (VisitedProvider для Dashboard). Роутер и сессия — от хаба.

import React, { useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { VisitedProvider } from './contexts/VisitedContext';
import { setApiBase } from '@tdn/shared/config';
import { RemoteAuthProvider } from '@tdn/shared';
import type { AuthContextType } from '@tdn/shared';

const Home: React.FC<{ apiBase?: string; auth?: Partial<AuthContextType> }> = ({ apiBase, auth }) => {
  // В режиме хаба хаб прокидывает свой API_BASE — переопределяем фолбэк.
  useEffect(() => {
    if (apiBase) setApiBase(apiBase);
  }, [apiBase]);

  return (
    <RemoteAuthProvider auth={auth}>
      <VisitedProvider>
        <Dashboard />
      </VisitedProvider>
    </RemoteAuthProvider>
  );
};

export default Home;
