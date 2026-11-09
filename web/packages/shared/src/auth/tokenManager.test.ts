import tokenManager from './tokenManager';

describe('tokenManager', () => {
  const mockFetch = vi.fn();

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    tokenManager.clear();
  });

  afterAll(() => {
    delete (global as any).fetch;
  });

  it('starts with no access token', () => {
    expect(tokenManager.getAccessToken()).toBeNull();
  });

  it('setTokens stores access in memory and refresh in localStorage', () => {
    tokenManager.setTokens('abc', 'refresh123');
    expect(tokenManager.getAccessToken()).toBe('abc');
    expect(localStorage.getItem('refreshToken')).toBe('refresh123');
  });

  it('ensureToken returns existing access token from memory', async () => {
    tokenManager.setTokens('existing', 'r');
    const token = await tokenManager.ensureToken();
    expect(token).toBe('existing');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ensureToken refreshes token when access is null but refresh exists', async () => {
    localStorage.setItem('refreshToken', 'old-refresh');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh' }),
    });

    const token = await tokenManager.ensureToken();
    expect(token).toBe('new-access');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
  });

  it('ensureToken returns null when no refresh token exists', async () => {
    const token = await tokenManager.ensureToken();
    expect(token).toBeNull();
  });

  it('ensureToken deduplicates parallel refresh calls', async () => {
    localStorage.setItem('refreshToken', 'r');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'deduped', refresh_token: 'r2' }),
    });

    const [t1, t2] = await Promise.all([
      tokenManager.ensureToken(),
      tokenManager.ensureToken(),
    ]);

    expect(t1).toBe('deduped');
    expect(t2).toBe('deduped');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('invalidateAccessToken clears memory but keeps refresh token', () => {
    tokenManager.setTokens('abc', 'refresh123');
    tokenManager.invalidateAccessToken();
    expect(tokenManager.getAccessToken()).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBe('refresh123');
  });

  it('clear removes everything', () => {
    tokenManager.setTokens('abc', 'refresh123');
    tokenManager.clear();
    expect(tokenManager.getAccessToken()).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('ensureToken handles fetch failure gracefully', async () => {
    localStorage.setItem('refreshToken', 'bad-refresh');
    mockFetch.mockResolvedValueOnce({ ok: false });

    const token = await tokenManager.ensureToken();
    expect(token).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
