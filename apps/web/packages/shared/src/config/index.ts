export type AppConfig = {
  BFF_BASE: string;
  API_BASE: string;
  BASE_PATH?: string;
  REMOTES?: Record<'campaign' | 'profile' | 'login', string>;
};

const defaultBff = 'http://localhost:5080/bff';
const defaultConfig: AppConfig = { BFF_BASE: defaultBff, API_BASE: `${defaultBff}/api` };
let config: AppConfig = { ...defaultConfig };

export function getConfig(): AppConfig {
  return config;
}

export function setConfig(value: AppConfig): void {
  config = normalizeConfig(value);
}

function normalizeConfig(value: unknown): AppConfig {
  if (!value || typeof value !== 'object') throw new Error('Invalid runtime config');
  const fields = value as Record<string, unknown>;
  const bff = fields.BFF_BASE === undefined ? defaultBff : fields.BFF_BASE;
  if (typeof bff !== 'string' || !bff) throw new Error('Invalid runtime config');

  const normalizedBff = bff.replace(/\/+$/, '') || '/';
  const api = fields.API_BASE === undefined
    ? `${normalizedBff === '/' ? '' : normalizedBff}/api`
    : fields.API_BASE;
  if (typeof api !== 'string' || !api) throw new Error('Invalid runtime config');

  const normalizedApi = api.replace(/\/+$/, '') || '/';
  const normalized: AppConfig = { BFF_BASE: normalizedBff, API_BASE: normalizedApi };
  if (fields.BASE_PATH !== undefined) {
    if (typeof fields.BASE_PATH !== 'string' || !fields.BASE_PATH.startsWith('/') || fields.BASE_PATH.startsWith('//')) {
      throw new Error('Invalid runtime config');
    }
    let basePath: URL;
    try {
      basePath = new URL(fields.BASE_PATH, 'http://runtime.invalid');
    } catch {
      throw new Error('Invalid runtime config');
    }
    if (basePath.origin !== 'http://runtime.invalid' || basePath.search || basePath.hash || basePath.pathname !== fields.BASE_PATH) {
      throw new Error('Invalid runtime config');
    }
    normalized.BASE_PATH = fields.BASE_PATH.endsWith('/') ? fields.BASE_PATH : `${fields.BASE_PATH}/`;
  }
  if (fields.REMOTES !== undefined) {
    if (!fields.REMOTES || typeof fields.REMOTES !== 'object' || Array.isArray(fields.REMOTES)) {
      throw new Error('Invalid runtime config');
    }
    const remotes = fields.REMOTES as Record<string, unknown>;
    const names = ['campaign', 'profile', 'login'] as const;
    if (names.some((name) => typeof remotes[name] !== 'string' || !(remotes[name] as string).trim())) {
      throw new Error('Invalid runtime config');
    }
    normalized.REMOTES = { campaign: remotes.campaign as string, profile: remotes.profile as string, login: remotes.login as string };
  }
  return normalized;
}

export async function loadConfig(): Promise<void> {
  const res = await fetch(new URL('config.json', document.baseURI), { cache: 'no-store' });
  if (res.status === 404) {
    config = { ...defaultConfig };
    return;
  }
  if (!res.ok) {
    throw new Error(`Runtime config request failed: ${res.status}`);
  }
  config = normalizeConfig(await res.json());
}

export function getApiBase(): string {
  return config.API_BASE;
}

export function joinApiUrl(base: string, endpoint: string): string {
  if (!base) {
    return endpoint;
  }
  return `${base.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
}

export function setApiBase(base: string): void {
  config = {
    ...config,
    API_BASE: base,
  };
}
