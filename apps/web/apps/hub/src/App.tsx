import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ThemeProvider, SidebarProvider, useAuth, GlobalSidebar, names } from '@tdn/shared';
import { useProfile } from '@tdn/shared/auth/useProfile';
import type { AuthContextType } from '@tdn/shared';
import { hubNavItems } from './navigation';
import RemoteBoundary from './remote/RemoteBoundary';
import Login from './pages/Login';

const ProfileGate: React.FC<{ auth: AuthContextType }> = ({ auth }) => {
  const { loading, error, profileNotFound, fetchProfile } = useProfile(true);
  if (loading) return <div>Загрузка профиля…</div>;
  if (error) return <div role="alert">Не удалось загрузить профиль: {error} <button onClick={() => void fetchProfile()}>Повторить</button></div>;
  if (profileNotFound) return <RemoteBoundary name="campaign" module="CompleteProfile" auth={auth} onCompleted={fetchProfile} />;
  return (
    <Routes>
      <Route path="/groups/*" element={<RemoteBoundary name="campaign" module="App" auth={auth} />} />
      <Route path="/profile/*" element={<RemoteBoundary name="profile" module="App" auth={auth} />} />
      <Route path="/settings" element={<SettingsPlaceholder />} />
      <Route path="/complete-registration" element={<Navigate to="/profile" replace />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<RemoteBoundary name="campaign" module="Home" auth={auth} />} />
      <Route path="*" element={<RemoteBoundary name="campaign" module="Home" auth={auth} />} />
    </Routes>
  );
};

const AppContent: React.FC = () => {
  const auth = useAuth();
  if (auth.status === 'loading') return <div>Загрузка…</div>;
  if (auth.status === 'error') return <div role="alert">Не удалось проверить сессию: {auth.error} <button onClick={() => void auth.refreshSession()}>Повторить</button></div>;
  if (auth.status === 'anonymous') return <Login />;
  return (
    <>
      <GlobalSidebar navItems={hubNavItems} brand={names.title} />
      <main className="app-content">
        {auth.error && <div role="alert">{auth.error}</div>}
        <ProfileGate auth={auth} />
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

const App: React.FC = () => (
  <AuthProvider>
    <ThemeProvider>
      <SidebarProvider>
        <Router basename={import.meta.env.BASE_URL}>
          <AppContent />
        </Router>
      </SidebarProvider>
    </ThemeProvider>
  </AuthProvider>
);

export default App;
