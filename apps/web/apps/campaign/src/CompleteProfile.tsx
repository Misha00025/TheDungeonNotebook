import React from 'react';
import { RemoteAuthProvider } from '@tdn/shared';
import type { HubRemoteProps } from '@tdn/shared';
import CompleteRegistration from './pages/Authorisation/CompleteRegistration';

type CompleteProfileProps = HubRemoteProps & { onCompleted: () => Promise<void> };

const CompleteProfile: React.FC<CompleteProfileProps> = ({ auth, onCompleted }) => (
  <RemoteAuthProvider auth={auth}>
    {auth.authenticated ? <CompleteRegistration onCompleted={onCompleted} /> : null}
  </RemoteAuthProvider>
);

export default CompleteProfile;
