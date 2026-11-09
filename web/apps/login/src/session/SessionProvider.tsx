// src/session/SessionProvider.tsx
// Сессия логина.
//
// В режиме хаба сессию оркеструет хаб и прокидывает её в remote-модули
// через пропс `session` (см. session.ts). Здесь — провайдер, который отдаёт
// эту сессию вниз по дереву.
//
// При автономном запуске (без хаба, session не передан) — fallback: грузим
// сессию из хранилища (tokenManager.ensureToken + localStorage userId).

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import tokenManager from '@tdn/shared/auth/tokenManager';
import { setApiBase } from '@tdn/shared/config';
import type { LoginSession } from '../session';

const SessionContext = createContext<LoginSession | null>(null);

export const SessionProvider: React.FC<{
  session?: LoginSession;
  apiBase?: string;
  children: ReactNode;
}> = ({ session, apiBase, children }) => {
  const [fallback, setFallback] = useState<LoginSession | null>(null);

  // В режиме хаба хаб прокидывает свой API_BASE — переопределяем фолбэк.
  useEffect(() => {
    if (apiBase) setApiBase(apiBase);
  }, [apiBase]);

  useEffect(() => {
    if (session) return;

    let cancelled = false;
    (async () => {
      const token = await tokenManager.ensureToken();
      if (cancelled) return;
      const userIdRaw = localStorage.getItem('userId');
      setFallback({
        accessToken: token,
        userId: userIdRaw ? parseInt(userIdRaw, 10) : null,
        apiBase: apiBase || '',
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [session, apiBase]);

  const value = session ?? fallback;

  if (!value) {
    // Ждём fallback (автономный запуск) — сессия ещё не загружена.
    return null;
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useLoginSession = (): LoginSession => {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error('useLoginSession must be used within a SessionProvider');
  }
  return context;
};
