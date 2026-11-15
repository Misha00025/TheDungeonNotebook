import React from 'react';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import Login from './pages/Login';

const App: React.FC<HubRemoteProps> = ({ auth }) => (
  <RemoteAuthProvider auth={auth}>
    <Login />
  </RemoteAuthProvider>
);

export default App;
