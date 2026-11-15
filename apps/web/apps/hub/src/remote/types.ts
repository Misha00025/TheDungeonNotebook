import type { ComponentType } from 'react';
import type { HubRemoteProps } from '@tdn/shared';

export interface RemoteModule {
  default: ComponentType<RemoteProps>;
}

export type RemoteName = 'campaign' | 'game-systems' | 'profile' | 'login';
export type RemoteProps = HubRemoteProps & { onCompleted?: () => Promise<void> };

export interface RemoteDescriptor {
  name: RemoteName;
  module: string;
}
