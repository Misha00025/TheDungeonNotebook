# The Dungeon Notebook

Лучшая записная книжка любителя подземелий и других приключенческих штук :)

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
cp template.env backend/.env
cp web/template.env web/.env
make certs
npm ci --prefix web
make check-web
make run-backend
make run-web
make run
```

Для запуска backend нужны настройки окружения и сертификаты. `make certs` генерирует RSA-ключи. Для web runtime требуется настроенный файл окружения. `make run` запускает backend и web.

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

## API

[Публичная HTML-документация](docs/api/index.html)
