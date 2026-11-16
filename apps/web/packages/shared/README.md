# @tdn/shared

Общая библиотека frontend-кода для возможностей, не привязанных к отдельному домену.

## Авторизация и transport Web

`AuthProvider` создаётся в Hub и владеет BFF session bootstrap и полной моделью `AuthContextType`. Hub передаёт её remote-компонентам через обязательный `HubRemoteProps`; `RemoteAuthProvider` устанавливает config и request в копию shared внутри remote. Remote не запускает собственный login или session bootstrap.

`createBffClient` использует BFF session cookie, отправляет CSRF token в header, имя которого сообщает BFF, для unsafe запросов и возвращает исходный API `Response` вызывающему сервису. Запросы автоматически не повторяются. `makeAuthenticatedRequest` делегирует установленному Hub-owned handler; без Hub transport возвращается ошибка.

Hub загружает `AppConfig` (`BFF_BASE`, `API_BASE`) из runtime `config.json`. Remote-компоненты и сервисы используют переданный Hub transport, а не собственные credentials или API bootstrap. Вход через BFF выполняется browser redirect. Logout отправляет CSRF-защищённый POST и принимает только `200` JSON с абсолютным одноразовым URL на тот же origin BFF; клиент выполняет `window.location.assign`, чтобы браузер дошёл до IdP вне `fetch`. `204` не считается успешным выходом. Локальная BFF session удаляется до этого перехода, поэтому ответ POST не гарантирует завершение SSO, если браузер не дошёл до IdP. Подробности callback и Keycloak configuration приведены в [README BFF](../../../apps/bff/web/README.md).
