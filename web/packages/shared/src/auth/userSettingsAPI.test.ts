import { userSettingsAPI } from './api';
import type { Mock, Mocked } from 'vitest';

vi.mock('./tokenManager', () => ({
  __esModule: true,
  default: {
    ensureToken: vi.fn(),
    invalidateAccessToken: vi.fn(),
    clear: vi.fn(),
  },
}));

import tokenManager from './tokenManager';

describe('userSettingsAPI', () => {
  const mockFetch = vi.fn();

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    delete (global as any).fetch;
  });

  it('getSettings without keys calls correct endpoint', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ settings: { theme: 'dark', fontSize: 14 } }),
    });

    const result = await userSettingsAPI.getSettings(42);

    expect(result).toEqual({ settings: { theme: 'dark', fontSize: 14 } });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/users/42/settings',
      expect.any(Object)
    );
  });

  it('getSettings with keys appends keys query param', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ settings: { theme: 'light' } }),
    });

    await userSettingsAPI.getSettings(7, ['theme']);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('keys=theme');
  });

  it('updateSettings sends PUT with JSON body', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ settings: { theme: 'dark', fontSize: 16 } }),
    });

    const result = await userSettingsAPI.updateSettings(42, { theme: 'dark', fontSize: 16 as any });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/users/42/settings',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ theme: 'dark', fontSize: 16 }),
      })
    );
    expect(result).toEqual({ settings: { theme: 'dark', fontSize: 16 } });
  });

  it('getSettings throws on error response', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Settings not found' }),
    });

    await expect(userSettingsAPI.getSettings(99)).rejects.toThrow('Settings not found');
  });

  it('getSettings throws with generic message when error body is empty', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(userSettingsAPI.getSettings(99)).rejects.toThrow('Failed to fetch user settings');
  });

  it('updateSettings throws on error response', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Invalid setting value' }),
    });

    await expect(userSettingsAPI.updateSettings(42, { theme: null })).rejects.toThrow('Invalid setting value');
  });
});
