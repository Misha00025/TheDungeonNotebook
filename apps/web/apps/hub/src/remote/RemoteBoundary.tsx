import React, { useEffect, useState } from 'react';
import { loadRemoteModule } from './loadRemote';
import type { RemoteModule, RemoteProps } from './types';
import { Button, Notification } from '@tdn/shared';

interface RemoteBoundaryProps extends RemoteProps {
  /** Имя remote (совпадает с ключом в remotes vite.config). */
  name: 'campaign' | 'game-systems' | 'profile' | 'login';
  /** Имя экспонируемого модуля внутри remote. */
  module: string;
}

const RemoteLoader: React.FC<RemoteBoundaryProps> = ({
  name,
  module,
  auth,
  onCompleted,
}) => {
  const [mod, setMod] = useState<RemoteModule | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

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
  }, [name, module, loadAttempt]);

  if (failed) {
    return (
      <div style={{ padding: '2rem' }}>
        <Notification kind="error" eventKey={`${name}:${module}:${loadAttempt}`}>Не удалось загрузить раздел. Попробуйте обновить страницу.</Notification>
        <Button variant="secondary" type="button" onClick={() => setLoadAttempt(value => value + 1)}>Повторить загрузку раздела</Button>
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

const RemoteBoundary: React.FC<RemoteBoundaryProps> = (props) => (
  <RemoteLoader key={JSON.stringify([props.name, props.module])} {...props} />
);

export default RemoteBoundary;
