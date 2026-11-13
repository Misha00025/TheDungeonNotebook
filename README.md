# The Dungeon Notebook

Лучшая записная книжка любителя подземелий и других приключенческих штук :)

## Структура репозитория

Каталоги `admin`, `backend` и `web` расположены в `apps/`. Makefile и инфраструктурные каталоги остаются в корне; npm workspace по-прежнему находится во внутреннем каталоге `apps/web`.

## Сборка Docker-образов

`make build` собирает все 12 образов; `SERVICE=<name>` выбирает один образ из списка `make list-images`. Группы доступны через `make build-backend` (шесть backend-образов), `make build-web` (пять web-образов) и `make build-admin` (admin-panel). `make help` выводит краткую справку.

```bash
make build
make build SERVICE=auth-service
make build IMAGE_TAG=1.2.3
make build SERVICE=web-hub IMAGE_TAG=ci-42 BUILD_FLAGS="--no-cache --pull"
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

Для запуска backend нужны настройки окружения и сертификаты. `make certs` генерирует RSA-ключи. Для web runtime требуется настроенный файл окружения. `make run` запускает backend и web.

## Локальный Keycloak

Для независимого локального контура разработки из корня checkout выполните `sh scripts/setup-keycloak.sh --start`. По умолчанию конфигурация и `.env` размещаются в `$HOME/apps/keycloack`, а данные PostgreSQL — в `$HOME/apps/keycloack/data/postgres` (при `--directory PATH` — в `PATH/data/postgres`). Этот контур предназначен только для локальной машины. В комплект входит готовая тема входа `tdn`; включение — в [документации локального Keycloak](deploy/keycloak/README.md). Инструкции по скачиванию установщика на чистую машину и ограничениям повторного запуска приведены там же. Первым шагом после запуска вручную замените временную bootstrap-учётную запись администратора через Keycloak UI.

## Проверки и обслуживание

**Внимание:** `make test` запускает интеграционные тесты и очищает тестовые данные баз данных перед запуском. Не запускайте его, если важны данные в используемом тестовом окружении.

**Внимание:** `make clean` удаляет локальные данные MongoDB и MySQL после подтверждения; действие требует `sudo`.

**Внимание:** `make` без цели запускает цель по умолчанию `test` и имеет тот же эффект очистки тестовых данных. Не запускайте `make` без цели, если данные должны сохраниться.

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
