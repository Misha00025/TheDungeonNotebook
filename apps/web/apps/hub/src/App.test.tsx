import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';

const controls = vi.hoisted(() => ({
  auth: {
    status: 'loading' as 'loading' | 'anonymous' | 'authenticated' | 'error',
    authenticated: false,
    userId: null as number | null,
    error: null as string | null,
    config: { BFF_BASE: '/bff', API_BASE: '/bff/api', BASE_PATH: '/' },
    request: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
  },
  profile: { loading: false, error: null as string | null, profileNotFound: false },
  fetchProfile: vi.fn(),
  lastRemote: null as any,
}));

vi.mock('@tdn/shared', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => controls.auth,
  names: { title: 'TDN' },
  hubNavItems: [],
  GlobalSidebar: () => {
    const auth = controls.auth;
    const [, update] = useState(0);
    const logout = async () => { try { await auth.logout(); } catch (reason) { auth.error = reason instanceof Error ? reason.message : String(reason); update(value => value + 1); } };
    return <button onClick={() => void logout()}>sidebar logout</button>;
  },
}));

vi.mock('@tdn/shared/auth/useProfile', () => ({
  useProfile: () => {
    const [, update] = useState(0);
    return {
      ...controls.profile,
      fetchProfile: async () => { await controls.fetchProfile(); update(value => value + 1); },
    };
  },
}));

vi.mock('@tdn/shared/config', () => ({ getConfig: () => controls.auth.config }));

vi.mock('./remote/RemoteBoundary', () => ({
  default: (props: any) => {
    controls.lastRemote = props;
    return <section data-testid="remote" data-name={props.name} data-module={props.module} data-auth={props.auth.status}>
      {props.module}
      {props.onCompleted && <button onClick={() => void props.onCompleted()}>complete</button>}
    </section>;
  },
}));

vi.mock('./navigation', () => ({ hubNavItems: [] }));

const renderHub = (path = '/') => {
  window.history.replaceState({}, '', path);
  return render(<App />);
};

describe('Hub App auth and profile gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controls.auth.status = 'loading'; controls.auth.authenticated = false; controls.auth.userId = null; controls.auth.error = null;
    controls.auth.config.BASE_PATH = '/';
    controls.profile.loading = false; controls.profile.error = null; controls.profile.profileNotFound = false;
  });

  it('shows loading/error retry separately from anonymous login', async () => {
    const view = renderHub();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
    controls.auth.status = 'error'; controls.auth.error = 'offline';
    view.rerender(<App />);
    expect(screen.getByText(/offline/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Повторить'));
    expect(controls.auth.refreshSession).toHaveBeenCalled();
    controls.auth.status = 'anonymous';
    view.rerender(<App />);
    expect(screen.getByTestId('remote')).toHaveAttribute('data-name', 'login');
  });

  it('passes the complete auth contract to authenticated remotes', () => {
    controls.auth.status = 'authenticated'; controls.auth.authenticated = true; controls.auth.userId = 7;
    renderHub('/groups/4');
    expect(screen.getByTestId('remote')).toHaveAttribute('data-module', 'App');
    expect(controls.lastRemote.auth).toBe(controls.auth);
  });

  it('routes prefixed profile deep links with the configured basename', () => {
    controls.auth.status = 'authenticated'; controls.auth.authenticated = true; controls.auth.userId = 7;
    controls.auth.config.BASE_PATH = '/notebook/';
    renderHub('/notebook/profile/characters/9?tab=items#details');
    expect(screen.getByTestId('remote')).toHaveAttribute('data-name', 'profile');
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/notebook/profile/characters/9?tab=items#details');
  });

  it('offers a profile retry for profile lookup errors', () => {
    controls.auth.status = 'authenticated'; controls.auth.authenticated = true; controls.auth.userId = 7;
    controls.profile.error = 'service unavailable';
    renderHub('/');
    expect(screen.getByRole('alert').textContent).toContain('service unavailable');
    fireEvent.click(screen.getByText('Повторить'));
    expect(controls.fetchProfile).toHaveBeenCalled();
  });

  it('shows CompleteProfile without changing the current deep-link URL and resumes after completion', async () => {
    controls.auth.status = 'authenticated'; controls.auth.authenticated = true; controls.auth.userId = 7;
    controls.profile.profileNotFound = true;
    controls.fetchProfile.mockImplementation(async () => { controls.profile.profileNotFound = false; });
    renderHub('/groups/4/characters/9?tab=items#details');
    expect(screen.getByTestId('remote')).toHaveAttribute('data-module', 'CompleteProfile');
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/groups/4/characters/9?tab=items#details');
    fireEvent.click(screen.getByText('complete'));
    await waitFor(() => expect(screen.getByTestId('remote')).toHaveAttribute('data-module', 'App'));
    expect(controls.fetchProfile).toHaveBeenCalledTimes(1);
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/groups/4/characters/9?tab=items#details');
  });

  it('does not navigate after logout failure and keeps the alert visible', async () => {
    controls.auth.status = 'authenticated'; controls.auth.authenticated = true; controls.auth.userId = 7; controls.auth.error = 'Logout failed: 503';
    controls.auth.logout.mockRejectedValue(new Error('Logout failed: 503'));
    renderHub('/profile');
    fireEvent.click(screen.getByText('sidebar logout'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Logout failed: 503'));
    expect(window.location.pathname).toBe('/profile');
  });
});
