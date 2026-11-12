// Типы для Module Federation (vite-plugin-federation).
// Хаб — host: подгружает remote-модули через динамический импорт
// `import('remoteName/Module')`, который на этапе сборки транслируется
// в __federation_method_getRemote. Здесь объявляем эти динамические
// импорты, чтобы tsc не ругался на неизвестные модули.

declare module 'campaign/*';
declare module 'game-systems/*';
declare module 'profile/*';
declare module 'login/*';
