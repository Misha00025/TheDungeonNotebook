# Web workspace TDN

Внутренний workspace Web использует Vite, React, TypeScript и npm workspaces. Hub — единственная браузерная точка входа. Campaign, profile и login подключаются к Hub как Module Federation remotes; game-systems также собирается как remote, но отключён в Hub и Compose. Remote-сборки не содержат отдельного HTML-приложения.

## Установка, тесты и сборка

Команды выполняются из корня репозитория:

```bash
cp apps/web/template.env apps/web/.env
npm ci --prefix apps/web
npm --prefix apps/web run test:run
npm --prefix apps/web run build --workspaces --if-present
make check-web
```

`npm --prefix apps/web run test` запускает тесты workspaces в watch-режиме, `test:run` — однократный запуск тестов во всех workspaces с такой командой. Также доступны `make web-test`, `make web-build` и `make check-web`.

## Локальный Hub и статические remote previews

Hub Vite запускается на `http://localhost:3004`. Для remote сначала запустите сборку в watch-режиме, а во втором терминале — preview, который раздаёт файлы federation:

```bash
npm --prefix apps/web run dev --workspace @tdn/campaign
npm --prefix apps/web run preview --workspace @tdn/campaign

npm --prefix apps/web run dev --workspace @tdn/profile
npm --prefix apps/web run preview --workspace @tdn/profile

npm --prefix apps/web run dev --workspace @tdn/login
npm --prefix apps/web run preview --workspace @tdn/login

npm --prefix apps/web run dev --workspace @tdn/hub
npm --prefix apps/web run build --workspace @tdn/hub
npm --prefix apps/web run preview --workspace @tdn/hub
```

| Remote | Preview origin | Federation entry |
| --- | --- | --- |
| campaign | `http://localhost:3000` | `http://localhost:3000/assets/remoteEntry.js` |
| game-systems | `http://localhost:3001` | `http://localhost:3001/assets/remoteEntry.js` |
| profile | `http://localhost:3002` | `http://localhost:3002/assets/remoteEntry.js` |
| login | `http://localhost:3003` | `http://localhost:3003/assets/remoteEntry.js` |

Preview remotes раздают только federation entry/assets, не standalone интерфейс. Game-systems отключён в Hub и в общем Docker Compose. URL remoteEntry из `template.env.build` / `VITE_REMOTE_*` — параметры сборки Hub; они не задают API runtime config.

Hub Vite preview использует стандартный порт Vite Preview `4173`; приведённая ниже конфигурация `PublicOrigin` для локальной разработки относится к Hub dev на `3004`. Для другого browser origin значения `PublicOrigin` и `AllowedOrigins` должны соответствовать фактическому Hub origin.

Для Vite Hub вручную скопируйте безопасный шаблон и настройте локальный файл:

```bash
cp apps/web/template.config.json apps/web/public/config.json
```

Hub загружает `public/config.json` относительно Vite base URL. Задайте `BFF_BASE` (по умолчанию `http://localhost:5080/bff`) и `API_BASE` (по умолчанию `http://localhost:5080/bff/api`). `public/config.json` игнорируется Git и Docker; агент и сборка его не создают. Для локального same-site запуска используйте одинаковую схему для Web и BFF: HTTP с HTTP либо HTTPS с HTTPS. Vite proxy не используется.

## Docker runtime

`apps/web/.env` передаёт `BFF_BASE` и `API_BASE` только Hub. При первом старте Hub создаёт `build/config.json`, только если такого файла ещё нет; отсутствующий `API_BASE` выводится из `BFF_BASE`. Имеющийся файл не перезаписывается. Remotes не загружают runtime config и раздают статические federation файлы с CORS.

Общий Compose по умолчанию публикует campaign на порту 3000, profile на 3002, login на 3003 и Hub на 3004. Game-systems в нём выключен. `make build-web` собирает Web-образы, `make run-web` запускает настроенные Compose-сервисы.

## BFF, вход и профиль

Hub проверяет BFF session и передаёт cookie-based transport remotes. Вход в IdP и профиль TDN — разные шаги: после первого входа может потребоваться создать профиль TDN. Вход выполняется browser redirect через BFF с возвратом на текущий локальный путь. Logout завершает локальную BFF session, но не выполняет SSO logout в IdP.

Для локального Hub укажите в конфигурации BFF `Bff:Web:PublicOrigin=http://localhost:3004` и `Bff:Web:AllowedOrigins[0]=http://localhost:3004`. Если callback ещё не добавлен в IdP, используйте `http://localhost:5080/bff/callback`. Пользователь задаёт эти настройки сам.

Web отправляет cookie credentials и CSRF token в header, имя которого сообщает BFF; CSRF применяется к unsafe запросам. API `Response` возвращается вызывающему сервису без автоматического повтора. При доступе по сетевому имени укажите browser-reachable hostname вместо `localhost` согласованно в `BFF_BASE`/`API_BASE`, `PublicOrigin` и `AllowedOrigins`; для same-site Web и BFF должны использовать одну схему HTTP/HTTPS. `localhost` в браузере обозначает компьютер пользователя.

## Документация API

[Публичная HTML-документация](../../docs/api/index.html)
