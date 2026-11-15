import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { getConfig, setConfig } from '../config';
import type { AppConfig } from '../config';
import { AuthenticatedRequest, createBffClient } from './bffClient';
import { setAuthenticatedRequest } from './api';
import type { WhoAmIResponse } from './types';

export interface AuthContextType {
  status: 'loading' | 'anonymous' | 'authenticated' | 'error';
  authenticated: boolean;
  userId: number | null;
  error: string | null;
  config: AppConfig;
  request: AuthenticatedRequest;
  login: (returnUrl?: string) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export type HubRemoteProps = { auth: AuthContextType };

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const config = getConfig();
  const [status, setStatus] = useState<AuthContextType['status']>('loading');
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const init = useRef<Promise<void> | null>(null);
  const client = useRef<ReturnType<typeof createBffClient> | null>(null);

  if (!client.current) {
    client.current = createBffClient(config, () => {
      generation.current++;
      if (mounted.current) {
        setUserId(null);
        setStatus('anonymous');
        setError(null);
      }
    });
  }

  const bff = client.current;
  setAuthenticatedRequest(bff.request);

  const refreshSession = useCallback((): Promise<void> => {
    if (init.current) return init.current;

    const current = generation.current;
    const pending = (async () => {
      try {
        const session = await bff.getSession();
        if (!session.authenticated) {
          if (mounted.current && current === generation.current) {
            setUserId(null);
            setStatus('anonymous');
            setError(null);
          }
          return;
        }

        const response = await bff.request('/whoami');
        if (!response.ok) {
          throw new Error(`Whoami request failed: ${response.status}`);
        }

        const user: WhoAmIResponse = await response.json();
        if (typeof user.id !== 'number' || user.type !== 'user') {
          throw new Error('Malformed whoami response');
        }

        if (mounted.current && current === generation.current) {
          setUserId(user.id);
          setStatus('authenticated');
          setError(null);
        }
      } catch (reason) {
        if (mounted.current && current === generation.current) {
          setStatus('error');
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      }
    })().finally(() => {
      if (init.current === pending) init.current = null;
    });

    init.current = pending;
    return pending;
  }, [bff]);

  useEffect(() => {
    mounted.current = true;
    setAuthenticatedRequest(bff.request);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    void refreshSession();

    return () => {
      mounted.current = false;
      setAuthenticatedRequest(null);
    };
  }, [bff, refreshSession]);

  const logout = useCallback(async () => {
    const previous = { id: userId, status, error };
    const current = generation.current;

    try {
      await bff.logout();
      if (mounted.current && current === generation.current) {
        generation.current++;
        setUserId(null);
        setStatus('anonymous');
        setError(null);
      }
    } catch (reason) {
      if (mounted.current && current === generation.current) {
        setUserId(previous.id);
        setStatus(previous.status);
        setError(reason instanceof Error ? reason.message : String(reason));
      }
      throw reason;
    }
  }, [bff, error, status, userId]);

  const login = useCallback((returnUrl?: string) => {
    const localReturnPath = returnUrl ??
      `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(bff.getLoginUrl(localReturnPath));
  }, [bff]);

  const value: AuthContextType = {
    status,
    authenticated: status === 'authenticated',
    userId,
    error,
    config,
    request: bff.request,
    login,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const RemoteAuthProvider: React.FC<HubRemoteProps & { children: ReactNode }> = ({
  auth,
  children,
}) => {
  if (!auth) {
    throw new Error('RemoteAuthProvider requires Hub auth');
  }
  setConfig(auth.config);
  setAuthenticatedRequest(auth.request);
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
