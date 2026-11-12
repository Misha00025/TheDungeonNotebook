import { authAPI } from './api';

describe('authAPI.login', () => {
  const mockFetch = vi.fn();

  beforeAll(() => { global.fetch = mockFetch; });
  afterAll(() => { delete (global as any).fetch; });
  beforeEach(() => { vi.clearAllMocks(); });

  it('успешный логин возвращает TokenResponse', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'a', refresh_token: 'b' }),
    });

    const result = await authAPI.login({ username: 'u', password: 'p' });
    expect(result.access_token).toBe('a');
    expect(result.refresh_token).toBe('b');
  });

  it('ошибка логина пробрасывает Error с error_description', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error_description: 'Invalid credentials' }),
    });

    await expect(authAPI.login({ username: 'u', password: 'p' })).rejects.toThrow('Invalid credentials');
  });

  it('ошибка логина без error_description кидает дефолтное сообщение', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    await expect(authAPI.login({ username: 'u', password: 'p' })).rejects.toThrow('Login failed');
  });
});

describe('authAPI.register', () => {
  const mockFetch = vi.fn();

  beforeAll(() => { global.fetch = mockFetch; });
  afterAll(() => { delete (global as any).fetch; });
  beforeEach(() => { vi.clearAllMocks(); });

  it('успешная регистрация делает login и возвращает TokenResponse', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'created' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access', refresh_token: 'refresh' }),
      });

    const result = await authAPI.register({ username: 'new', password: 'pass' });
    expect(result.access_token).toBe('access');
  });

  it('регистрация с 409 кидает "Username already exists"', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: async () => ({}),
    });

    await expect(authAPI.register({ username: 'taken', password: 'pass' })).rejects.toThrow('Username already exists');
  });

  it('ошибка регистрации кидает "Registration failed"', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({}),
    });

    await expect(authAPI.register({ username: 'bad', password: 'pass' })).rejects.toThrow('Registration failed');
  });
});
