# The Dungeon Notebook

Лучшая записная книжка любителя подземелий и других приключенческих штук :)

## Структура репозитория

Каталоги `admin`, `backend`, `bff` и `web` расположены в `apps/`. Makefile и инфраструктурные каталоги остаются в корне; npm workspace по-прежнему находится во внутреннем каталоге `apps/web`.

## Сборка Docker-образов

`make build` собирает все 14 образов; `SERVICE=<name>` выбирает один образ из списка `make list-images`. Группы доступны через `make build-backend` (семь backend-образов), `make build-web` (пять web-образов), `make build-admin` (admin-panel) и отдельную группу `make build-bff`. Образ BFF также можно собрать как `make build SERVICE=bff-web`. `make help` выводит краткую справку.

```bash
make build
make build SERVICE=auth-service
make build IMAGE_TAG=1.2.3
make build SERVICE=web-hub IMAGE_TAG=ci-42 BUILD_FLAGS="--no-cache --pull"
make build SERVICE=bff-web
make build-bff
make build-web WEB_BUILD_ENV=.env.build
make list-images
```

Каждая сборка образа помечается `latest` и, если задан `IMAGE_TAG`, дополнительным тегом. `BUILD_FLAGS` передаёт флаги Docker Compose; `WEB_BUILD_ENV` задаёт файл параметров web-сборки, по умолчанию используется шаблон. Сборка не запускает контейнеры и не публикует образы.

## Подготовка и запуск

```bash
cp template.env apps/backend/.env
cp apps/web/template.env apps/web/.env
make certs
npm ci --prefix apps/web
make check-web
make run-backend
make run-web
make run
```

До запуска заполните обязательные пустые ключи и пароль accounts database в `apps/backend/.env` (в частности `ACCOUNT_SERVICE_KEY`, `INTERNAL_SERVICE_KEY` и `ACCOUNTS_MYSQL_PASSWORD`). Compose автоматически создаст OIDC-конфиг Account service в `apps/backend/account-config/accounts.json` из безопасного шаблона; вручную создавать или копировать файл не нужно. Настройте провайдера в этом JSON перед запуском сервиса. Быстрый порядок настройки и ограничения описаны в [руководстве Account service](apps/backend/account-service/README.md). Перед включением нового account-ID потока на существующих данных оператор должен выбрать свободный диапазон выше всех legacy user references. `make certs` генерирует RSA-ключи для legacy group tokens и не настраивает OIDC. Для web runtime требуется настроенный файл окружения. `make run-backend` запускает backend, BFF и его отдельный Redis; `make run` дополнительно запускает существующий Web, который пока не переключён на BFF.

### BFF

Основной запуск через `make run-backend` подключает `bff-web` к существующему `api-gateway` в `backend-network` и к отдельному `bff-redis` в частной сети BFF; вручную подключать Docker-сети не нужно. BFF доступен на `http://localhost:${BFF_PORT:-5080}`. Конфигурация при первом запуске создаётся в `apps/bff/web/data/config/appsettings.json`; key ring и Redis data хранятся в `apps/bff/web/data/keys` и `apps/bff/web/data/redis`. Это bind mounts, не named volumes. Подробнее о настройке внешнего OIDC-клиента и BFF — в [README BFF](apps/bff/web/README.md).

## Keycloak

Для установки из корня checkout используйте отдельный каталог, чтобы не смешивать файлы Keycloak с файлами репозитория:

```sh
sh scripts/setup-keycloak.sh --directory ../keycloak
```

Account service и настройка внешних JWT issuer описаны в [apps/backend/account-service/README.md](apps/backend/account-service/README.md). Перед запуском требуется настроить провайдера и отдельный ключ Gateway→Account service. Команда `make certs` относится к legacy group tokens и сама по себе не настраивает OIDC.

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
