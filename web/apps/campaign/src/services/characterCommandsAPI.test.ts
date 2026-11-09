import { characterCommandsAPI, makeAuthenticatedRequest } from './api';
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

describe('characterCommandsAPI.executeCommand', () => {
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

  it('отправляет команду на правильный endpoint с телом команды', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 1,
        name: 'Иван',
        description: '',
        fields: { hp: { name: 'Здоровье', value: 20, description: '' } },
        group: { id: 2, name: 'G', icon: null },
        templateId: 3,
      }),
    });

    const command = { type: 'UpdateField' as const, payload: { key: 'hp', field: { value: 5 } } };
    const result = await characterCommandsAPI.executeCommand(2, 7, command);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/groups/2/characters/7/commands'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fake-token' }),
        body: JSON.stringify(command),
      })
    );
    expect(result.name).toBe('Иван');
  });

  it('пробрасывает ошибку при неудачном запросе', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    await expect(characterCommandsAPI.executeCommand(2, 7, { type: 'DeleteField', payload: { key: 'hp' } }))
      .rejects.toThrow('Failed to execute character command');
  });
});
