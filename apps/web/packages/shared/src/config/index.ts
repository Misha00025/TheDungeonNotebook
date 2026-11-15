export type AppConfig = {
  BFF_BASE: string;
  API_BASE: string;
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
  return { BFF_BASE: normalizedBff, API_BASE: normalizedApi };
}

export async function loadConfig(): Promise<void> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/config.json`);
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
