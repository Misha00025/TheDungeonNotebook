# Локальная валидация JWT в api-gateway

## Мотивация

Сейчас gateway валидирует JWT через HTTP-вызов auth-service (`GET /auth/check`). Это добавляет latency и связность: если auth упал — gateway не принимает ни один запрос. При этом все C# сервисы уже используют локальную валидацию через RSA public key.

## Изменения

### 1. Gateway загружает публичный ключ при старте

- Новая env: `PUBLIC_KEY_PATH` — путь к PEM-файлу с RSA public key
- Default: `certs/public.pem` (монтируется volume в docker-compose)
- Загрузка при старте приложения в `app/__init__.py`

### 2. Замена `/auth/check` на локальную валидацию в pipeline

В `pipeline.py` функция `_validate_jwt`:
- Вместо `auth_client.get("/auth/check")` — локальная верификация через `PyJWT`
- Используется загруженный RSA public key
- Алгоритм: `RS256`
- Если ключ не загружен — падать с ошибкой при старте (fail fast)

### 3. Убрать auth из routes.yaml

- Удалить `services: auth` из `routes.yaml`
- Удалить прокси-роуты `/auth/*` (они уходят напрямую через Nginx)
- При необходимости: добавить хендлер `whoami`, который читает `ctx.jwt` и возвращает userId

### 4. Обновить docker-compose

- `PUBLIC_KEY_PATH=/certs/public.pem` в api-gateway
- Volume `./certs:/certs` в api-gateway (уже есть в auth, но gateway его не монтировал)

### 5. Тесты

- Тесты генерируют RSA-пару при старте (через `cryptography`)
- Пишут в `tests/certs/public.pem` и `tests/certs/private.pem`
- Volume монтируется в тестовый gateway
- Тесты подписывают JWT тестовым private key

## Зависимости gateway

- `PyJWT` — уже есть
- `cryptography` — добавить в `req.txt` (нужна для загрузки PEM)
