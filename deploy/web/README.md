# Переносимый Web

Переносимый каталог содержит `docker-compose.yaml` и `.env.example`; исходники и checkout не требуются. Compose запускает пять готовых images: `tdn-campaign:latest`, `tdn-profile:latest`, `tdn-login:latest`, `tdn-hub:latest` и `tdn-web-proxy:latest`. До запуска доставьте их на Docker host, включая proxy image. Собрать комплект из checkout можно командой `make build-web`; Compose в этом каталоге не собирает images и не монтирует исходники. `APP_PULL_POLICY` сохраняет управление pull behavior, по умолчанию `never`.

Создайте `.env`, не перезаписывая уже существующий файл:

```sh
test -e .env || cp .env.example .env
docker compose config
docker compose up -d
```

Runtime состоит из `campaign`, `profile`, `login`, `hub` и `nginx`. Только nginx публикует `${WEB_PORT:-3004}:80`; Hub и remotes доступны nginx по внутренним service DNS names и порту 3000. Hub — Node `serve`, не Nginx. Порты 3000/3002/3003 относятся к локальным Vite previews, а не к опубликованным Docker remote ports. `WEB_BASE_PATH` и `WEB_CAMPAIGN_PATH`/`WEB_PROFILE_PATH`/`WEB_LOGIN_PATH` задают public routes; `WEB_*_UPSTREAM` задают internal origins, `WEB_DNS_RESOLVER` — resolver Nginx. Полный runtime env contract и пример external Nginx с сохранением path prefix описаны в [Web README](../../apps/web/README.md).

Proxy при старте генерирует `config.json` и Nginx routing из этого же env-набора. Browser config содержит `BFF_BASE`, `API_BASE`, `BASE_PATH` и публичные `REMOTES`, но не internal upstream addresses. `BFF_BASE` и `API_BASE` должны быть URL, доступными браузеру; gateway не проксирует BFF. `localhost` в BFF defaults означает компьютер пользователя, поэтому для серверного deployment укажите публичный hostname и настройте backend/BFF `PublicOrigin` и `AllowedOrigins` на внешний Web origin без path. TLS завершает отдельный external Nginx пользователя.

Смена `.env` требует пересоздать только proxy container, без rebuild images:

```sh
docker compose up -d --force-recreate nginx
```

Изменение base/remote paths не требует пересборки Hub/remotes. Миграция со старой схемы требует однократно собрать и доставить новые Hub, campaign, profile, login и proxy images; старые images сами не приобретают runtime routing. `WEB_PORT` заменяет старые `HUB_PORT` и remote host-port settings; `VITE_BASE`/`VITE_REMOTE_*` build args больше не задают deployment paths. Перенесите эти настройки в runtime `.env`. Source `apps/web/template.env` и этот переносимый `.env.example` — разные шаблоны, автоматически друг в друга не копируются и не перезаписываются.

BFF/backend и IdP запускаются отдельно. Callback BFF и OIDC logout настройки не меняются этим комплектом. Если logout должен вернуть пользователя под prefix, BFF `Oidc.SignedOutRedirectUri` задаётся отдельно, например `/notebook/login`. Подробнее — в [README BFF](../../apps/bff/web/README.md).
