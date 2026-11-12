# TDN Web workspace

Web workspace использует Vite, React и TypeScript с npm workspaces.

## Установка и проверки

Все команды можно запускать из корня монорепозитория:

```bash
cp apps/web/template.env apps/web/.env
npm ci --prefix apps/web
make check-web
make web-install
make web-typecheck
make web-test
make web-build
```

Доступны также `npm --prefix apps/web run typecheck --workspaces --if-present`, `npm --prefix apps/web run test:run` и `npm --prefix apps/web run build --workspaces --if-present`. `make web-test` и `make test-web` запускают web tests. `make check-web` выполняет typecheck, тесты и сборку.

## Сборка и запуск в Docker

```bash
cp apps/web/template.env apps/web/.env
make build-web
make run-web
make build-web WEB_BUILD_ENV=.env.build
```

`WEB_BUILD_ENV` задаёт параметры web-сборки, по умолчанию используется шаблон. Runtime-запуск требует настроенного окружения. Используемые Compose-порты: campaign — 3000, profile — 3002, login — 3003, hub — 3004. Не делайте выводов о полноте runtime-платформы из этих параметров.

## Документация API

[Публичная HTML-документация](../../docs/api/index.html)
