# Переносимый Web

В каталоге достаточно `docker-compose.yaml` и, если нужны настройки, `.env`, созданного вручную по образцу `.env.example`. Папку можно перенести на Docker host отдельно от репозитория: исходники и checkout не нужны. Compose использует только готовые образы `tdn-campaign:latest`, `tdn-profile:latest`, `tdn-login:latest` и `tdn-hub:latest`; до запуска они должны быть доступны Docker host. Их можно доставить через `docker load` или собрать заранее вне переносимого каталога. Compose ничего не собирает и не публикует.

По умолчанию `APP_PULL_POLICY=never` использует локальные образы. Оператор может выбрать другую поддерживаемую Docker Compose pull policy через `.env`; registry этим комплектом не предполагается. Стандартные готовые образы для переносимого запуска собираются с base `/` и согласованными remote URLs. Пользовательский build env может переопределять значения шаблона; старые образы не обновятся без пересборки, а применённые контейнеры пользователь должен пересоздать.

При необходимости скопируйте образец, не перезаписывая существующий файл, затем настройте его вручную:

```sh
test -e .env || cp .env.example .env
docker compose config
docker compose up -d
docker compose down
```

Без `.env` используются defaults Compose. `BFF_BASE` — адрес BFF, доступный браузеру, а не Docker container DNS; `API_BASE` можно оставить пустым, тогда entrypoint Hub выведет его как `BFF_BASE/api`. Порты публикации настраиваются через `CAMPAIGN_PORT`, `PROFILE_PORT`, `LOGIN_PORT` и `HUB_PORT`.

BFF/backend и IdP запускаются отдельно. Для локального HTTP Web и BFF должны использовать один hostname и схему, например `localhost`, при разных портах. В конфигурации уже запущенного BFF задайте `Bff.Web.PublicOrigin=http://localhost:3004` и `AllowedOrigins=['http://localhost:3004']`. Для `deploy/backend` это `config/bff/appsettings.json` рядом с backend Compose-файлом, не путь к исходникам. Этот комплект не читает и не меняет эти файлы. IdP должен иметь login callback BFF `/bff/callback` и точный post-logout callback BFF `/bff/signout-callback` (не конечный Web `/login`); существующую конфигурацию здесь не изменяют. Подробнее — в [README BFF](../../apps/bff/web/README.md).

Hub — единственный UI. Campaign, profile и login на портах 3000, 3002 и 3003 предоставляют статические remote assets, а не самостоятельные приложения. Опубликованные remote URLs внутри готового Hub image задаются при его сборке. Смена remote-портов или hostname требует уже собранного Hub image с согласованными federation URLs. Runtime `.env` меняет `BFF_BASE`, `API_BASE` и host-порты, но не `VITE_REMOTE_*` и `VITE_BASE`, встроенные в образ.

Перенос папки не требует путей к `apps/` и не затрагивает backend-данные. В комплект не входят TLS/nginx, IdP, Redis или backend-сервисы.
