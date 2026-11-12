// Хаб (shell) — host-приложение микрофронтендов.
//
// Точка входа, общая левая панель, оркестрация сессии, монтирование remotes.
// Маршрутизация верхнего уровня (префиксы) — у хаба; детали доменов — у remotes.
//
// Провайдеры: Auth → Theme → Sidebar → Session → Router → AppContent.
// Порядок соответствует apps/campaign (AuthProvider снаружи, т.к. ThemeProvider
// зависит от useAuth).

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ThemeProvider, SidebarProvider, useAuth, GlobalSidebar, names } from '@tdn/shared';
import { SessionProvider, useHubSession } from './session/SessionProvider';
import { hubNavItems } from './navigation';
import RemoteBoundary from './remote/RemoteBoundary';
import Login from './pages/Login';

// Гейт «не залогинен»: хаб решает, что пользователь не залогинен, и
// показывает страницу входа (remote login). Сессия и auth прокидываются
// в remotes.
const AppContent: React.FC = () => {
  const session = useHubSession();
  const { accessToken } = session;
  const { login, logout, userId } = useAuth();

  if (!accessToken) {
    return <Login />;
  }

  // Auth, который хаб прокидывает в remotes. Remotes используют его через
  // RemoteAuthProvider (общий AuthContext), а не бандлят свой AuthProvider.
  const auth = { accessToken, login, logout, userId };

  return (
    <>
      <GlobalSidebar navItems={hubNavItems} brand={names.title} />
      <main className="app-content">
        <Routes>
          {/* Главная — общая вкладка. Подгружает ТОЛЬКО страницу «Главная»
              из campaign как готовый модуль (хаб не тянет домен кампании).
              path="*" (splat) вместо "/": иначе вложенные <Routes> remotes
              (campaign/game-systems/profile) не матчатся под своими префиксами
              и react-router выдаёт предупреждение «parent route path has no
              trailing "*"». Splat также служит catch-all для неизвестных путей. */}
          <Route
            path="*"
            element={
              <RemoteBoundary name="campaign" module="Home" auth={auth} session={session} />
            }
          />
          {/* Группы (кампания) — remote владеет своей маршрутизацией.
              Кампания = группы, единый префикс /groups/* (тикет #26). */}
          <Route
            path="/groups/*"
            element={
              <RemoteBoundary name="campaign" module="App" auth={auth} session={session} />
            }
          />
          {/* Профиль — remote. */}
          <Route
            path="/profile/*"
            element={
              <RemoteBoundary name="profile" module="App" auth={auth} session={session} />
            }
          />
          {/* Настройки — пока заглушка (владелец настроек темы — хаб). */}
          <Route path="/settings" element={<SettingsPlaceholder />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
};

const SettingsPlaceholder: React.FC = () => (
  <div>
    <h2>Настройки</h2>
    <p>Раздел настроек (владелец настроек темы — хаб).</p>
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SidebarProvider>
          <SessionProvider>
            <Router basename={import.meta.env.BASE_URL}>
              <AppContent />
            </Router>
          </SessionProvider>
        </SidebarProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
