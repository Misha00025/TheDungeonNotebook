import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { RemoteAuthProvider, useAuth } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import { DirtyProvider, useAcceptedLocation, WorkspaceProvider } from './workspace/Workspace';
import Campaigns from './workspace/Campaigns';

const HomeRoutes: React.FC = () => {
  const accepted = useAcceptedLocation();
  return <Routes location={accepted}><Route index element={<Campaigns allowCreate={false} />} /><Route path="*" element={<Campaigns allowCreate={false} />} /></Routes>;
};

const HomeContent: React.FC = () => {
  const { authenticated, userId } = useAuth();
  if (!authenticated) return null;
  return <WorkspaceProvider key={String(userId)} mountPath="/groups"><DirtyProvider><HomeRoutes /></DirtyProvider></WorkspaceProvider>;
};
const Home: React.FC<HubRemoteProps> = ({ auth }) => <RemoteAuthProvider auth={auth}><HomeContent /></RemoteAuthProvider>;
export default Home;
