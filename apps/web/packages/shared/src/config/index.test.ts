import { getApiBase, getConfig, loadConfig, setConfig } from './index';

describe('runtime config', () => {
  let originalUrl: string;
  let originalBase: HTMLBaseElement | null;
  let originalBaseHref: string | null;

  beforeEach(() => {
    originalUrl = window.location.href;
    originalBase = document.querySelector('base');
    originalBaseHref = originalBase?.getAttribute('href') ?? null;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', originalUrl);
    const currentBase = document.querySelector('base');
    if (originalBase) {
      if (!originalBase.isConnected) document.head.appendChild(originalBase);
      if (originalBaseHref === null) originalBase.removeAttribute('href');
      else originalBase.setAttribute('href', originalBaseHref);
    } else {
      currentBase?.remove();
    }
  });

  it('uses the BFF defaults, never the legacy gateway URL', () => {
    setConfig({ BFF_BASE: 'http://localhost:5080/bff', API_BASE: 'http://localhost:5080/bff/api' });
    expect(getConfig()).toEqual({ BFF_BASE: 'http://localhost:5080/bff', API_BASE: 'http://localhost:5080/bff/api' });
    expect(getApiBase()).not.toContain(':5000');
  });

  it('normalizes configured paths and derives API_BASE from BFF_BASE', () => {
    setConfig({ BFF_BASE: '/bff/', API_BASE: undefined as unknown as string });
    expect(getConfig()).toEqual({ BFF_BASE: '/bff', API_BASE: '/bff/api' });
    setConfig({ BFF_BASE: '/', API_BASE: '/' });
    expect(getConfig()).toEqual({ BFF_BASE: '/', API_BASE: '/' });
  });

  it('loads config relative to document.baseURI without caching', async () => {
    window.history.replaceState({}, '', '/notebook/groups/4?tab=x');
    let base = document.querySelector('base');
    if (!base) {
      base = document.createElement('base');
      document.head.prepend(base);
    }
    base.href = '/notebook/';
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ BFF_BASE: '/service/bff/' })));
    await loadConfig();
    const [request, options] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(request as string | URL).pathname).toBe('/notebook/config.json');
    expect(options).toEqual({ cache: 'no-store' });
    expect(getConfig()).toEqual({ BFF_BASE: '/service/bff', API_BASE: '/service/bff/api' });
  });

  it('preserves optional base path and remote entries while omitting unknown fields', () => {
    setConfig({
      BFF_BASE: '/bff',
      API_BASE: '/bff/api',
      BASE_PATH: '/notebook',
      REMOTES: { campaign: 'remotes/campaign.js', profile: '/profile.js', login: 'login.js', unused: 'ignored' } as never,
    });
    expect(getConfig()).toEqual({
      BFF_BASE: '/bff',
      API_BASE: '/bff/api',
      BASE_PATH: '/notebook/',
      REMOTES: { campaign: 'remotes/campaign.js', profile: '/profile.js', login: 'login.js' },
    });
  });

  it.each([
    ['protocol-relative base path', { BASE_PATH: '//example.test/' }],
    ['query base path', { BASE_PATH: '/notebook/?x=1' }],
    ['hash base path', { BASE_PATH: '/notebook/#x' }],
    ['non-path base path', { BASE_PATH: 'https://example.test/' }],
    ['non-object remotes', { REMOTES: [] }],
    ['missing remote entry', { REMOTES: { campaign: '/campaign', profile: '/profile' } }],
    ['empty remote entry', { REMOTES: { campaign: '/campaign', profile: '/profile', login: ' ' } }],
  ])('rejects malformed %s', (_label, fields) => {
    expect(() => setConfig({ BFF_BASE: '/bff', API_BASE: '/bff/api', ...fields } as never)).toThrow('Invalid runtime config');
  });

  it('uses defaults for missing config and propagates HTTP or JSON failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));
    await loadConfig();
    expect(getConfig().BFF_BASE).toBe('http://localhost:5080/bff');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(loadConfig()).rejects.toThrow('500');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{'));
    await expect(loadConfig()).rejects.toThrow();
  });
});
