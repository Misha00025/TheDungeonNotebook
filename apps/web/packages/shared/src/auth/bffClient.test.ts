import { createBffClient } from './bffClient';

const config = { BFF_BASE: 'http://localhost:5080/bff', API_BASE: 'http://localhost:5080/bff/api' };
const authSession = { authenticated: true, csrfToken: 'csrf-value', csrfHeaderName: 'X-Custom-CSRF' };
const mockFetch = () => fetch as unknown as ReturnType<typeof vi.fn>;

describe('createBffClient', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('coalesces session GETs and validates/stores only the session contract', async () => {
    const gate = Promise.resolve(new Response(JSON.stringify(authSession)));
    mockFetch().mockReturnValue(gate);
    const client = createBffClient(config);
    await Promise.all([client.getSession(), client.getSession()]);
    expect(mockFetch()).toHaveBeenCalledTimes(1);
    expect(mockFetch().mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' });
  });

  it('uses cookies and dynamic CSRF header, strips Authorization and respects Headers/tuple inputs', async () => {
    mockFetch()
      .mockResolvedValueOnce(new Response(JSON.stringify(authSession)))
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('{}'));
    const client = createBffClient(config);
    await client.getSession();
    await client.request('/write', { method: 'POST', headers: [['Authorization', 'Bearer no'], ['X-Test', 'yes']] as [string, string][] });
    const [url, options] = mockFetch().mock.calls[1];
    expect(url).toBe(`${config.API_BASE}/write`);
    expect(options.credentials).toBe('include');
    expect(options.headers.get('X-Custom-CSRF')).toBe('csrf-value');
    expect(options.headers.get('X-Test')).toBe('yes');
    expect(options.headers.has('Authorization')).toBe(false);
    await client.request('/read', { headers: new Headers({ 'X-Read': 'ok' }) });
    expect(mockFetch().mock.calls[2][1].headers.get('X-Read')).toBe('ok');
  });

  it('sets JSON content type only when selected and omits multipart content type', async () => {
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValue(new Response('{}'));
    const client = createBffClient(config);
    await client.getSession();
    await client.request('/json', { method: 'POST' });
    expect(mockFetch().mock.calls[1][1].headers.get('Content-Type')).toBe('application/json');
    await client.request('/raw', { method: 'POST' }, null);
    expect(mockFetch().mock.calls[2][1].headers.has('Content-Type')).toBe(false);
    const form = new FormData(); form.append('file', 'data');
    await client.request('/form', { method: 'POST', body: form });
    expect(mockFetch().mock.calls[3][1].headers.has('Content-Type')).toBe(false);
  });

  it('treats anonymous and malformed or failed sessions distinctly', async () => {
    mockFetch().mockResolvedValueOnce(new Response('', { status: 401 }));
    const client = createBffClient(config);
    expect((await client.getSession()).authenticated).toBe(false);
    await expect(client.request('/write', { method: 'POST' })).rejects.toThrow('Session required');
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true, csrfToken: null, csrfHeaderName: null })));
    await expect(client.getSession()).rejects.toThrow('Malformed authenticated session');
    mockFetch().mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(client.getSession()).rejects.toThrow('503');
  });

  it('uses CSRF for unsafe methods and does not fetch it for safe methods', async () => {
    mockFetch().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValue(new Response('{}'));
    const client = createBffClient(config);
    await client.request('/get');
    expect(mockFetch()).toHaveBeenCalledTimes(1);
    await client.request('/post', { method: 'POST' });
    expect(mockFetch().mock.calls[2][1].headers.get('X-Custom-CSRF')).toBe('csrf-value');
  });

  it('confirms 401 loss, preserves original response on failed recheck, and never replays POST', async () => {
    const lost = vi.fn();
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(new Response('', { status: 401 }));
    const client = createBffClient(config, lost);
    await client.getSession(); const response = await client.request('/write', { method: 'POST' });
    expect(response.status).toBe(401); expect(lost).toHaveBeenCalledTimes(1); expect(mockFetch()).toHaveBeenCalledTimes(3);
    mockFetch().mockReset();
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(new Response('', { status: 503 }));
    const keep = vi.fn(); const another = createBffClient(config, keep);
    await another.getSession(); const original = await another.request('/get');
    expect(original.status).toBe(401); expect(keep).not.toHaveBeenCalled(); expect(mockFetch()).toHaveBeenCalledTimes(3);
  });

  it('clears CSRF after csrf_invalid, preserves body and fetches fresh session on next explicit operation', async () => {
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'csrf_invalid' }), { status: 400 })).mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response('{}'));
    const client = createBffClient(config); await client.getSession();
    const response = await client.request('/write', { method: 'POST' });
    expect(await response.json()).toEqual({ code: 'csrf_invalid' });
    await client.request('/next', { method: 'POST' });
    expect(mockFetch()).toHaveBeenCalledTimes(4);
    expect(mockFetch().mock.calls[3][1].headers.get('X-Custom-CSRF')).toBe('csrf-value');
  });

  it('logout requires CSRF, identifies csrf_invalid and handles 204/401 accurately', async () => {
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'csrf_invalid' }), { status: 400 }));
    const client = createBffClient(config); await client.getSession();
    await expect(client.logout()).rejects.toMatchObject({ code: 'csrf_invalid', status: 400 });
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response('{}'));
    await client.request('/after-logout-error', { method: 'POST' });
    expect(mockFetch()).toHaveBeenCalledTimes(4);
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const lost = vi.fn(); const logoutClient = createBffClient(config, lost); await logoutClient.getSession(); await logoutClient.logout();
    expect(lost).toHaveBeenCalledTimes(1);
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(new Response('', { status: 401 }));
    const alreadyOut = createBffClient(config); await alreadyOut.getSession(); await alreadyOut.logout();
  });

  it('surfaces logout failures without declaring a session lost', async () => {
    mockFetch().mockResolvedValueOnce(new Response(JSON.stringify(authSession))).mockResolvedValueOnce(new Response('', { status: 503 }));
    const lost = vi.fn(); const client = createBffClient(config, lost); await client.getSession();
    await expect(client.logout()).rejects.toThrow('503'); expect(lost).not.toHaveBeenCalled();
  });

  it('encodes the local return path including query and fragment', () => {
    const client = createBffClient(config);
    const login = new URL(client.getLoginUrl('/hub/page?q=1#part'));
    expect(login.pathname).toBe('/bff/login'); expect(login.searchParams.get('returnUrl')).toBe('/hub/page?q=1#part');
  });
});
