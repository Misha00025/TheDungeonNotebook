# @tdn/shared

Общая библиотека frontend-кода для возможностей, не привязанных к отдельному домену.

## Авторизация и transport Web

`AuthProvider` создаётся в Hub и владеет BFF session bootstrap и полной моделью `AuthContextType`. Hub передаёт её remote-компонентам через обязательный `HubRemoteProps`; `RemoteAuthProvider` устанавливает config и request в копию shared внутри remote. Remote не запускает собственный login или session bootstrap.

`createBffClient` использует BFF session cookie, отправляет CSRF token в header, имя которого сообщает BFF, для unsafe запросов и возвращает исходный API `Response` вызывающему сервису. Запросы автоматически не повторяются. `makeAuthenticatedRequest` делегирует установленному Hub-owned handler; без Hub transport возвращается ошибка.

Hub загружает `AppConfig` из runtime `config.json`. Обязательные поля — `BFF_BASE` и `API_BASE`; необязательные `BASE_PATH` и `REMOTES` сохраняют совместимость с callers, которым нужны только первые два поля. Hub bootstrap требует все три entries в `REMOTES` и завершится safe config failure, если их нет.

Browser schema:

```json
{
  "BFF_BASE": "https://web.example.test/bff",
  "API_BASE": "https://web.example.test/bff/api",
  "BASE_PATH": "/notebook/",
  "REMOTES": {
    "campaign": "/notebook/remotes/campaign/assets/remoteEntry.js",
    "profile": "/notebook/remotes/profile/assets/remoteEntry.js",
    "login": "/notebook/remotes/login/assets/remoteEntry.js"
  }
}
```

`loadConfig` запрашивает `config.json` относительно `document.baseURI` с `cache: 'no-store'`. `BASE_PATH` — локальный path, который нормализуется с завершающим `/`; `REMOTES` содержит непустые entry strings для `campaign`, `profile` и `login`. Неизвестные поля в нормализованный объект не копируются. Public paths генерирует web proxy из одного runtime env набора; внутренние upstream origins в browser JSON не попадают. `BFF_BASE` и `API_BASE` остаются отдельными browser-reachable URL и не проксируются Web gateway. Hub регистрирует remote URLs в Module Federation до рендера приложения и использует `BASE_PATH` как Router basename.

Remote-компоненты и сервисы используют переданный Hub transport, а не собственные credentials или API bootstrap. Вход через BFF выполняется browser redirect. Logout отправляет CSRF-защищённый POST и принимает только `200` JSON с абсолютным одноразовым URL на тот же origin BFF; клиент выполняет `window.location.assign`, чтобы браузер дошёл до IdP вне `fetch`. `204` не считается успешным выходом. Локальная BFF session удаляется до этого перехода, поэтому ответ POST не гарантирует завершение SSO, если браузер не дошёл до IdP. Подробности callback и Keycloak configuration приведены в [README BFF](../../../apps/bff/web/README.md).
