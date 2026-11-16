import { beforeEach, describe, expect, it, vi } from 'vitest';

const federation = vi.hoisted(() => ({
  setRemote: vi.fn(),
  getRemote: vi.fn(),
  unwrapDefault: vi.fn(),
}));

vi.mock('virtual:__federation__', () => ({
  __federation_method_setRemote: federation.setRemote,
  __federation_method_getRemote: federation.getRemote,
  __federation_method_unwrapDefault: federation.unwrapDefault,
}));

const entries = {
  campaign: 'remotes/campaign/assets/remoteEntry.js',
  profile: '/remotes/profile/assets/remoteEntry.js',
  login: 'https://cdn.example.test/login/remoteEntry.js',
};

describe('runtime remote federation', () => {
  beforeEach(() => {
    vi.resetModules();
    federation.setRemote.mockReset();
    federation.getRemote.mockReset();
    federation.unwrapDefault.mockReset();
    federation.getRemote.mockResolvedValue({});
    federation.unwrapDefault.mockResolvedValue(() => null);
  });

  const load = async () => import('./loadRemote');

  it('resolves entries against the base URL and registers all remotes', async () => {
    const { configureRemotes } = await load();
    configureRemotes(entries, 'https://example.test/notebook/');
    expect(federation.setRemote.mock.calls).toEqual([
      ['campaign', { url: 'https://example.test/notebook/remotes/campaign/assets/remoteEntry.js', format: 'esm', from: 'vite' }],
      ['profile', { url: 'https://example.test/remotes/profile/assets/remoteEntry.js', format: 'esm', from: 'vite' }],
      ['login', { url: 'https://cdn.example.test/login/remoteEntry.js', format: 'esm', from: 'vite' }],
    ]);
  });

  it('rejects malformed entries before registering any remote', async () => {
    const { configureRemotes } = await load();
    expect(() => configureRemotes({ ...entries, profile: 'javascript:bad' }, 'https://example.test/')).toThrow('Invalid remote configuration');
    expect(federation.setRemote).not.toHaveBeenCalled();
  });

  it('does not call the federation API before configuration and rejects unknown modules', async () => {
    const { loadRemoteModule } = await load();
    await expect(loadRemoteModule('profile', 'App')).rejects.toThrow('Remote configuration is not ready');
    expect(federation.getRemote).not.toHaveBeenCalled();
    const { configureRemotes } = await load();
    configureRemotes(entries, 'https://example.test/');
    await expect(loadRemoteModule('game-systems', 'App')).rejects.toThrow('Unknown remote module');
    await expect(loadRemoteModule('profile', 'Home')).rejects.toThrow('Unknown remote module');
    expect(federation.getRemote).not.toHaveBeenCalled();
  });

  it('loads, unwraps and caches a module', async () => {
    const component = () => null;
    federation.unwrapDefault.mockResolvedValue(component);
    const { configureRemotes, loadRemoteModule } = await load();
    configureRemotes(entries, 'https://example.test/');
    const first = await loadRemoteModule('profile', 'App');
    const second = await loadRemoteModule('profile', 'App');
    expect(federation.getRemote).toHaveBeenCalledTimes(1);
    expect(federation.getRemote).toHaveBeenCalledWith('profile', './App');
    expect(federation.unwrapDefault).toHaveBeenCalledWith({});
    expect(first).toEqual({ default: component });
    expect(second).toBe(first);
  });

  it('does not cache failures and clears cache when remotes are reconfigured', async () => {
    const component = () => null;
    federation.unwrapDefault.mockResolvedValue(component);
    federation.getRemote.mockRejectedValueOnce(new Error('failed')).mockResolvedValue({});
    const { configureRemotes, loadRemoteModule } = await load();
    configureRemotes(entries, 'https://example.test/');
    await expect(loadRemoteModule('profile', 'App')).rejects.toThrow('failed');
    await loadRemoteModule('profile', 'App');
    await loadRemoteModule('profile', 'App');
    expect(federation.getRemote).toHaveBeenCalledTimes(2);
    configureRemotes({ ...entries, profile: '/new-profile.js' }, 'https://example.test/');
    await loadRemoteModule('profile', 'App');
    expect(federation.getRemote).toHaveBeenCalledTimes(3);
  });
});
