import { createBffClient, setAuthenticatedRequest } from '@tdn/shared';
import { characterCommandsAPI } from './api';

const config = { BFF_BASE: 'http://localhost:5080/bff', API_BASE: 'http://localhost:5080/bff/api' };
const session = { authenticated: true, csrfToken: 'csrf-test', csrfHeaderName: 'X-CSRF-CUSTOM' };

describe('characterCommandsAPI.executeCommand', () => {
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

  it('sends the command to the correct endpoint with cookie credentials and dynamic CSRF', async () => {
    const character = {
      id: 1,
      name: 'Иван',
      description: '',
      fields: { hp: { name: 'Здоровье', value: 20, description: '' } },
      group: { id: 2, name: 'G', icon: null },
      templateId: 3,
    };
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(session))).mockResolvedValueOnce(new Response(JSON.stringify(character)));
    const command = { type: 'UpdateField' as const, payload: { key: 'hp', field: { value: 5 } } };
    const result = await characterCommandsAPI.executeCommand(2, 7, command);
    const [url, options] = mockFetch.mock.calls[1];
    expect(url).toBe(`${config.API_BASE}/groups/2/characters/7/commands`);
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify(command));
    expect(options.credentials).toBe('include');
    expect(options.headers).toBeInstanceOf(Headers);
    expect(options.headers.get('Content-Type')).toBe('application/json');
    expect(options.headers.get('X-CSRF-CUSTOM')).toBe('csrf-test');
    expect(options.headers.has('Authorization')).toBe(false);
    expect(result).toEqual(character);
  });

  it('throws when the command request fails', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(session))).mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(characterCommandsAPI.executeCommand(2, 7, { type: 'DeleteField', payload: { key: 'hp' } }))
      .rejects.toThrow('Failed to execute character command');
  });
});
