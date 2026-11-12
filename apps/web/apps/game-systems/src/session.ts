// src/session.ts
// Контракт сессии, которую хаб прокидывает в remote-модули игровых систем.
// При автономном запуске (без хаба) приложение грузит сессию из хранилища
// (fallback) — см. session/SessionProvider.tsx.

export interface GameSystemsSession {
  /** Access-токен (может быть null, если пользователь не залогинен). */
  accessToken: string | null;
  /** Идентификатор пользователя (null, если не залогинен). */
  userId: number | null;
  /** API_BASE из config.json хаба (прокидывается при монтировании). */
  apiBase: string;
}
