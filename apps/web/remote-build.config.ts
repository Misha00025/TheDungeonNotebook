import type { UserConfig } from 'vite';

export const remoteAssetConfig = {
  base: '/',
  experimental: {
    renderBuiltUrl: (filename, context) => {
      void filename;
      void context;
      return { relative: true };
    },
  },
} satisfies Pick<UserConfig, 'base' | 'experimental'>;
