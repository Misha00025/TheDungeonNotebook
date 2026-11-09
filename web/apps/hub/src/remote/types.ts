// Типы контракта remote-модулей, которые монтирует хаб.
// Каждый remote экспонирует React-компонент (default export). Хаб знает
// только этот контракт, не детали доменов.
//
// Хаб — владелец сессии и auth. Он прокидывает в remote-компонент:
//   - auth      — accessToken / login / logout / userId (из общего AuthProvider)
//   - session   — HubSession (accessToken, userId, apiBase)
//   - apiBase   — API_BASE хаба (чтобы remote стучался на тот же шлюз)
// Remotes НЕ бандлят собственные Auth/Theme/Session-провайдеры при
// монтировании в хаб — они используют переданный auth (через RemoteAuthProvider).

import type { ComponentType } from 'react';
import type { HubSession } from '../session';
import type { AuthContextType } from '@tdn/shared';

export interface RemoteModule {
  default: ComponentType<RemoteProps>;
}

export type RemoteName = 'campaign' | 'game-systems' | 'profile' | 'login';

/** Пропсы, которые хаб передаёт в remote-компонент. */
export interface RemoteProps {
  /** Auth от хаба (accessToken/login/logout/userId). */
  auth?: Partial<AuthContextType>;
  /** Сессия хаба (accessToken, userId, apiBase). */
  session?: HubSession;
  /** API_BASE хаба. */
  apiBase?: string;
}

export interface RemoteDescriptor {
  /** Имя remote (совпадает с ключом в remotes vite.config). */
  name: RemoteName;
  /** Имя экспонируемого модуля внутри remote (без префикса remote). */
  module: string;
  /** Сессия, прокидываемая хабом в remote (см. session.ts). */
  session?: HubSession;
}
