import { joinApiUrl } from '../config';
import type { AppConfig } from '../config';

export type AuthenticatedRequest = (
  endpoint: string,
  options?: RequestInit,
  contentType?: string | null
) => Promise<Response>;

export type BffSession = {
  authenticated: boolean;
  csrfToken: string | null;
  csrfHeaderName: string | null;
};

export class BffRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(`${code} (${status})`);
  }
}

export function createBffClient(config: AppConfig, onSessionLost?: () => void) {
  let snapshot: BffSession | null = null;
  let sessionPromise: Promise<BffSession> | null = null;

  const getSession = (): Promise<BffSession> => {
    if (sessionPromise) return sessionPromise;

    const pending = fetch(joinApiUrl(config.BFF_BASE, '/session'), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async response => {
        if (response.status === 401) {
          const anonymous = {
            authenticated: false,
            csrfToken: null,
            csrfHeaderName: null,
          };
          snapshot = anonymous;
          return anonymous;
        }

        if (!response.ok) {
          throw new Error(`Session request failed: ${response.status}`);
        }

        const value = await response.json();
        if (
          !value ||
          typeof value.authenticated !== 'boolean' ||
          (value.csrfToken !== null && typeof value.csrfToken !== 'string') ||
          (value.csrfHeaderName !== null && typeof value.csrfHeaderName !== 'string')
        ) {
          throw new Error('Malformed session response');
        }

        const result: BffSession = {
          authenticated: value.authenticated,
          csrfToken: value.csrfToken,
          csrfHeaderName: value.csrfHeaderName,
        };

        if (
          result.authenticated &&
          (!result.csrfToken || !result.csrfHeaderName)
        ) {
          throw new Error('Malformed authenticated session response');
        }

        snapshot = result;
        return result;
      })
      .finally(() => {
        if (sessionPromise === pending) sessionPromise = null;
      });

    sessionPromise = pending;
    return pending;
  };

  const request: AuthenticatedRequest = async (
    endpoint,
    options = {},
    contentType = 'application/json'
  ) => {
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers);
    headers.delete('Authorization');

    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (contentType && !isForm && !headers.has('Content-Type')) {
      headers.set('Content-Type', contentType);
    } else if (isForm) {
      headers.delete('Content-Type');
    }

    const safe = ['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method);
    if (!safe) {
      const session = snapshot ?? await getSession();
      if (!session.authenticated) throw new Error('Session required');
      if (!session.csrfToken || !session.csrfHeaderName) {
        throw new Error('Authenticated session has no CSRF credentials');
      }
      headers.set(session.csrfHeaderName, session.csrfToken);
    }

    const response = await fetch(joinApiUrl(config.API_BASE, endpoint), {
      ...options,
      method,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      try {
        if (!(await getSession()).authenticated) onSessionLost?.();
      } catch {
      }
    } else if (response.status === 400) {
      try {
        if ((await response.clone().json()).code === 'csrf_invalid') snapshot = null;
      } catch {
      }
    }

    return response;
  };

  const logout = async (): Promise<void> => {
    const session = snapshot ?? await getSession();
    if (!session.authenticated) throw new Error('Session required');
    if (!session.csrfToken || !session.csrfHeaderName) {
      throw new Error('Authenticated session has no CSRF credentials');
    }

    const headers = new Headers();
    headers.set(session.csrfHeaderName, session.csrfToken);

    let response: Response;
    try {
      response = await fetch(joinApiUrl(config.BFF_BASE, '/logout'), {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch (error) {
      snapshot = null;
      throw error;
    }

    if (response.status === 200) {
      let logoutUrl: unknown;
      try {
        logoutUrl = (await response.json())?.logoutUrl;
      } catch {
        snapshot = null;
        throw new Error('Malformed logout response');
      }

      if (typeof logoutUrl !== 'string' || !logoutUrl.trim()) {
        snapshot = null;
        throw new Error('Malformed logout response');
      }

      let target: URL;
      try {
        target = new URL(logoutUrl);
      } catch {
        snapshot = null;
        throw new Error('Malformed logout URL');
      }

      let bffOrigin: string;
      try {
        bffOrigin = new URL(config.BFF_BASE, window.location.origin).origin;
      } catch {
        snapshot = null;
        throw new Error('Malformed BFF base URL');
      }

      if (
        (target.protocol !== 'http:' && target.protocol !== 'https:') ||
        target.origin !== bffOrigin ||
        target.username !== '' ||
        target.password !== ''
      ) {
        snapshot = null;
        throw new Error('Invalid logout URL');
      }

      snapshot = null;
      window.location.assign(target.toString());
      onSessionLost?.();
      return;
    }

    if (response.status === 401) {
      try {
        await getSession();
      } catch {
      }
      throw new Error('Logout failed: 401');
    }

    if (response.status === 400) {
      let code: string | undefined;
      try {
        code = (await response.clone().json()).code;
      } catch {
      }

      if (code === 'csrf_invalid') {
        snapshot = null;
        throw new BffRequestError('csrf_invalid', 400);
      }
    }

    if (response.status >= 500) snapshot = null;

    throw new Error(`Logout failed: ${response.status}`);
  };

  const getLoginUrl = (localReturnPath = '/'): string => {
    const url = new URL(joinApiUrl(config.BFF_BASE, '/login'), window.location.origin);
    url.searchParams.set('returnUrl', localReturnPath);
    return url.toString();
  };

  return { request, getSession, logout, getLoginUrl };
}
