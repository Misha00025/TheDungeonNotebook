import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import Profile from './pages/Profile';

const AppContent: React.FC = () => {
  const { authenticated } = useAuth();
  if (!authenticated) return null;
  return (
    <Routes>
      <Route path="/" element={<Profile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC<HubRemoteProps> = ({ auth }) => (
  <RemoteAuthProvider auth={auth}><AppContent /></RemoteAuthProvider>
);

export default App;
