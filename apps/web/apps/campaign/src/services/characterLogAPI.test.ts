import { createBffClient, setAuthenticatedRequest } from '@tdn/shared';
import { characterLogAPI } from './api';

const config = { BFF_BASE: 'http://localhost:5080/bff', API_BASE: 'http://localhost:5080/bff/api' };

describe('characterLogAPI.getLog', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    setAuthenticatedRequest(createBffClient(config).request);
  });

  afterEach(() => {
    setAuthenticatedRequest(null);
    vi.unstubAllGlobals();
  });

  it('gets the log with default parameters through cookie credentials', async () => {
    const expectedResponse = {
      entries: [{ timestamp: '2026-07-22T12:00:00Z', actorId: 42, actionType: 'field_change', details: { key: 'hp', oldValue: 20, delta: -5 } }],
      total: 1,
    };
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(expectedResponse)));
    const result = await characterLogAPI.getLog(1, 100);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(`${config.API_BASE}/groups/1/characters/100/log`);
    expect(options.credentials).toBe('include');
    expect(options.headers).toBeInstanceOf(Headers);
    expect(options.headers.has('Authorization')).toBe(false);
    expect(result).toEqual(expectedResponse);
  });

  it('passes limit and offset query parameters', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [], total: 0 })));
    await characterLogAPI.getLog(1, 100, { limit: 10, offset: 20 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${config.API_BASE}/groups/1/characters/100/log?limit=10&offset=20`);
  });

  it('passes only limit when offset is absent', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [], total: 0 })));
    await characterLogAPI.getLog(1, 100, { limit: 5 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${config.API_BASE}/groups/1/characters/100/log?limit=5`);
  });

  it('passes only offset when limit is absent', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [], total: 0 })));
    await characterLogAPI.getLog(1, 100, { offset: 50 });
    expect(mockFetch.mock.calls[0][0]).toBe(`${config.API_BASE}/groups/1/characters/100/log?offset=50`);
  });

  it('returns an empty log when there are no entries', async () => {
    const emptyResponse = { entries: [], total: 0 };
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)));
    await expect(characterLogAPI.getLog(1, 100)).resolves.toEqual(emptyResponse);
  });

  it('throws when the API request fails', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(characterLogAPI.getLog(1, 100)).rejects.toThrow('Failed to fetch character action log');
  });

  it('accepts all four action types in the log response', async () => {
    const fullResponse = {
      entries: [
        { timestamp: '2026-07-22T12:00:00Z', actorId: 1, actionType: 'field_change' as const, details: { key: 'hp', oldValue: 20, delta: -5 } },
        { timestamp: '2026-07-22T12:01:00Z', actorId: 1, actionType: 'item_change' as const, details: { key: '17', oldValue: 0, delta: 5 } },
        { timestamp: '2026-07-22T12:02:00Z', actorId: 1, actionType: 'skill_change' as const, details: { key: '5', oldValue: 0, delta: 1 } },
        { timestamp: '2026-07-22T12:03:00Z', actorId: 1, actionType: 'equipment_change' as const, details: { key: '12', oldValue: 1, delta: -1 } },
      ],
      total: 4,
    };
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(fullResponse)));
    const result = await characterLogAPI.getLog(1, 100);
    expect(result.total).toBe(4);
    expect(result.entries.map(entry => entry.actionType)).toEqual(['field_change', 'item_change', 'skill_change', 'equipment_change']);
  });
});
