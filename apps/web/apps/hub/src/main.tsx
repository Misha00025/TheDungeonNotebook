import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@tdn/shared/styles/globals.css';
import { loadConfig } from '@tdn/shared/config';

async function bootstrap() {
  await loadConfig();

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
