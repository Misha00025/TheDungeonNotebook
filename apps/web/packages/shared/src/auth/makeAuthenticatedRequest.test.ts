import { makeAuthenticatedRequest, setAuthenticatedRequest } from './api';

describe('makeAuthenticatedRequest', () => {
  afterEach(() => setAuthenticatedRequest(null));

  it('delegates exact arguments to the Hub-owned handler', async () => {
    const response = new Response('ok');
    const handler = vi.fn().mockResolvedValue(response);
    setAuthenticatedRequest(handler);
    const options = { method: 'POST', body: 'data' };
    await expect(makeAuthenticatedRequest('/thing', options, null)).resolves.toBe(response);
    expect(handler).toHaveBeenCalledWith('/thing', options, null);
  });

  it('throws a useful error before Hub transport initialization', async () => {
    setAuthenticatedRequest(null);
    await expect(makeAuthenticatedRequest('/thing')).rejects.toThrow('not initialized by the Hub');
  });
});
