// RemoteBoundary — каркас монтирования remote-модуля.
//
// Загружает remote-модуль (см. loadRemote.ts), показывает состояние
// загрузки/ошибки и рендерит компонент, прокидывая в него auth, session
// и apiBase хаба. Хаб не знает деталей домена remote — только контракт
// RemoteModule / RemoteProps.

import React, { useEffect, useState } from 'react';
import { loadRemoteModule } from './loadRemote';
import type { RemoteModule, RemoteProps } from './types';

interface RemoteBoundaryProps extends RemoteProps {
  /** Имя remote (совпадает с ключом в remotes vite.config). */
  name: 'campaign' | 'game-systems' | 'profile' | 'login';
  /** Имя экспонируемого модуля внутри remote. */
  module: string;
}

const RemoteBoundary: React.FC<RemoteBoundaryProps> = ({
  name,
  module,
  auth,
  session,
  apiBase,
}) => {
  const [mod, setMod] = useState<RemoteModule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMod(null);
    setError(null);

    loadRemoteModule(name, module)
      .then((loaded) => {
        if (!cancelled) setMod(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [name, module]);

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'var(--danger-color, #d93025)' }}>
        Не удалось загрузить модуль «{name}/{module}»: {error}
      </div>
    );
  }

  if (!mod) {
    return <div style={{ padding: '2rem' }}>Загрузка модуля…</div>;
  }

  const RemoteComponent = mod.default;
  return (
    <RemoteComponent
      auth={auth}
      session={session}
      apiBase={apiBase ?? session?.apiBase}
    />
  );
};

export default RemoteBoundary;
