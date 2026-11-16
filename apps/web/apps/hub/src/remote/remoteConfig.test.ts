import { describe, expect, it } from 'vitest';
import { createRemoteConfig } from '../../remote.config';

const names = ['campaign', 'profile', 'login'];

describe('Hub remote build and dev config', () => {
  it('keeps three URL-free placeholder remotes for host federation mode', () => {
    const { remotes } = createRemoteConfig({});
    expect(Object.keys(remotes)).toEqual(names);
    for (const name of names) {
      expect(remotes[name as keyof typeof remotes]).toMatchObject({
        externalType: 'promise',
        format: 'esm',
        from: 'vite',
      });
      expect(remotes[name as keyof typeof remotes].external).toContain("Promise.reject(new Error('Remote is not configured'))");
      expect(remotes[name as keyof typeof remotes].external).not.toMatch(/http:\/\/|https:\/\/|\/remotes\/|localhost/);
      expect(remotes[name as keyof typeof remotes].external).toBeTruthy();
    }
  });

  it('does not use legacy Vite deployment environment values in remotes', () => {
    const defaults = createRemoteConfig({}).remotes;
    const withLegacyValues = createRemoteConfig({
      VITE_BASE: '/old-prefix/',
      VITE_REMOTE_PROFILE: 'https://legacy.example.test/remoteEntry.js',
    }).remotes;
    expect(withLegacyValues).toEqual(defaults);
  });

  it('provides local preview proxies with query-preserving, name-specific rewrites', () => {
    const { proxy } = createRemoteConfig({});
    expect(Object.keys(proxy)).toEqual([
      '/remotes/campaign/',
      '/remotes/profile/',
      '/remotes/login/',
    ]);
    expect(proxy['/remotes/campaign/'].target).toBe('http://localhost:3000');
    expect(proxy['/remotes/profile/'].target).toBe('http://localhost:3002');
    expect(proxy['/remotes/login/'].target).toBe('http://localhost:3003');
    expect(proxy['/remotes/profile/'].rewrite?.('/remotes/profile/assets/app.js?v=1')).toBe('/assets/app.js?v=1');
    expect(proxy['/remotes/profile/'].rewrite?.('/remotes/profile/assets/app.css?v=2')).toBe('/assets/app.css?v=2');
    expect(proxy['/remotes/profile/'].rewrite?.('/remotes/campaign/assets/app.js?v=3')).toBe('/remotes/campaign/assets/app.js?v=3');
  });

  it('uses configurable upstreams only for dev proxy targets', () => {
    const { proxy, remotes } = createRemoteConfig({
      WEB_CAMPAIGN_UPSTREAM: 'http://campaign-preview:3100',
      WEB_PROFILE_UPSTREAM: 'http://profile-preview:3102',
      WEB_LOGIN_UPSTREAM: 'http://login-preview:3103',
    });
    expect(remotes).toEqual(createRemoteConfig({}).remotes);
    expect(proxy['/remotes/campaign/'].target).toBe('http://campaign-preview:3100');
    expect(proxy['/remotes/profile/'].target).toBe('http://profile-preview:3102');
    expect(proxy['/remotes/login/'].target).toBe('http://login-preview:3103');
  });
});
