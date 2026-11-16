import { describe, expect, it } from 'vitest';
import { remoteAssetConfig } from '../../../../remote-build.config';

describe('shared remote asset build config', () => {
  it('uses a neutral base and relative asset URLs without deployment bindings', () => {
    expect(remoteAssetConfig.base).toBe('/');
    expect(Object.keys(remoteAssetConfig)).toEqual(['base', 'experimental']);
    expect(Object.keys(remoteAssetConfig.experimental ?? {})).toEqual(['renderBuiltUrl']);
    const hook = remoteAssetConfig.experimental?.renderBuiltUrl;
    if (typeof hook !== 'function') throw new Error('renderBuiltUrl must be a function');

    expect(hook('assets/__federation_expose_App.js', {
      hostId: 'assets/remoteEntry.js',
      hostType: 'js',
      ssr: false,
      type: 'asset',
    })).toEqual({ relative: true });
    expect(hook('assets/remote.css', {
      hostId: 'assets/remote.css',
      hostType: 'css',
      ssr: false,
      type: 'asset',
    })).toEqual({ relative: true });
    expect(hook.toString()).not.toMatch(/https?:\/\/|\/remotes\/|localhost|VITE_BASE|VITE_REMOTE_/);
  });
});
