// src/main.tsx
// Точка входа игровых систем.
//
// Автономный запуск (standalone): оборачивает App (маршруты) в собственный
// Router + общие провайдеры (Auth/Theme/Session). При монтировании хабом
// (Module Federation) этот файл НЕ используется — хаб рендерит экспонируемый
// App внутри своего Router и своих общих провайдеров (см. apps/hub).

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import '@tdn/shared/styles/globals.css';
import { loadConfig } from '@tdn/shared/config';
import { AuthProvider } from '@tdn/shared/auth/AuthContext';
import { ThemeProvider } from '@tdn/shared/theme/ThemeContext';
import { SessionProvider } from './session/SessionProvider';

async function bootstrap() {
  await loadConfig();

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <ThemeProvider>
          <SessionProvider>
            <Router basename={import.meta.env.BASE_URL}>
              <App />
            </Router>
          </SessionProvider>
        </ThemeProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}

bootstrap();
