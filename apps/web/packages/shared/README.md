# @tdn/shared

Общая библиотека frontend-кода для возможностей, не привязанных к отдельному домену.

## Авторизация и transport Web

`AuthProvider` создаётся в Hub и владеет BFF session bootstrap и полной моделью `AuthContextType`. Hub передаёт её remote-компонентам через обязательный `HubRemoteProps`; `RemoteAuthProvider` устанавливает config и request в копию shared внутри remote. Remote не запускает собственный login или session bootstrap.

`createBffClient` использует BFF session cookie, отправляет CSRF token в header, имя которого сообщает BFF, для unsafe запросов и возвращает исходный API `Response` вызывающему сервису. Запросы автоматически не повторяются. `makeAuthenticatedRequest` делегирует установленному Hub-owned handler; без Hub transport возвращается ошибка.

Hub загружает `AppConfig` (`BFF_BASE`, `API_BASE`) из runtime `config.json`. Remote-компоненты и сервисы используют переданный Hub transport, а не собственные credentials или API bootstrap. Вход через BFF выполняется browser redirect; logout завершает локальную BFF session, не SSO IdP.
