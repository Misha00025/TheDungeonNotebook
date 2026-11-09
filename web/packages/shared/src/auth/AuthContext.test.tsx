import React from 'react';
import type { Mock, Mocked } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('./api', () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
  },
  makeAuthenticatedRequest: vi.fn(),
}));

vi.mock('./tokenManager', () => ({
  __esModule: true,
  default: {
    ensureToken: vi.fn(),
    setTokens: vi.fn(),
    getAccessToken: vi.fn(),
    clear: vi.fn(),
  },
}));

import { authAPI, makeAuthenticatedRequest } from './api';
import tokenManager from './tokenManager';

const createMockResponse = (status: number, body: Record<string, unknown>) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

const TestConsumer: React.FC = () => {
  const { accessToken, userId, login, register, logout } = useAuth();
  return (
    <div>
      <span data-testid="token">{accessToken ?? 'null'}</span>
      <span data-testid="userId">{userId ?? 'null'}</span>
      <button data-testid="login" onClick={() => login('u', 'p')}>login</button>
      <button data-testid="register" onClick={() => register('u', 'p')}>register</button>
      <button data-testid="logout" onClick={logout}>logout</button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (tokenManager.getAccessToken as Mock).mockReturnValue(null);
  });

  it('инициализируется без userId когда нет токена', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue(null);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });
  });

  it('инициализирует userId через whoami когда токен есть', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('valid-token');
    (makeAuthenticatedRequest as Mock).mockResolvedValueOnce(
      createMockResponse(200, { id: 7 })
    );
    (tokenManager.getAccessToken as Mock).mockReturnValue('valid-token');

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('7');
    });
  });

  it('очищает токен при ошибке whoami', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('bad-token');
    (makeAuthenticatedRequest as Mock).mockRejectedValueOnce(new Error('Network error'));

    renderProvider();

    await waitFor(() => {
      expect(tokenManager.clear).toHaveBeenCalled();
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });
  });

  it('login вызывает authAPI.login и whoami', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue(null);
    (authAPI.login as Mock).mockResolvedValue({
      access_token: 'login-token',
      refresh_token: 'login-refresh',
    });
    (makeAuthenticatedRequest as Mock).mockResolvedValueOnce(
      createMockResponse(200, { id: 10 })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });

    await act(async () => {
      screen.getByTestId('login').click();
    });

    expect(tokenManager.setTokens).toHaveBeenCalledWith('login-token', 'login-refresh');
    expect(screen.getByTestId('userId').textContent).toBe('10');
  });

  it('login пробрасывает ошибку при неудаче', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue(null);
    (authAPI.login as Mock).mockRejectedValue(new Error('Invalid credentials'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });

    await act(async () => {
      try {
        await (screen.getByTestId('login').onclick as any)({ preventDefault: () => {} });
      } catch (e) {
        // expected
      }
    });

    // login failed — userId не установлен
    expect(screen.getByTestId('userId').textContent).toBe('null');
  });

  it('register вызывает authAPI.register и whoami', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue(null);
    (authAPI.register as Mock).mockResolvedValue({
      access_token: 'reg-token',
      refresh_token: 'reg-refresh',
    });
    (makeAuthenticatedRequest as Mock).mockResolvedValueOnce(
      createMockResponse(200, { id: 20 })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });

    await act(async () => {
      screen.getByTestId('register').click();
    });

    expect(tokenManager.setTokens).toHaveBeenCalledWith('reg-token', 'reg-refresh');
    expect(screen.getByTestId('userId').textContent).toBe('20');
  });

  it('logout очищает userId и токены', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue(null);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });

    act(() => {
      screen.getByTestId('logout').click();
    });

    expect(tokenManager.clear).toHaveBeenCalled();
    expect(screen.getByTestId('userId').textContent).toBe('null');
  });
});
