# BFF

## Что даёт BFF

BFF даёт браузеру вход через Keycloak, хранит OAuth-токены только на сервере и обращается к API Gateway от имени вошедшего пользователя. Он обновляет access token при необходимости, защищает изменяющие запросы CSRF-проверкой и позволяет завершить локальную BFF-сессию.

BFF не содержит предметных прав и TDN-профиля. Web Hub использует endpoints BFF-сессии и передаёт cookie-based transport remotes campaign, profile и login. Вход в IdP и создание TDN-профиля — отдельные шаги.

## Единственный штатный запуск

Используется основной Compose всего backend-проекта. Он запускает BFF вместе с отдельным Redis BFF и подключает BFF к уже имеющемуся Gateway в общей Docker-сети. Ручное подключение сетей не требуется. Нужны Docker Compose, подготовленный `apps/backend/.env`, настроенный внешний Keycloak и конфигурация Account service. Требования backend и Account service описаны в [корневом README](../../../README.md) и [README Account service](../../backend/account-service/README.md).

Если `apps/backend/.env` ещё не создан, создайте его в редакторе на основе `template.env` в корне репозитория и заполните настройки основного backend. Не передавайте весь этот файл BFF и не помещайте реальные секреты в документацию.

Из корня репозитория запустите весь backend вместе с BFF:

```sh
docker compose --env-file apps/backend/.env -f apps/backend/docker-compose.yaml up -d
```

Для выключения всего backend, включая BFF:

```sh
docker compose --env-file apps/backend/.env -f apps/backend/docker-compose.yaml down
```

BFF доступен на `http://localhost:5080` по умолчанию. Для host-порта используется `BFF_PORT`.

## Первоначальный конфиг и данные

При первом старте основной Compose создаёт host-каталоги и конфиг BFF. Entrypoint копирует стандартный конфиг из образа в `apps/bff/web/data/config/appsettings.json`, только если файл ещё отсутствует. Существующий конфиг при рестарте и обновлении образа не перезаписывается.

По умолчанию используются только host bind paths:

| Данные | Каталог на хосте |
| --- | --- |
| Конфиг BFF | `apps/bff/web/data/config` |
| Ключи защиты сессий | `apps/bff/web/data/keys` |
| Данные Redis BFF | `apps/bff/web/data/redis` |

Именованных Docker volumes нет. Обычное выключение Compose не удаляет эти каталоги и их данные. Для настройки откройте файл `apps/bff/web/data/config/appsettings.json` в редакторе. Удобный порядок: первый запуск создаёт файл, выключите Compose указанной выше командой, измените JSON и снова запустите Compose. Для обычных изменений JSON достаточно перезапустить сервис обычным циклом запуска; пересборка исходников не нужна.

Связи BFF с `api-gateway` и `bff-redis`, включая их внутренние порты, заданы основным Compose и администратору настраивать их не нужно. BFF всегда обращается к `http://api-gateway:5000/` и `bff-redis:6379,abortConnect=false`. Эти значения передаются через native environment и имеют приоритет над соответствующими полями server JSON.

Необязательные BFF-параметры в `apps/backend/.env`:

| Параметр | Значение по умолчанию |
| --- | --- |
| `BFF_PORT` | `5080` |
| `BFF_CONFIG_DIRECTORY` | `../bff/web/data/config` |
| `BFF_KEY_DIRECTORY` | `../bff/web/data/keys` |
| `BFF_REDIS_DATA_DIRECTORY` | `../bff/web/data/redis` |
| `BFF_REDIS_APPENDONLY` | `yes` |

Пути указаны относительно `apps/backend/docker-compose.yaml`; директории bind mounts можно менять для выбора места хранения. `BFF_REDIS_APPENDONLY` — настраиваемый операционный параметр Redis. Остальные параметры BFF, в частности OIDC, редактируются в host-конфигурации либо явно передаются через Compose override. `apps/backend/.env` целиком в BFF не передаётся.

## Настройка Keycloak

Настройте client в существующем realm; скрипт установки Keycloak не создаёт BFF client автоматически.

- Protocol: OpenID Connect; Client ID, например `tdn-bff`.
- Включите Client authentication и Standard flow; выключите Direct access grants, Implicit flow и Service accounts.
- Включите PKCE с методом S256.
- Добавьте точный redirect URI `http://<BFF-host>:5080/bff/callback` (если изменён `BFF_PORT`, используйте этот порт).
- Client secret возьмите из настроек этого client. Web origins для серверного BFF не нужны; global/back-channel logout не настраивается.

Если используете Keycloak из `scripts/setup-keycloak.sh`, возьмите базовый URL, напечатанный установщиком, и добавьте `/realms/shared-local`. Не используйте `localhost` внутри контейнера или адрес, недоступный браузеру: URL issuer должен быть доступен и браузеру, и BFF.

Account service проверяет issuer и audience access token согласно своей конфигурации. Issuer должен совпадать с `Oidc:Providers[*].Issuer`, а audience access token — входить в `Audiences`. Audience ID token (обычно Client ID) не заменяет audience API access token. Если провайдер не выдаёт подходящий audience, настройте отдельный client scope с Audience mapper: Included Custom Audience должен совпадать с допустимым API audience; включите добавление в access token и выключите добавление в ID token. Названия меню могут различаться между версиями Keycloak.

## Настройки OIDC в конфиге BFF

Редактируйте отдельные поля в `apps/bff/web/data/config/appsettings.json`, сохраняя остальные настройки:

| Полный путь | Значение |
| --- | --- |
| `Oidc.Authority` | Реальный URL issuer realm, например `https://sso.example.org/realms/my-realm`; не URL административной консоли и не `localhost` внутри контейнера. |
| `Oidc.ClientId` | ID настроенного BFF client, например `tdn-bff`. |
| `Oidc.ClientSecret` | Secret этого client, если выбран confidential client; не помещайте действительное значение в исходники или общий репозиторий. |
| `Oidc.CallbackPath` | `/bff/callback`; путь должен совпасть с зарегистрированным redirect URI. |
| `Oidc.RequireHttpsMetadata` | `true` для HTTPS metadata; `false` только если намеренно используется HTTP IdP. Это не настройка HTTP/HTTPS самого BFF. |
| `Oidc.Scope` | Для обычного входа достаточно `openid` и `profile`. `offline_access` необязателен для обычного refresh в Keycloak. |
| `Bff.ClientAuthentication` | `PostBody` для стандартного client secret; значение должно соответствовать настройке client в IdP. |

Примерные значения в исходном JSON не являются действительным Keycloak client или рабочей OIDC-конфигурацией. Реальные OIDC параметры можно задать в host JSON либо явным environment override Compose. Основной Compose не передаёт BFF весь `apps/backend/.env`; запись `Oidc__ClientSecret` в этот файл сама по себе не передаст secret BFF.

## Сессия и запросы

### Прямой Web с другого origin

Для подключения Web с отдельного origin поддерживаются `Bff:Web:PublicOrigin` и `Bff:Web:AllowedOrigins` в `apps/bff/web/data/config/appsettings.json`. `PublicOrigin` — доверенный абсолютный HTTP(S) origin хаба (с optional port); при входе локальный `returnUrl` после проверки перенаправляется на этот origin. Если параметр `null`, сохраняется прежний локальный redirect. `AllowedOrigins` — список точных HTTP(S) origins браузерного Web; пустой список не включает cross-origin доступ. Допускаются значения с завершающим `/`, нормализуемым при использовании.

BFF разрешает credentials, методы и заголовки запросов, в том числе настроенный CSRF header; доступ применим только к указанным origins. Из ответных заголовков доступны браузеру только значения `Bff:Transport:ResponseHeaders`. Hub Web использует этот контракт; пользователь самостоятельно задаёт реальные origins BFF и runtime URL Web.

- `GET /bff/session` показывает состояние входа и CSRF token, но не возвращает OAuth-токены, claims или ключ сессии.
- Для изменяющих запросов к `/bff/api/...` и `POST /bff/logout` передавайте CSRF token в header `X-CSRF-TOKEN`.
- `GET /bff/login?returnUrl=/bff/session` начинает вход и после возврата из Keycloak ведёт на указанный локальный адрес.
- Logout завершает только локальную BFF-сессию; он не выполняет выход из Keycloak.

Web выполняет вход перенаправлением браузера через BFF и использует cookie credentials с CSRF header для изменяющих API-запросов. Исходный API response возвращается вызывающему сервису; автоматического повтора запроса нет. Logout завершает только локальную BFF-сессию, не SSO IdP. Без настроенного Keycloak client вход не заработает. Даже успешный вход требует согласованной настройки issuer и access-token audience в Account service.
