# Переносимый backend

Этот Compose-файл разворачивает штатный backend, включая BFF. Это не Web, Keycloak и не новая платформа. `docker-compose.yaml` можно разместить в любом каталоге сервера; рядом с ним создайте `.env` в редакторе по образцу `.env.example`. Исходники и checkout на сервере не нужны. Все bind-пути относительны каталогу YAML. MySQL-инициализация встроена в Compose; файлы из `apps/` не требуются.

Нужен Docker Compose v2 с поддержкой `configs.content` (начиная с v2.23.1). Compose не собирает и не доставляет application images: образы должны уже присутствовать на Docker host. Имена образов соответствуют каталогу сборки:

| Сервис | Образ |
| --- | --- |
| auth-service | `backend-auth-service:latest` |
| users-service | `backend-users-service:latest` |
| campaign-service | `backend-campaign-service:latest` |
| account-service | `backend-account-service:latest` |
| api-gateway | `backend-api-gateway:latest` |
| bff-web | `tdn-bff-web:latest` |

Для этих образов по умолчанию задана политика `never`: используются уже имеющиеся локальные образы. При необходимости оператор может выбрать другую политику через `APP_PULL_POLICY` в `.env`.

## Настройки и файлы

Обязательные значения-пароли и ключи в `.env` оставлены пустыми в образце: задайте их до запуска. `ACCOUNT_SERVICE_KEY` и `INTERNAL_SERVICE_KEY` — разные ключи, каждый не короче 32 байт согласно текущему контракту. Остальные значения в образце соответствуют Compose defaults. В частности, `BFF_GATEWAY_ADDRESS` по умолчанию указывает на gateway внутри Compose-сети, а `BFF_REDIS_CONNECTION_STRING` — на `bff-redis`.

Если задаёте `OIDC_ISSUER_URL`, это issuer legacy group-токенов, а не BFF Authority. Настройки внешнего IdP и BFF client заранее не создаются и должны быть предоставлены оператором. Account настраивается в `config/account/accounts.json` через `Oidc.Providers` (issuer и audiences); BFF — в `config/bff/appsettings.json` через `Oidc.Authority`, `Oidc.ClientId`, `Oidc.ClientSecret` и `Bff.ClientAuthentication`. Пользовательские поля Keycloak — внешний контур и в этот Compose не входят.

Entrypoints Account и BFF создают соответствующие JSON-файлы из templates внутри образов при запуске контейнеров. `config/account/accounts.json` появится, когда запустится Account; пока Account provider пуст, сервис может не пройти startup validation и блокировать зависящие сервисы. `config/bff/appsettings.json` появится при запуске BFF. Нет гарантии, что оба файла созданы после одного незавершившегося первого запуска. Файлы можно заранее подготовить или редактировать обычным редактором.

Каталоги данных, конфигурации, ключей и логов располагаются рядом с Compose-файлом и создаются bind mounts или entrypoints. Для нескольких экземпляров используйте разные каталоги и значения `COMPOSE_PROJECT_NAME`, `GATEWAY_PORT` и `BFF_PORT` в их `.env`. Compose самостоятельно изолирует project-scoped ресурсы; здесь нет фиксированного имени проекта, `container_name` или named volumes.

`certs/private.pem` и `certs/public.pem` — входные файлы конфигурации для сценариев с legacy group-токенами. Этот комплект не генерирует и не меняет ключи. При переносе данных, зависящих от legacy-токенов, сохраните соответствующую пару ключей; без неё работа таких сценариев не гарантируется.

MySQL выполняет init-скрипты при пустом `data/mysql`. Существующая база не переинициализируется, а изменение паролей в `.env` само по себе не меняет пароли уже существующих пользователей базы.

Запуск и остановка выполняются из каталога установки:

```sh
docker compose up -d
docker compose down
```
