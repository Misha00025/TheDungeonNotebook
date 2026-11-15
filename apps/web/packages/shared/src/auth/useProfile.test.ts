import { renderHook, act, waitFor } from '@testing-library/react';
import { useProfile } from './useProfile';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./api', () => ({ makeAuthenticatedRequest: vi.fn() }));

import { useAuth } from './AuthContext';
import { makeAuthenticatedRequest } from './api';

const authState = { authenticated: true, userId: 5 };
const profile = { id: 5, nickname: 'test', visibleName: 'Test', imageLink: null };

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ ...authState } as ReturnType<typeof useAuth>);
  });

  it('loads only the current user profile on mount', async () => {
    vi.mocked(makeAuthenticatedRequest).mockResolvedValueOnce(new Response(JSON.stringify(profile)));
    const { result } = renderHook(() => useProfile(true));
    await waitFor(() => expect(result.current.profile?.nickname).toBe('test'));
    expect(makeAuthenticatedRequest).toHaveBeenCalledTimes(1);
    expect(makeAuthenticatedRequest).toHaveBeenCalledWith('/users/5');
  });

  it('distinguishes missing profile from server failure', async () => {
    vi.mocked(makeAuthenticatedRequest).mockResolvedValueOnce(new Response('', { status: 404 }));
    const { result, rerender } = renderHook(() => useProfile(true));
    await waitFor(() => expect(result.current.profileNotFound).toBe(true));
    vi.mocked(makeAuthenticatedRequest).mockResolvedValueOnce(new Response('', { status: 503 }));
    await act(async () => { await result.current.fetchProfile(); });
    expect(result.current.profileNotFound).toBe(false);
    expect(result.current.error).toContain('503');
    expect(makeAuthenticatedRequest).not.toHaveBeenCalledWith('/whoami');
    rerender();
  });

  it('clears previous user data when identity changes or auth is lost', async () => {
    vi.mocked(makeAuthenticatedRequest).mockResolvedValueOnce(new Response(JSON.stringify(profile))).mockResolvedValueOnce(new Response(JSON.stringify({ ...profile, id: 8, nickname: 'other' })));
    const { result, rerender } = renderHook(() => useProfile(true));
    await waitFor(() => expect(result.current.profile?.id).toBe(5));
    vi.mocked(useAuth).mockReturnValue({ authenticated: true, userId: 8 } as ReturnType<typeof useAuth>);
    rerender();
    expect(result.current.profile).toBeNull();
    await waitFor(() => expect(result.current.profile?.id).toBe(8));
    vi.mocked(useAuth).mockReturnValue({ authenticated: false, userId: null } as ReturnType<typeof useAuth>);
    rerender();
    expect(result.current.profile).toBeNull();
    expect(result.current.profileNotFound).toBe(false);
  });

  it('starts loading for fetchOnMount and performs no work when anonymous', async () => {
    vi.mocked(useAuth).mockReturnValue({ authenticated: false, userId: null } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useProfile(true));
    expect(result.current.loading).toBe(false);
    expect(makeAuthenticatedRequest).not.toHaveBeenCalled();
  });
});
