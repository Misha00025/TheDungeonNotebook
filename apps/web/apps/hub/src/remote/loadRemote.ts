import {
  __federation_method_getRemote as getRemote,
  __federation_method_setRemote as setRemote,
  __federation_method_unwrapDefault as unwrapDefault,
} from 'virtual:__federation__';
import type { AppConfig } from '@tdn/shared/config';
import type { RemoteModule, RemoteDescriptor } from './types';

const remoteNames = ['campaign', 'profile', 'login'] as const;
const allowedModules: Record<(typeof remoteNames)[number], string[]> = {
  campaign: ['App', 'Home', 'CompleteProfile'],
  profile: ['App'],
  login: ['App'],
};
const moduleCache = new Map<string, RemoteModule>();
let configured = false;

export function configureRemotes(
  entries: AppConfig['REMOTES'],
  baseUrl: string = document.baseURI,
): void {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Invalid remote configuration');
  const resolved = remoteNames.map((name) => {
    const entry = entries[name];
    if (typeof entry !== 'string' || !entry.trim()) throw new Error('Invalid remote configuration');
    let url: URL;
    try {
      url = new URL(entry, baseUrl);
    } catch {
      throw new Error('Invalid remote configuration');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid remote configuration');
    return [name, url.href] as const;
  });

  for (const [name, url] of resolved) {
    setRemote(name, { url, format: 'esm', from: 'vite' });
  }
  moduleCache.clear();
  configured = true;
}

export async function loadRemoteModule(
  name: RemoteDescriptor['name'],
  module: string,
): Promise<RemoteModule> {
  if (!remoteNames.includes(name as (typeof remoteNames)[number]) || !allowedModules[name as keyof typeof allowedModules]?.includes(module)) {
    throw new Error('Unknown remote module');
  }
  if (!configured) throw new Error('Remote configuration is not ready');
  const key = `${name}/${module}`;
  const cached = moduleCache.get(key);
  if (cached) return cached;

  const remote = await getRemote(name, `./${module}`);
  const component = await unwrapDefault(remote);
  const loaded = { default: component as RemoteModule['default'] };
  moduleCache.set(key, loaded);
  return loaded;
}
