import React, { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, RemoteAuthProvider, useAuth } from './AuthContext';
import { getConfig, setConfig } from '../config';
import { makeAuthenticatedRequest, setAuthenticatedRequest } from './api';
import type { AuthContextType } from './AuthContext';

const config = { BFF_BASE: 'http://localhost:5080/bff', API_BASE: 'http://localhost:5080/bff/api' };
const session = { authenticated: true, csrfToken: 'csrf', csrfHeaderName: 'X-CSRF' };
const Consumer = () => { const auth = useAuth(); return <div><span data-testid="status">{auth.status}</span><span data-testid="user">{auth.userId}</span><span data-testid="error">{auth.error}</span><button onClick={() => void auth.refreshSession()}>refresh</button><button onClick={() => void auth.logout().catch(() => undefined)}>logout</button></div>; };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

describe('AuthProvider', () => {
  beforeEach(() => { setConfig(config); localStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => {
    setAuthenticatedRequest(null);
    setConfig(config);
    vi.unstubAllGlobals();
  });

  it('renders loading then anonymous for a 401 session', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 401 }));
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(screen.getByTestId('status').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });

  it('loads authenticated user from whoami', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(session))).mockResolvedValueOnce(new Response(JSON.stringify({ id: 12, type: 'user' })));
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('12'));
  });

  it('shows errors and can retry session initialization', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('', { status: 401 }));
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    act(() => screen.getByText('refresh').click());
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });

  it('cleans legacy auth keys without changing preferences or writing user id', async () => {
    localStorage.setItem('refreshToken', 'old'); localStorage.setItem('userId', '77'); localStorage.setItem('theme', 'dark');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 401 }));
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(localStorage.getItem('refreshToken')).toBeNull(); expect(localStorage.getItem('userId')).toBeNull(); expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('keeps the previous auth status and user after logout failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(session))).mockResolvedValueOnce(new Response(JSON.stringify({ id: 5, type: 'user' }))).mockResolvedValueOnce(new Response('', { status: 503 }));
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('5'));
    await act(async () => { screen.getByText('logout').click(); });
    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('user').textContent).toBe('5');
    expect(screen.getByTestId('error').textContent).toContain('503');
  });

  it('clears authenticated state and assigns the BFF logout continuation after successful logout', async () => {
    const assign = vi.fn();
    const originalWindow = window;
    const windowStub = new Proxy(originalWindow, {
      get(target, property) {
        if (property === 'location') return { origin: 'https://web.example', assign };
        return Reflect.get(target, property, target);
      },
    });
    vi.stubGlobal('window', windowStub);
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(session)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 5, type: 'user' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ logoutUrl: 'http://localhost:5080/bff/logout/continue?request=opaque' }), { status: 200 }));
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('5'));

    await act(async () => { screen.getByText('logout').click(); });

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('http://localhost:5080/bff/logout/continue?request=opaque');
    expect(screen.getByTestId('status').textContent).toBe('anonymous');
    expect(screen.getByTestId('user').textContent).toBe('');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('coalesces StrictMode bootstrap and finishes after the repeated effect setup', async () => {
    const pending = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(new Response(JSON.stringify({ id: 8, type: 'user' })));
    render(<StrictMode><AuthProvider><Consumer /></AuthProvider></StrictMode>);
    await act(async () => pending.resolve(new Response(JSON.stringify(session))));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('8'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('RemoteAuthProvider', () => {
  beforeEach(() => {
    setConfig(config);
    setAuthenticatedRequest(null);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    setAuthenticatedRequest(null);
    setConfig(config);
    vi.unstubAllGlobals();
  });

  it('installs passed request and config without fetching session', async () => {
    const request = vi.fn().mockResolvedValue(new Response('{}'));
    const auth: AuthContextType = { status: 'authenticated', authenticated: true, userId: 2, error: null, config, request, login: vi.fn(), logout: vi.fn(), refreshSession: vi.fn() };
    render(<RemoteAuthProvider auth={auth}><Consumer /></RemoteAuthProvider>);
    expect(getConfig()).toEqual(config);
    await makeAuthenticatedRequest('/x');
    expect(request).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it('throws when Hub auth is missing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<RemoteAuthProvider auth={undefined as unknown as AuthContextType}><Consumer /></RemoteAuthProvider>)).toThrow('RemoteAuthProvider requires Hub auth');
    spy.mockRestore();
  });
});
