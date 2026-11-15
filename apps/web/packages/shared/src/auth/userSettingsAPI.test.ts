import { userSettingsAPI, setAuthenticatedRequest } from './api';

describe('userSettingsAPI', () => {
  const handler = vi.fn();
  beforeEach(() => { handler.mockReset(); setAuthenticatedRequest(handler); });
  afterEach(() => setAuthenticatedRequest(null));

  it('gets settings and adds the optional keys query', async () => {
    handler.mockResolvedValue(new Response(JSON.stringify({ settings: { theme: 'dark' } })));
    await userSettingsAPI.getSettings(42, ['theme', 'density']);
    expect(handler).toHaveBeenCalledWith('/users/42/settings?keys=theme%2Cdensity', {}, 'application/json');
  });

  it('updates settings with a JSON PUT', async () => {
    handler.mockResolvedValue(new Response(JSON.stringify({ settings: { theme: 'dark' } })));
    await userSettingsAPI.updateSettings(42, { theme: 'dark' });
    expect(handler).toHaveBeenCalledWith('/users/42/settings', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ theme: 'dark' }) }), 'application/json');
  });

  it('reports API errors from response details', async () => {
    handler.mockResolvedValue(new Response(JSON.stringify({ detail: 'Settings not found' }), { status: 404 }));
    await expect(userSettingsAPI.getSettings(42)).rejects.toThrow('Settings not found');
    handler.mockResolvedValue(new Response(JSON.stringify({ detail: 'Invalid setting' }), { status: 422 }));
    await expect(userSettingsAPI.updateSettings(42, { theme: null })).rejects.toThrow('Invalid setting');
  });
});
