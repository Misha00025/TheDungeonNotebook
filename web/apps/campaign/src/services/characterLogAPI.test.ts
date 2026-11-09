import { characterLogAPI, makeAuthenticatedRequest } from './api';
import type { Mock, Mocked } from 'vitest';

vi.mock('@tdn/shared/auth/tokenManager', () => ({
  __esModule: true,
  default: {
    ensureToken: vi.fn(),
    invalidateAccessToken: vi.fn(),
    clear: vi.fn(),
  },
}));

import tokenManager from '@tdn/shared/auth/tokenManager';

describe('characterLogAPI.getLog', () => {
  const mockFetch = vi.fn();

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (tokenManager.ensureToken as Mock).mockResolvedValue('fake-token');
  });

  afterAll(() => {
    delete (global as any).fetch;
  });

  it('успешно получает лог с дефолтными параметрами', async () => {
    const expectedResponse = {
      entries: [
        {
          timestamp: '2026-07-22T12:00:00Z',
          actorId: 42,
          actionType: 'field_change',
          details: { key: 'hp', oldValue: 20, delta: -5 },
        },
      ],
      total: 1,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => expectedResponse,
    });

    const result = await characterLogAPI.getLog(1, 100);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/groups/1/characters/100/log'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fake-token' }) })
    );
    expect(result).toEqual(expectedResponse);
  });

  it('передаёт query-параметры limit и offset', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [], total: 0 }),
    });

    await characterLogAPI.getLog(1, 100, { limit: 10, offset: 20 });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/groups/1/characters/100/log?limit=10&offset=20');
  });

  it('передаёт только limit если offset не указан', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [], total: 0 }),
    });

    await characterLogAPI.getLog(1, 100, { limit: 5 });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/groups/1/characters/100/log?limit=5');
  });

  it('передаёт только offset если limit не указан', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [], total: 0 }),
    });

    await characterLogAPI.getLog(1, 100, { offset: 50 });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/groups/1/characters/100/log?offset=50');
  });

  it('возвращает пустой лог когда записей нет', async () => {
    const emptyResponse = { entries: [], total: 0 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyResponse,
    });

    const result = await characterLogAPI.getLog(1, 100);
    expect(result).toEqual(emptyResponse);
  });

  it('пробрасывает ошибку при неудачном запросе', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    await expect(characterLogAPI.getLog(1, 100)).rejects.toThrow('Failed to fetch character action log');
  });

  it('поддерживает все 4 типа actionType в ответе', async () => {
    const fullResponse = {
      entries: [
        { timestamp: '2026-07-22T12:00:00Z', actorId: 1, actionType: 'field_change' as const, details: { key: 'hp', oldValue: 20, delta: -5 } },
        { timestamp: '2026-07-22T12:01:00Z', actorId: 1, actionType: 'item_change' as const, details: { key: '17', oldValue: 0, delta: 5 } },
        { timestamp: '2026-07-22T12:02:00Z', actorId: 1, actionType: 'skill_change' as const, details: { key: '5', oldValue: 0, delta: 1 } },
        { timestamp: '2026-07-22T12:03:00Z', actorId: 1, actionType: 'equipment_change' as const, details: { key: '12', oldValue: 1, delta: -1 } },
      ],
      total: 4,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fullResponse,
    });

    const result = await characterLogAPI.getLog(1, 100);
    expect(result.total).toBe(4);
    expect(result.entries[0].actionType).toBe('field_change');
    expect(result.entries[1].actionType).toBe('item_change');
    expect(result.entries[2].actionType).toBe('skill_change');
    expect(result.entries[3].actionType).toBe('equipment_change');
  });
});
