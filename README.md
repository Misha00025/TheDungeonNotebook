# The Dungeon Notebook

Лучшая записная книжка любителя подземелий и других приключенческих штук :)

## Структура репозитория

Каталоги `backend`, `bff` и `web` расположены в `apps/`. Makefile и инфраструктурные каталоги остаются в корне; npm workspace по-прежнему находится во внутреннем каталоге `apps/web`.

## Сборка Docker-образов

`make build` собирает все 13 образов; `SERVICE=<name>` выбирает один образ из списка `make list-images`. Группы доступны через `make build-backend` (шесть backend-образов), `make build-web` (шесть web-образов, включая gateway proxy) и отдельную группу `make build-bff` (один BFF-образ). Образ BFF также можно собрать как `make build SERVICE=bff-web`; proxy — как `make build-web-proxy`. `make help` выводит краткую справку.

```bash
make build
make build SERVICE=users-service
make build IMAGE_TAG=1.2.3
make build SERVICE=web-hub IMAGE_TAG=ci-42 BUILD_FLAGS="--no-cache --pull"
make build SERVICE=bff-web
make build-bff
make build-web WEB_BUILD_ENV=.env.build
make list-images
```

Каждая сборка образа помечается `latest` и, если задан `IMAGE_TAG`, дополнительным тегом. `BUILD_FLAGS` передаёт флаги Docker Compose; `WEB_BUILD_ENV` задаёт build env-файл и сохранён для совместимости. `apps/web/template.env.build` больше не содержит deployment settings. Сборка не запускает контейнеры и не публикует образы.

## Подготовка и запуск

```bash
cp template.env apps/backend/.env
test -e apps/web/.env || cp apps/web/template.env apps/web/.env
npm ci --prefix apps/web
make check-web
make run-backend
make run-web
make run
```

До запуска заполните обязательные пустые ключи и общий пароль MySQL в `apps/backend/.env` (в частности `MYSQL_PASSWORD`, `ACCOUNT_SERVICE_KEY` и `INTERNAL_SERVICE_KEY`). Account service использует общий MySQL-пользователь и пароль с Users/Campaign, но подключается к отдельной базе `ACCOUNTS_DATABASE`. Compose автоматически создаст OIDC-конфиг Account service в `apps/backend/account-config/accounts.json` из безопасного шаблона; вручную создавать или копировать файл не нужно. Настройте внешнего провайдера в этом JSON перед запуском сервиса. Быстрый порядок настройки и ограничения описаны в [руководстве Account service](apps/backend/account-service/README.md). Перед включением нового account-ID потока на существующих данных оператор должен выбрать свободный диапазон выше всех legacy user references. Проверка исторических group JWT в Account остаётся отдельной опциональной функцией; backend больше не выпускает такие токены. `make run-backend` запускает backend, BFF и его отдельный Redis; `make run` дополнительно запускает Web.

Web runtime состоит из Hub, трёх remotes и отдельного `tdn-web-proxy`; только proxy публикует host port `WEB_PORT` (по умолчанию 3004). Для source run настройте `apps/web/.env`; для переносимого комплекта — отдельный `.env` по образцу `deploy/web/.env.example`. Hub и remote containers не публикуют host ports. Proxy генерирует browser config и маршруты из runtime environment; BFF остаётся отдельным browser-reachable endpoint и этим gateway не проксируется. Значение `localhost` для `BFF_BASE` годится лишь если BFF действительно доступен на компьютере пользователя. Hub владеет cookie session и CSRF transport; пользователь отдельно настраивает BFF `PublicOrigin`/`AllowedOrigins` на фактический публичный Web origin и IdP callbacks. Подробности runtime config, deployment и внешний Nginx — в [Web README](apps/web/README.md), portable run — в [deploy/web README](deploy/web/README.md), настройка logout — в [README BFF](apps/bff/web/README.md).

Для запуска готовых Web-образов без checkout используйте [переносимый Web-комплект](deploy/web/README.md).

### BFF

Основной запуск через `make run-backend` подключает `bff-web` к существующему `api-gateway` в `backend-network` и к отдельному `bff-redis` в частной сети BFF; вручную подключать Docker-сети не нужно. BFF доступен на `http://localhost:${BFF_PORT:-5080}`. Конфигурация при первом запуске создаётся в `apps/bff/web/data/config/appsettings.json`; key ring и Redis data хранятся в `apps/bff/web/data/keys` и `apps/bff/web/data/redis`. Это bind mounts, не named volumes. Подробнее о настройке внешнего OIDC-клиента и BFF — в [README BFF](apps/bff/web/README.md).

## Keycloak

Для установки из корня checkout используйте отдельный каталог, чтобы не смешивать файлы Keycloak с файлами репозитория:

```sh
sh scripts/setup-keycloak.sh --directory ../keycloak
```

Account service и настройка внешних JWT issuer описаны в [apps/backend/account-service/README.md](apps/backend/account-service/README.md). Перед запуском требуется настроить провайдера и отдельный ключ Gateway→Account service. Исторические group JWT могут проверяться Account отдельно и опционально; их издателя auth-service больше нет.

По умолчанию установщик использует текущий каталог, определяет IPv4 основного интерфейса и запускает публичный HTTP на `0.0.0.0:8180`; домен и proxy не нужны. Данные PostgreSQL хранятся в `data/postgres` выбранного каталога. HTTP не шифрует пароли: используйте его для тестов; доверенный TLS для постоянной эксплуатации настраивается отдельно. Core Keycloak может отдельно требовать HTTPS для `master` или Admin UI; установщик эту политику не меняет. В комплект входит тема входа `tdn`; подробности — в [документации Keycloak](deploy/keycloak/README.md). При первой настройке вручную замените временную bootstrap-учётную запись администратора через Keycloak UI.

## Проверки и обслуживание

**Внимание:** `make test` запускает интеграционные тесты и очищает тестовые данные баз данных перед запуском. Не запускайте его, если важны данные в используемом тестовом окружении.

**Внимание:** `make clean` удаляет локальные данные MongoDB и MySQL после подтверждения; действие требует `sudo`.

**Внимание:** `make` без цели запускает цель по умолчанию `test` и имеет тот же эффект очистки тестовых данных. Не запускайте `make` без цели, если данные должны сохраниться.

Для текущего OIDC/account-service интеграционного сценария используйте `make test-oidc`: он запускает изолированный harness. Не запускайте legacy `make test` против ценных данных.

```bash
make web-install
make web-typecheck
make web-test
make web-build
make check-web
make clean
cd monitoring && docker compose up -d
```

Восстановление из существующей резервной копии (из корня репозитория):

```bash
(cd apps/backend && ../../scripts/restore.sh -f docker-compose.yaml -b /path/to/backup)
```

## API

[Публичная HTML-документация](docs/api/index.html)

Current Campaign Service contracts are documented in [the service API index](apps/backend/campaign-service/docs/README.md). The singleton-template contract and Web handoff are described in [singleton-template Web handoff](apps/backend/campaign-service/docs/singleton-template-web.md); its breaking database migration behavior is documented in [templates](apps/backend/campaign-service/docs/templates.md).
