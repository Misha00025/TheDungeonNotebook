import { makeAuthenticatedRequest } from './api';
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

describe('makeAuthenticatedRequest', () => {
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

  it('adds Bearer token to request', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await makeAuthenticatedRequest('/test');
    const calledHeaders = mockFetch.mock.calls[0][1].headers;

    expect(calledHeaders['Authorization']).toBe('Bearer my-token');
  });

  it('retries after refresh on 401', async () => {
    (tokenManager.ensureToken as Mock)
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('new-token');

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    await makeAuthenticatedRequest('/test');
    expect(tokenManager.invalidateAccessToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws when refresh fails after 401', async () => {
    (tokenManager.ensureToken as Mock)
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce(null);

    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(makeAuthenticatedRequest('/test')).rejects.toThrow('Session expired');
    expect(tokenManager.clear).toHaveBeenCalled();
  });

  it('throws when ensureToken returns null initially', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue(null);

    await expect(makeAuthenticatedRequest('/test')).rejects.toThrow('Session expired');
  });

  it('sends request without Content-Type when contentType is null', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await makeAuthenticatedRequest('/upload', { method: 'POST' }, null);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('includes additional headers from options', async () => {
    (tokenManager.ensureToken as Mock).mockResolvedValue('token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await makeAuthenticatedRequest('/test', {
      headers: { 'X-Custom': 'value' },
    });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer token');
    expect(headers['X-Custom']).toBe('value');
  });
});
