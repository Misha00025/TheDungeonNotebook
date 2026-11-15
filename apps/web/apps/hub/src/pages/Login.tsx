import React from 'react';
import { useAuth } from '@tdn/shared';
import RemoteBoundary from '../remote/RemoteBoundary';

const Login: React.FC = () => {
  const auth = useAuth();
  return <RemoteBoundary name="login" module="App" auth={auth} />;
};

export default Login;
