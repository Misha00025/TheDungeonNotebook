import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@tdn/shared/styles/globals.css';
import { loadConfig } from '@tdn/shared/config';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const ConfigFailure: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <main role="alert" style={{ padding: '2rem' }}>
    <p>Не удалось загрузить конфигурацию Web. Проверьте доступность config.json.</p>
    <button type="button" onClick={onRetry}>Повторить</button>
  </main>
);

async function bootstrap() {
  try {
    await loadConfig();
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch {
    root.render(<ConfigFailure onRetry={() => void bootstrap()} />);
  }
}

void bootstrap();
