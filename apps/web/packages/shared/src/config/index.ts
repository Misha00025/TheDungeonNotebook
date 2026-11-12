type AppConfig = {
  API_BASE: string;
};

let config: AppConfig | null = null;

export async function loadConfig(): Promise<void> {
  try {
    // BASE_URL — это base из vite.config (VITE_BASE), например '/' или '/campaign'.
    // Убираем хвостовой слэш, чтобы корректно склеить с '/config.json' в обоих случаях.
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/config.json`);
    config = await res.json();
  } catch {
    config = { API_BASE: 'http://localhost:5000' };
  }
}

export function getApiBase(): string {
  return config?.API_BASE || 'http://localhost:5000';
}

/**
 * Склеивает API_BASE (может иметь хвостовой слэш, например
 * 'http://host/api/') с endpoint (обычно с ведущим слэшем, например
 * '/groups/3/users/3') БЕЗ двойного слэша.
 *
 * Двойной слэш в пути (http://host/api//groups/...) заставляет некоторые
 * серверы/прокси отвечать редиректом, из-за чего браузер обрывает
 * in-flight запрос (net::ERR_ABORTED), хотя операция на сервере уже
 * выполнена. Нормализация склейки устраняет это.
 */
export function joinApiUrl(base: string, endpoint: string): string {
  if (!base) return endpoint;
  return `${base.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
}

/**
 * Переопределяет API_BASE извне (например, хаб прокидывает свой API_BASE
 * в remotes при монтировании). Используется, когда приложение работает
 * внутри хаба и не грузит собственный config.json (main.tsx не вызывается).
 */
export function setApiBase(base: string): void {
  config = { API_BASE: base };
}
