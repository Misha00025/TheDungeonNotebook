import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@tdn/shared/styles/globals.css';
import { getConfig, loadConfig } from '@tdn/shared/config';
import { configureRemotes } from './remote/loadRemote';
import { bootstrap } from './bootstrap';
import { Notification } from '@tdn/shared';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const ConfigFailure: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <main style={{ padding: '2rem' }}>
    <Notification kind="error">Не удалось загрузить конфигурацию Web. Проверьте доступность config.json.</Notification>
    <button type="button" onClick={onRetry}>Повторить</button>
  </main>
);

void bootstrap(
  loadConfig,
  () => configureRemotes(getConfig().REMOTES),
  () => root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    ),
  (retry) => root.render(<ConfigFailure onRetry={retry} />),
);
