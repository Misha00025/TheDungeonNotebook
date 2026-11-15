import { getApiBase, getConfig, loadConfig, setConfig } from './index';

describe('runtime config', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

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

  it('loads config relative to the configured base URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ BFF_BASE: '/service/bff/' })));
    await loadConfig();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/config\.json$/));
    expect(getConfig()).toEqual({ BFF_BASE: '/service/bff', API_BASE: '/service/bff/api' });
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
