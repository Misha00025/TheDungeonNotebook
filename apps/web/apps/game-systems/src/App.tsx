import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import AppLayout from './layout/AppLayout';
import SystemsList from './pages/SystemsList';
import SystemLayout from './pages/SystemLayout';
import SystemOverview from './pages/SystemOverview';
import WorkInProgress from './pages/WorkInProgress';

const AppContent: React.FC = () => {
  const { authenticated } = useAuth();
  if (!authenticated) return null;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<SystemsList />} />
        <Route path="/:systemId" element={<SystemLayout />}>
          <Route index element={<SystemOverview />} />
          <Route path="content" element={<WorkInProgress />} />
          <Route path="versions" element={<WorkInProgress />} />
          <Route path="rules" element={<WorkInProgress />} />
        </Route>
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC<HubRemoteProps> = ({ auth }) => <RemoteAuthProvider auth={auth}><AppContent /></RemoteAuthProvider>;

export default App;
