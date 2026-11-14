# BFF Web

ASP.NET Core 10 BFF: вход OIDC Authorization Code + PKCE, серверное хранение cookie-ticket в Redis, привязанный к сессии antiforgery и обновление токена по требованию. YARP проксирует запросы в Gateway. Доменная логика, пользовательский профиль, политика прав и браузерный интерфейс сюда не входят; маршруты и адреса Gateway задаются нативной конфигурацией YARP.

## Требования и локальный запуск

Нужны .NET 10 SDK и доступные Redis, OIDC-провайдер и Gateway. В локальном `dotnet run` Redis должен быть доступен отдельно; для Compose Redis входит в состав сервиса, а IdP и Gateway остаются внешними.

Из корня репозитория:

```sh
cd apps/bff/web
Oidc__ClientSecret='<client-secret-from-your-IdP>' dotnet run --no-launch-profile --urls http://localhost:5080
```

Пример конфигурации указывает на Redis `localhost:6379`, OIDC-провайдер `http://localhost:8080/realms/tdn-example` и Gateway `http://localhost:5000/`. Для своих сервисов задайте `Oidc__Authority`, `Oidc__ClientId`, `Oidc__ClientSecret` и `Bff__Redis__ConnectionString`. Запрашивается scope `offline_access`; выдача refresh token зависит от настроек IdP и его клиента.

Зарегистрируйте в IdP точный callback URI: `http://localhost:5080/bff/callback`. Пример рассчитан на локальный HTTP и не требует nginx или сертификата. HTTPS метаданных IdP и HTTP/HTTPS listener самого BFF — независимые настройки.

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

Штатный YARP route принимает `/bff/api/{**remainder}` и удаляет префикс `/bff/api` перед отправкой. Например, `GET /bff/api/groups?x=1` уходит в Gateway как `GET /groups?x=1`. YARP передаёт body потоком: JSON, form и multipart не преобразуются. Request/response headers пересылаются только если указаны в `Bff:Transport:RequestHeaders` и `Bff:Transport:ResponseHeaders`. Обязательные browser credentials, identity headers и настроенный CSRF header блокируются независимо от allowlist. В примере указаны распространённые API headers; список можно расширять через конфигурацию.

В YARP 2.3.0 автоматическое следование upstream redirects выключено по умолчанию. Адрес назначения задаётся на сервере, клиент не выбирает URL. Status и body Gateway передаются без обработки; response headers и trailers фильтруются allowlist. Ошибки BFF включают `401 authentication_required`, `403` при запрете доступа, `400 csrf_invalid` и `503 dependency_unavailable`; транспортные ошибки YARP могут дать `502` или `504`. Kestrel, лимиты body и параметры YARP настраиваются штатными средствами этих компонентов.

## Сессия и CSRF

`GET /bff/session` возвращает только `authenticated`, `csrfToken` и `csrfHeaderName`; claims, OAuth tokens и серверный session key не выдаются. Session cookie имеет `HttpOnly=true`. Для unsafe-запросов к `/bff/api` и `POST /bff/logout` передавайте полученный токен в указанном header (по умолчанию `X-CSRF-TOKEN`). Logout завершает только локальную BFF-сессию и не вызывает IdP/SSO logout. Завершение сессии на IdP само по себе не завершает уже созданную BFF-сессию.

Redis tickets защищены ASP.NET Core Data Protection; key ring не хранится в Redis с tickets. Для нескольких BFF instances нужен общий key ring; при необходимости защищайте его штатными средствами Data Protection. `Bff:DataProtection:KeyDirectory` необязателен. Compose подключает key ring через host bind mount: `BFF_KEY_DIRECTORY` задаёт путь, по умолчанию `./data/keys` относительно `compose.yaml`.

Compose использует три host-каталога относительно `compose.yaml`: `BFF_CONFIG_DIRECTORY` (по умолчанию `./data/config`), `BFF_KEY_DIRECTORY` (`./data/keys`) и `REDIS_DATA_DIRECTORY` (`./data/redis`). Подготовьте их до запуска:

```sh
mkdir -p apps/bff/web/data/config apps/bff/web/data/keys apps/bff/web/data/redis
```

При первом старте entrypoint копирует стандартный `/app/default-config/appsettings.json` в `/app/config/appsettings.json`, только если host-конфигурация отсутствует. Копирование не перезаписывает существующий файл; реальные secrets не генерируются. Редактируйте конфигурацию на host-пути `apps/bff/web/data/config/appsettings.json`; для применения изменений перезапустите BFF. Код и образ пересобирать не нужно. Каталоги должны быть доступны контейнерному пользователю для нужных операций; если переопределяете user контейнера, обеспечьте ему права записи на соответствующие host paths.

При первой настройке значения конфигурации — только примеры: OIDC Authority/ClientId/ClientSecret и Gateway destination нужно заменить на реальные. Иначе вход и proxy не заработают. Secrets можно передать нативными переменными окружения через Compose override или Docker CLI; отдельный secret-файл не обязателен.

Запуск BFF и Redis через Compose из корня репозитория:

```sh
docker compose -f apps/bff/web/compose.yaml up --build
```

Compose запускает BFF и Redis; IdP и Gateway должны быть доступны отдельно и прописаны в host-конфигурации. Переменные `BFF_CONFIG_DIRECTORY`, `BFF_KEY_DIRECTORY`, `REDIS_DATA_DIRECTORY`, `REDIS_APPENDONLY`, `REDIS_CONNECTION_STRING` и `BFF_PORT` настраивают пути данных, Redis persistence/connection и опубликованный порт (по умолчанию `5080`). Другие application settings задаются в host-конфигурации либо через Compose override environment/CLI. Для обычного `dotnet run` нужен Redis, доступный хост-процессу по адресу из `Bff:Redis:ConnectionString`. Redis в Compose не публикует host port; чтобы подключить к нему локальный `dotnet run`, заранее опубликуйте Redis-порт отдельным Compose override и укажите опубликованный адрес в connection string.

Предусмотренный scope автоматизированной проверки — unit tests. Этот README не утверждает, что проводились браузерные или end-to-end проверки.
