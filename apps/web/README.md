# Web workspace TDN

Hub — единственная браузерная точка входа; campaign, profile и login загружаются как Module Federation remotes. Runtime routing и browser config обслуживает отдельный `nginx` service из образа `tdn-web-proxy:latest`. Hub остаётся Node `serve`; Nginx не встроен в его образ.

## Запуск из исходников

Из корня репозитория:

```bash
test -e apps/web/.env || cp apps/web/template.env apps/web/.env
npm ci --prefix apps/web
make build-web
make run-web WEB_ENV=.env
```

`make build-web` собирает Hub, три активных remotes, proxy и образ game-systems из существующего build catalog; game-systems не включён в runtime Compose или Hub. `make run-web` использует `apps/web/.env` по умолчанию через `WEB_ENV`; автоматического копирования env-файла нет. `WEB_BUILD_ENV` относится только к сборке и сохранён для совместимости; `apps/web/template.env.build` больше не задаёт deployment values.

Runtime Compose содержит campaign, profile, login, hub и nginx. Только nginx публикует `${WEB_PORT:-3004}:80`; остальные контейнеры доступны только во внутренней сети Compose на порту 3000. Порты 3000, 3002 и 3003 относятся к локальным Vite remote preview-процессам, а не к опубликованным Docker-портам.

## Runtime environment

Заполните `.env` перед запуском. Source template — `apps/web/template.env`, переносимый пример — `deploy/web/.env.example`.

| Variable | Default | Назначение |
| --- | --- | --- |
| `WEB_PORT` | `3004` | Порт хоста, опубликованный nginx на container port 80 |
| `WEB_BASE_PATH` | `/` | Публичный base path, например `/notebook/` |
| `WEB_CAMPAIGN_PATH` | `/remotes/campaign/` | Remote path suffix ниже base path |
| `WEB_PROFILE_PATH` | `/remotes/profile/` | Remote path suffix ниже base path |
| `WEB_LOGIN_PATH` | `/remotes/login/` | Remote path suffix ниже base path |
| `WEB_HUB_UPSTREAM` | `http://hub:3000` | Внутренний Hub origin |
| `WEB_CAMPAIGN_UPSTREAM` | `http://campaign:3000` | Внутренний campaign origin |
| `WEB_PROFILE_UPSTREAM` | `http://profile:3000` | Внутренний profile origin |
| `WEB_LOGIN_UPSTREAM` | `http://login:3000` | Внутренний login origin |
| `WEB_DNS_RESOLVER` | `127.0.0.11` | Resolver для Nginx; допустим список адресов |
| `BFF_BASE` | `http://localhost:5080/bff` | BFF URL, доступный браузеру |
| `API_BASE` | пусто в Compose | API URL, доступный браузеру; пустое значение выводится как `${BFF_BASE}/api` |

Remote path values — локальные slash-delimited suffix paths, которые gateway присоединяет к `WEB_BASE_PATH`. Upstream values — HTTP(S) origins внутренних static services. Их DNS-имена не попадают в browser config. BFF не проксируется этим gateway: `BFF_BASE` и `API_BASE` должны содержать публично доступные браузеру URL. Значение `localhost` по умолчанию удобно только там, где BFF действительно доступен на компьютере пользователя; на сервере настройте browser-reachable hostname. Публичный BFF hostname и backend-конфигурацию пользователь настраивает отдельно.

## Gateway и runtime config

При старте proxy generator из одного набора runtime env создаёт `/app/runtime/config.json` и Nginx config. Browser JSON содержит только `BFF_BASE`, `API_BASE`, `BASE_PATH` и `REMOTES` с публичными remote entry paths; internal upstream addresses туда не входят. `config.json` отдаётся с `Cache-Control: no-store`.

Hub загружает `config.json` относительно `document.baseURI`, регистрирует remotes до рендера приложения и использует `BASE_PATH` как Router basename. Hub собран с `base: './'`; три remotes используют нейтральный Vite `base: '/'` и `experimental.renderBuiltUrl` для относительных JS/CSS asset URLs, не меняя URL `remoteEntry.js` или расположение файлов в `assets/`. Gateway заменяет нейтральный `<base href="/">` Hub HTML; compiled JS/CSS не патчатся. Deployment paths и remote URLs не задаются через build-time `VITE_BASE`/`VITE_REMOTE_*`, и localhost entry fallback нет. При сетевой ошибке браузер всё равно видит публичный URL assets, но Hub показывает только общее сообщение без raw exception или entry address.

Каждая campaign/profile/login build после сборки запускает VM-based checker: он проверяет emitted JS imports и CSS links относительно трёх public base URL и подтверждает наличие файлов в build directory без сети и запуска browser. Checker также можно запустить на имеющихся build artifacts:

```bash
node --experimental-vm-modules apps/web/scripts/check-remote-assets.mjs [campaign|profile|login]
```

При изменении `.env` пересоздайте только proxy container, без пересборки образов:

```bash
cd apps/web
docker compose --env-file .env up -d --force-recreate nginx
```

Изменение `WEB_BASE_PATH` или remote paths меняет маршруты и browser config, но не требует пересборки образов. Существующие `.env`, `.env.build` и `public/config.json` автоматически не перезаписываются; старые `VITE_*` значения из `.env.build` больше не задают deployment routes. Старый Hub `build/config.json`, создаваемый entrypoint, не является runtime config, который использует браузер за gateway.

## Внешний Nginx и TLS

На сервере внешний Nginx пользователя завершает TLS и проксирует трафик на опубликованный proxy container. Для root deployment:

```nginx
location / {
    proxy_pass http://127.0.0.1:3004;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Для `WEB_BASE_PATH=/notebook/` используйте `location /notebook/` с тем же `proxy_pass http://127.0.0.1:3004;` без URI и с теми же forwarded headers: исходный prefix должен сохраниться до gateway. Контейнер не подменяет исходную HTTPS scheme на внутренний HTTP. TLS и сертификаты остаются настройкой уже существующего внешнего Nginx.

## Локальная Vite-разработка

Для локального Hub вручную создайте `apps/web/public/config.json`, только если файла ещё нет:

```bash
test -e apps/web/public/config.json || cp apps/web/template.config.json apps/web/public/config.json
```

Настройте в нём browser-reachable `BFF_BASE`/`API_BASE` и три `REMOTES`; старый config без `REMOTES` приводит к безопасному config failure. Это ручной локальный файл, он игнорируется и не создаётся сборкой. Hub dev proxy направляет `/remotes/campaign/`, `/remotes/profile/` и `/remotes/login/` на локальные preview origins; его `WEB_*_UPSTREAM` overrides относятся к Vite config, не к production browser bundle.

Для каждого remote запустите watch-сборку и preview в отдельных терминалах из корня репозитория:

| Remote | Terminal 1: watch build | Terminal 2: preview | Local preview port |
| --- | --- | --- | --- |
| campaign | `npm --prefix apps/web run dev --workspace @tdn/campaign` | `npm --prefix apps/web run preview --workspace @tdn/campaign` | 3000 |
| profile | `npm --prefix apps/web run dev --workspace @tdn/profile` | `npm --prefix apps/web run preview --workspace @tdn/profile` | 3002 |
| login | `npm --prefix apps/web run dev --workspace @tdn/login` | `npm --prefix apps/web run preview --workspace @tdn/login` | 3003 |

Hub Vite dev server запускается отдельно на локальном порту 3004:

```bash
npm --prefix apps/web run dev --workspace @tdn/hub
```

Эти порты предназначены для локальных dev/preview процессов и не публикуются Docker remote containers. Hub Preview при запуске на стандартном порту Vite 4173 имеет другой browser origin; BFF `PublicOrigin` и `AllowedOrigins` должны соответствовать фактическому Hub origin.

Unit verification commands:

```bash
node --test apps/web/proxy/generate.test.mjs
node --experimental-vm-modules --test apps/web/scripts/check-remote-assets.test.mjs
python3 -m unittest discover -s tests -p test_web_deployment.py
npm --prefix apps/web run test:run --workspace @tdn/hub
npm --prefix apps/web run test:run --workspace @tdn/shared
npm --prefix apps/web run build --workspace @tdn/hub
```

Эти команды перечислены как способы проверки; результаты запусков здесь не заявляются.

## BFF и вход

Hub владеет BFF session и передаёт cookie-based transport remotes. Для BFF настройте `Bff:Web:PublicOrigin` и `Bff:Web:AllowedOrigins` на фактический browser origin без path. Если logout после gateway prefix должен вернуть пользователя под prefix, задайте `Oidc.SignedOutRedirectUri=/notebook/login` самостоятельно. Зарегистрируйте в IdP login callback BFF `/bff/callback` и post-logout callback BFF `/bff/signout-callback`, не конечный Web `/login`. BFF/backend config и callbacks не изменяются Web gateway. Подробности — в [README BFF](../bff/web/README.md).

## Документация API

[Публичная HTML-документация](../../docs/api/index.html)

## Каталог кампании

В пространствах мастера и игрока доступен общий каталог кампании: вкладки «Предметы» (`/gm/catalog/items`, `/player/catalog/items`) и «Навыки» (`/gm/catalog/skills`, `/player/catalog/skills`). Вход по `/gm/catalog` или `/player/catalog` перенаправляет на вкладку предметов соответствующего пространства. Каждая вкладка показывает доступные пользователю записи своего типа, сгруппированные по общим группам; записи без членства отображаются в разделе «Без группы». Атрибуты отображаются компактными тегами, повторяющиеся атрибуты объединяют значения, а содержимое для них читается по мере раскрытия разделов. В каталоге запись, входящая в несколько групп одной ветки, показывается в наиболее глубокой из них; способ включения не влияет. Между независимыми ветками повторения сохраняются. Это правило отображения Web, конфигурация и серверные составы групп не меняются. Поиск действует по всему каталогу текущей вкладки. Разделы изначально свёрнуты, их можно раскрывать по отдельности или компактной командой раскрыть/свернуть все. Ведущий с правом записи управляет общими записями, схемой атрибутов и конфигурацией групп; автор записи может менять её метаданные и содержимое. Для просмотра содержимого выбранной записи оно загружается отдельно.

В листе персонажа мастера также есть отдельные сервисные вкладки «Инвентарь» и «Навыки» (`/gm/characters/:characterId/inventory` и `/gm/characters/:characterId/skills`). Они показывают прикреплённые к персонажу личные записи независимо от наличия настроенных игровых страниц и позволяют выполнять доступные действия с записями согласно подтверждённым правам персонажа. Игрокские маршруты и вкладки этих сервисов пока не подключены; они не являются вкладками общего каталога кампании.
