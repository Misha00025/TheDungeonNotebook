# BFF Web

ASP.NET Core 10 BFF: вход OIDC Authorization Code + PKCE, серверное хранение cookie-ticket в Redis, привязанный к сессии antiforgery и обновление токена по требованию. YARP проксирует запросы в Gateway. Доменная логика, пользовательский профиль, политика прав и браузерный интерфейс сюда не входят; маршруты и адреса Gateway задаются нативной конфигурацией YARP.

## Требования и локальный запуск

Нужны .NET 10 SDK, OIDC-провайдер и Gateway. Основной Compose запускает отдельный Redis для BFF; при прямом `dotnet run` Redis должен быть доступен хост-процессу отдельно.

Из корня репозитория:

```sh
cd apps/bff/web
Oidc__ClientSecret='<client-secret-from-your-IdP>' \
ReverseProxy__Clusters__gateway__Destinations__gateway__Address=http://localhost:5000/ \
dotnet run --no-launch-profile --urls http://localhost:5080
```

Пример конфигурации указывает на Redis `localhost:6379` для host-запуска и содержит примерный OIDC URL `http://localhost:8080/realms/tdn-example`; это не готовые параметры входа. Container Gateway default — `http://api-gateway:5000/`. Основной и standalone Compose передают соответствующий Gateway address через `BFF_GATEWAY_ADDRESS`, поэтому менять его для штатного main запуска не требуется. Для другого backend topology переопределите `BFF_GATEWAY_ADDRESS`; при прямом host `dotnet run` используйте показанный выше localhost override, поскольку имя `api-gateway` на хосте обычно не разрешается. Задайте реальные `Oidc:Authority`, `Oidc:ClientId`, `Oidc:ClientSecret` и `Bff:ClientAuthentication` через конфиг или стандартные environment overrides. Запрашивается scope `offline_access`; выдача refresh token зависит от настроек IdP и его клиента.

Для host-примера зарегистрируйте в IdP точный callback URI `http://localhost:5080/bff/callback`. Для Compose callback должен использовать доступный браузеру адрес BFF, например `http://<BFF-host>:5080/bff/callback`. Прямой HTTP не требует nginx или сертификата. HTTPS метаданных IdP и HTTP/HTTPS listener самого BFF — независимые настройки.

Login принимает локальные адреса для перехода, в том числе с query и fragment:

```text
/bff/login
/bff/login?returnUrl=%2Fcampaigns%3Ftab%3Dactive%23notes
/bff/login?returnUrl=~%2Fgroups%3Fsort%3Dname%23recent
```

Для HTTPS listener используйте штатную настройку сертификата Kestrel, например:

```sh
ASPNETCORE_Kestrel__Certificates__Default__Path=/path/to/dev-certificate.pfx \
ASPNETCORE_Kestrel__Certificates__Default__Password="$KESTREL_CERT_PASSWORD" \
Cookie__Cookie__SecurePolicy=Always \
Oidc__RequireHttpsMetadata=false \
dotnet run --no-launch-profile --urls https://localhost:5443
```

Задайте `Oidc__RequireHttpsMetadata` в соответствии со схемой URL метаданных IdP: `false` для локального HTTP IdP, `true` для HTTPS. Эта настройка не управляет listener BFF. Для HTTPS callback с `form_post` задайте `Oidc__ResponseMode=form_post`, `Oidc__CorrelationCookie__SameSite=None`, `Oidc__NonceCookie__SameSite=None`, `Oidc__CorrelationCookie__SecurePolicy=Always` и `Oidc__NonceCookie__SecurePolicy=Always`. HTTP query-mode defaults используют `SameSite=Lax` и `SameAsRequest`.

## Runtime-конфигурация

`config/appsettings.json` — пример без действительных credentials. После него загружается необязательный `config/appsettings.{Environment}.json`; переменные окружения и аргументы командной строки имеют более высокий приоритет. Используются стандартные имена конфигурации .NET, например `Oidc__ClientSecret`, `Bff__Redis__ConnectionString` и `ReverseProxy__Clusters__gateway__Destinations__gateway__Address`. Вместо этого можно подключить или заменить `config/appsettings.json`; изменения конфигурации не требуют изменения кода или пересборки.

### Основной запуск с backend

Из корня репозитория используйте основной runtime Compose:

```sh
make build SERVICE=bff-web
make run-backend
```

`make run-backend` запускает существующий backend Compose, включая `bff-web` и отдельный `bff-redis`. BFF подключён к `api-gateway` через общую `backend-network` и к своему Redis через частную BFF-сеть; вручную подключать Docker-сети не нужно. BFF публикуется на `http://localhost:${BFF_PORT:-5080}`. Этот runtime wiring не переключает Web на BFF.

По умолчанию main Compose монтирует конфигурацию с `../bff/web/data/config` и key ring с `../bff/web/data/keys` относительно `apps/backend`; `bff-redis` хранит данные в `../bff/web/data/redis`. Все три пути указывают на соответствующие каталоги `apps/bff/web/data/`. При первом старте entrypoint создаёт `apps/bff/web/data/config/appsettings.json` из стандартной копии, только если host-файл отсутствует; существующая конфигурация не перезаписывается.

Main Compose намеренно передаёт `BFF_REDIS_CONNECTION_STRING` и `BFF_GATEWAY_ADDRESS` поверх JSON: defaults направляют BFF к `bff-redis:6379` и `api-gateway:5000`, поэтому сохранённый config с `localhost` не ломает контейнерное подключение. Для другого Gateway задайте `BFF_GATEWAY_ADDRESS`; env override имеет приоритет над JSON. Изменения переменных Compose требуют пересоздания BFF, например `docker compose -f apps/backend/docker-compose.yaml up -d bff-web`; для изменений host JSON достаточно `docker compose -f apps/backend/docker-compose.yaml restart bff-web`.

### Внешний OIDC-провайдер

Значения OIDC в `config/appsettings.json` — только примеры. Keycloak bundle из `scripts/setup-keycloak.sh` создаёт realm `shared-local`, но не регистрирует BFF client. Настройте внешний OIDC client для Authorization Code + PKCE S256, выберите его client authentication и задайте реальные client ID/secret; регистрация клиента автоматически не выполняется. `Authority` должен быть настоящим URL issuer, доступным и браузеру, и BFF. Если используется Keycloak, установленный штатным setup script, возьмите базовый URL, напечатанный установщиком, и добавьте `/realms/shared-local`; не используйте `localhost` внутри контейнера или внутреннее имя, недоступное браузеру.

Точный redirect URI должен соответствовать адресу BFF, например `http://<BFF-host>:5080/bff/callback`. Issuer должен совпадать с настроенным `Oidc:Providers[*].Issuer` Account service, а audience access token — входить в настроенный список `Audiences`. Не путайте audience ID token (обычно client ID) с audience access token, который проверяет API. Сведения о существующей конфигурации Account service и prerequisites backend см. в [README Account service](../../backend/account-service/README.md) и [корневом README](../../../README.md); реальные env values здесь не дублируются. Указанные предусловия не означают, что примерный config обеспечивает end-to-end вход.

Штатный YARP route принимает `/bff/api/{**remainder}` и удаляет префикс `/bff/api` перед отправкой. Например, `GET /bff/api/groups?x=1` уходит в Gateway как `GET /groups?x=1`. YARP передаёт body потоком: JSON, form и multipart не преобразуются. Request/response headers пересылаются только если указаны в `Bff:Transport:RequestHeaders` и `Bff:Transport:ResponseHeaders`. Обязательные browser credentials, identity headers и настроенный CSRF header блокируются независимо от allowlist. В примере указаны распространённые API headers; список можно расширять через конфигурацию.

В YARP 2.3.0 автоматическое следование upstream redirects выключено по умолчанию. Адрес назначения задаётся на сервере, клиент не выбирает URL. Status и body Gateway передаются без обработки; response headers и trailers фильтруются allowlist. Ошибки BFF включают `401 authentication_required`, `403` при запрете доступа, `400 csrf_invalid` и `503 dependency_unavailable`; транспортные ошибки YARP могут дать `502` или `504`. Kestrel, лимиты body и параметры YARP настраиваются штатными средствами этих компонентов.

## Сессия и CSRF

`GET /bff/session` возвращает только `authenticated`, `csrfToken` и `csrfHeaderName`; claims, OAuth tokens и серверный session key не выдаются. Session cookie имеет `HttpOnly=true`. Для unsafe-запросов к `/bff/api` и `POST /bff/logout` передавайте полученный токен в указанном header (по умолчанию `X-CSRF-TOKEN`). Logout завершает только локальную BFF-сессию и не вызывает IdP/SSO logout. Завершение сессии на IdP само по себе не завершает уже созданную BFF-сессию.

Redis tickets защищены ASP.NET Core Data Protection; key ring не хранится в Redis с tickets. Для нескольких BFF instances нужен общий key ring; при необходимости защищайте его штатными средствами Data Protection. `Bff:DataProtection:KeyDirectory` необязателен. Compose подключает key ring через host bind mount: `BFF_KEY_DIRECTORY` задаёт путь, по умолчанию `./data/keys` относительно `compose.yaml`.

Основной рекомендуемый способ выше использует backend Compose. Дополнительный standalone Compose предназначен только для подключения BFF к уже существующей backend-сети:

```sh
docker compose -f apps/bff/web/compose.yaml up --build
```

По умолчанию он использует внешнюю сеть `backend_backend-network`; при другом Compose project name задайте `BFF_BACKEND_NETWORK` с фактическим именем backend network. BFF подключается к ней и к своей default-сети, а его Redis остаётся только в default-сети. Не запускайте standalone вариант одновременно с основным BFF на том же host port и bind-путях. Ручной `docker network connect` не требуется.

Оба варианта Compose используют те же три host-каталога `apps/bff/web/data/{config,keys,redis}`. В main Compose defaults заданы относительно `apps/backend`, в standalone — относительно `apps/bff/web/compose.yaml`. При необходимости пути задаются переменными `BFF_CONFIG_DIRECTORY`, `BFF_KEY_DIRECTORY`, `BFF_REDIS_DATA_DIRECTORY`; `BFF_REDIS_APPENDONLY` выбирает append-only persistence, `BFF_REDIS_CONNECTION_STRING` и `BFF_GATEWAY_ADDRESS` переопределяют адреса подключения. Подготовьте каталоги до запуска:

```sh
mkdir -p apps/bff/web/data/config apps/bff/web/data/keys apps/bff/web/data/redis
```

При первом старте entrypoint копирует стандартный `/app/default-config/appsettings.json` в `/app/config/appsettings.json`, только если host-конфигурация отсутствует. Копирование не перезаписывает существующий файл; реальные secrets не генерируются. Редактируйте конфигурацию на host-пути `apps/bff/web/data/config/appsettings.json`; для применения изменений перезапустите BFF. Код и образ пересобирать не нужно. Каталоги должны быть доступны контейнерному пользователю для нужных операций; если переопределяете user контейнера, обеспечьте ему права записи на соответствующие host paths.

При первой настройке нужно задать реальные OIDC Authority/ClientId/ClientSecret и client authentication; без настроенного IdP-вход не заработает. Gateway destination уже связан с `api-gateway:5000` в штатном Compose и не требует замены; для другого Gateway задайте `BFF_GATEWAY_ADDRESS`, который в Compose имеет приоритет над JSON. Secrets можно передать нативными переменными окружения через Compose override или Docker CLI; отдельный secret-файл не обязателен.

### Прямой host-запуск и Redis

Для прямого host `dotnet run` требуется Redis, доступный хост-процессу по адресу из `Bff:Redis:ConnectionString`. Redis из Compose не публикует host port: чтобы использовать именно его с локальным процессом .NET, заранее опубликуйте Redis-порт отдельным Compose override и укажите опубликованный адрес в connection string. OIDC values/secrets остаются в mounted JSON или стандартных environment overrides; отдельный secret-файл не обязателен.

Предусмотренный scope автоматизированной проверки — unit tests. Этот README не утверждает, что проводились браузерные или end-to-end проверки.
