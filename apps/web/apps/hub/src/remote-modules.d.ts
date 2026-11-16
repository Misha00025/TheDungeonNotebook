declare module 'campaign/*';
declare module 'campaign/CompleteProfile';
declare module 'game-systems/*';
declare module 'profile/*';
declare module 'login/*';

declare module 'virtual:__federation__' {
  export function __federation_method_setRemote(name: string, config: { url: string; format: 'esm'; from: 'vite' }): void;
  export function __federation_method_getRemote(name: string, module: string): Promise<unknown>;
  export function __federation_method_unwrapDefault(module: unknown): Promise<unknown>;
}
