# @tdn/shared

Общий код, не зависящий от домена: auth, theme, ui-кит, utils, config.

Подключается через алиас `@tdn/shared` в `vite.config.ts` на исходники `src/` (без отдельной сборки пакета).

## Структура

- `src/auth/` — AuthContext, tokenManager, api, типы
- `src/theme/` — ThemeContext, color, типы
- `src/ui/` — PageLayout, AdaptiveLayout, GlobalSidebar, Buttons, ...
- `src/utils/` — evaluateExpression, generateKey, storage, ...
- `src/config/` — loadConfig, getApiBase

> Каркас создан в подзадаче 3.1; наполнение — в 3.2.
