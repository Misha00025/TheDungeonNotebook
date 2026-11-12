import { renderHook, act, waitFor } from '@testing-library/react';
import type { Mock, Mocked } from 'vitest';
import { useProfile } from './useProfile';

vi.mock('./api', () => ({
  makeAuthenticatedRequest: vi.fn(),
}));

import { makeAuthenticatedRequest } from './api';

const createMockResponse = (status: number, body: Record<string, unknown>) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('загружает профиль через whoami + /users/:id', async () => {
    (makeAuthenticatedRequest as Mock)
      .mockResolvedValueOnce(createMockResponse(200, { id: 5 }))
      .mockResolvedValueOnce(createMockResponse(200, {
        id: 5, nickname: 'test', visibleName: 'Test', imageLink: null,
      }));

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.profileNotFound).toBe(false);
    expect(result.current.profile).toEqual(
      expect.objectContaining({ nickname: 'test', visibleName: 'Test' })
    );
  });

  it('устанавливает profileNotFound при 404 на /users/:id', async () => {
    (makeAuthenticatedRequest as Mock)
      .mockResolvedValueOnce(createMockResponse(200, { id: 5 }))
      .mockResolvedValueOnce(createMockResponse(404, {}));

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.profileNotFound).toBe(true);
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('устанавливает ошибку при 401 от whoami', async () => {
    (makeAuthenticatedRequest as Mock).mockResolvedValueOnce(
      createMockResponse(401, {})
    );

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.error).toContain('Session expired');
    expect(result.current.profile).toBeNull();
  });

  it('устанавливает ошибку при 401 от /users/:id', async () => {
    (makeAuthenticatedRequest as Mock)
      .mockResolvedValueOnce(createMockResponse(200, { id: 5 }))
      .mockResolvedValueOnce(createMockResponse(401, {}));

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.error).toContain('Session expired');
    expect(result.current.profile).toBeNull();
  });

  it('устанавливает ошибку при не-ok ответе от whoami', async () => {
    (makeAuthenticatedRequest as Mock).mockResolvedValueOnce(
      createMockResponse(500, {})
    );

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.error).toBe('Failed to fetch user info');
  });

  it('вызывает fetchProfile на mount при fetchOnMount: true', async () => {
    (makeAuthenticatedRequest as Mock)
      .mockResolvedValueOnce(createMockResponse(200, { id: 1 }))
      .mockResolvedValueOnce(createMockResponse(200, {
        id: 1, nickname: 'auto', visibleName: 'Auto', imageLink: null,
      }));

    const { result } = renderHook(() => useProfile(true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(makeAuthenticatedRequest).toHaveBeenCalledTimes(2);
    expect(result.current.profile?.nickname).toBe('auto');
  });

  it('НЕ вызывает fetchProfile на mount при fetchOnMount: false', () => {
    renderHook(() => useProfile(false));
    expect(makeAuthenticatedRequest).not.toHaveBeenCalled();
  });

  it('обрабатывает ошибку when whoami ok but profile fetch fails с throw', async () => {
    (makeAuthenticatedRequest as Mock)
      .mockResolvedValueOnce(createMockResponse(200, { id: 5 }))
      .mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.loading).toBe(false);
  });
});
