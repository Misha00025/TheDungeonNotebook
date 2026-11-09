// Оркестрация сессии хабом.
//
// Хаб — владелец сессии: он решает, что пользователь не залогинен (гейт),
// и прокидывает сессию в remotes. Здесь — провайдер, который берёт состояние
// из общего AuthProvider (@tdn/shared) и отдаёт его в виде HubSession
// (см. session.ts) для передачи в remote-модули.

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth, getApiBase } from '@tdn/shared';
import type { HubSession } from '../session';

const SessionContext = createContext<HubSession | null>(null);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { accessToken, userId } = useAuth();

  const session: HubSession = { accessToken, userId, apiBase: getApiBase() };

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
};

export const useHubSession = (): HubSession => {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error('useHubSession must be used within a SessionProvider');
  }
  return context;
};
