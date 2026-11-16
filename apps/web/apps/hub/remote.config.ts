import type { ProxyOptions } from 'vite';

const remoteNames = ['campaign', 'profile', 'login'] as const;

type RemoteName = (typeof remoteNames)[number];

export function createRemoteConfig(env: Record<string, string | undefined>) {
  const remotes = Object.fromEntries(remoteNames.map((name) => [name, {
    external: "Promise.reject(new Error('Remote is not configured'))",
    externalType: 'promise',
    format: 'esm',
    from: 'vite',
  }])) as Record<RemoteName, { external: string; externalType: 'promise'; format: 'esm'; from: 'vite' }>;

  const proxy = Object.fromEntries(
    remoteNames.map((name) => {
      const prefix = `/remotes/${name}`;
      const upstream = env[`WEB_${name.toUpperCase()}_UPSTREAM`]
        || `http://localhost:${name === 'campaign' ? '3000' : name === 'profile' ? '3002' : '3003'}`;
      const options: ProxyOptions = {
        target: upstream,
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${prefix}(?=/)`), ''),
      };
      return [`${prefix}/`, options];
    }),
  ) as Record<string, ProxyOptions>;

  return { remotes, proxy };
}
