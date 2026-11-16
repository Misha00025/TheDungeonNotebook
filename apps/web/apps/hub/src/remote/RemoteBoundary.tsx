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
  onCompleted,
}) => {
  const [mod, setMod] = useState<RemoteModule | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMod(null);
    setFailed(false);

    loadRemoteModule(name, module)
      .then((loaded) => {
        if (!cancelled) setMod(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [name, module]);

  if (failed) {
    return (
      <div role="alert" style={{ padding: '2rem', color: 'var(--danger-color, #d93025)' }}>
        Не удалось загрузить раздел. Попробуйте обновить страницу.
      </div>
    );
  }

  if (!mod) {
    return <div style={{ padding: '2rem' }}>Загрузка модуля…</div>;
  }

  const RemoteComponent = mod.default;
  return (
    <RemoteComponent auth={auth} onCompleted={onCompleted} />
  );
};

export default RemoteBoundary;
