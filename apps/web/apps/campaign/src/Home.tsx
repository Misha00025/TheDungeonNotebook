import React from 'react';
import Dashboard from './pages/Dashboard';
import { VisitedProvider } from './contexts/VisitedContext';
import { RemoteAuthProvider, useAuth } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';

const HomeContent: React.FC = () => {
  const { authenticated } = useAuth();
  if (!authenticated) return null;
  return <VisitedProvider><Dashboard /></VisitedProvider>;
};

const Home: React.FC<HubRemoteProps> = ({ auth }) => (
  <RemoteAuthProvider auth={auth}>
    <HomeContent />
  </RemoteAuthProvider>
);

export default Home;
