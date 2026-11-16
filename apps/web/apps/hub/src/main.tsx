import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@tdn/shared/styles/globals.css';
import { getConfig, loadConfig } from '@tdn/shared/config';
import { configureRemotes } from './remote/loadRemote';
import { bootstrap } from './bootstrap';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const ConfigFailure: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <main role="alert" style={{ padding: '2rem' }}>
    <p>Не удалось загрузить конфигурацию Web. Проверьте доступность config.json.</p>
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
