import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TokenResponse, WhoAmIResponse } from './types';
import { authAPI, makeAuthenticatedRequest } from './api';
import tokenManager from './tokenManager';

export interface AuthContextType {
  accessToken: string | null;
  userId: number | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<number | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = await tokenManager.ensureToken();

      if (token) {
        try {
          const whoamiResponse = await makeAuthenticatedRequest('/whoami');
          if (whoamiResponse.ok) {
            const whoamiData: WhoAmIResponse = await whoamiResponse.json();
            setUserId(whoamiData.id);
            localStorage.setItem('userId', whoamiData.id.toString());
          }
        } catch (error) {
          console.error('Session restore failed:', error);
          tokenManager.clear();
          localStorage.removeItem('userId');
        }
      }

      setInitializing(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const tokenData: TokenResponse = await authAPI.login({ username, password });
      tokenManager.setTokens(tokenData.access_token, tokenData.refresh_token);

      const whoamiResponse = await makeAuthenticatedRequest('/whoami');
      if (whoamiResponse.ok) {
        const whoamiData: WhoAmIResponse = await whoamiResponse.json();
        setUserId(whoamiData.id);
        localStorage.setItem('userId', whoamiData.id.toString());
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (username: string, password: string) => {
    try {
      const tokenData: TokenResponse = await authAPI.register({ username, password });
      tokenManager.setTokens(tokenData.access_token, tokenData.refresh_token);

      const whoamiResponse = await makeAuthenticatedRequest('/whoami');
      if (whoamiResponse.ok) {
        const whoamiData: WhoAmIResponse = await whoamiResponse.json();
        setUserId(whoamiData.id);
        localStorage.setItem('userId', whoamiData.id.toString());
      }
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUserId(null);
    tokenManager.clear();
    localStorage.removeItem('userId');
  };

  if (initializing) {
    return null;
  }

  return (
    <AuthContext.Provider value={{
      accessToken: tokenManager.getAccessToken(),
      userId,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * RemoteAuthProvider — провайдер auth для remote-модулей, монтируемых хабом.
 *
 * Хаб владеет сессией (AuthProvider) и прокидывает в remote-компонент
 * auth (accessToken/login/logout/userId) через пропс. Remote НЕ бандлит
 * собственный AuthProvider (иначе useAuth внутри remote ищет свой контекст,
 * которого нет) — вместо этого он оборачивает своё дерево в этот провайдер,
 * который «подсовывает» переданный хабом auth в общий AuthContext.
 *
 * Если auth не передан (автономный запуск) — провайдер ничего не делает,
 * и дерево использует AuthProvider из main.tsx (standalone).
 */
export const RemoteAuthProvider: React.FC<{
  auth?: Partial<AuthContextType>;
  children: ReactNode;
}> = ({ auth, children }) => {
  if (!auth) {
    return <>{children}</>;
  }

  const value: AuthContextType = {
    accessToken: auth.accessToken ?? null,
    userId: auth.userId ?? null,
    login: auth.login ?? (async () => {}),
    register: auth.register ?? (async () => {}),
    logout: auth.logout ?? (() => {}),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
