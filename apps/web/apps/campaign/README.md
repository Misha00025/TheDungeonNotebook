# @tdn/campaign

Кампания — Module Federation remote, который монтирует Hub. У неё нет отдельного HTML-приложения или собственного bootstrap авторизации и сессии. Hub передаёт полный shared auth-контракт; сервисы кампании используют общий authenticated request transport.

Hub проверяет BFF session и наличие профиля TDN до показа маршрутов кампании. Вход в IdP и создание профиля TDN — отдельные шаги. Если профиля нет, Hub показывает `CompleteProfile` поверх текущего URL и после создания профиля продолжает исходный маршрут.

## Сборка и preview

Из корня репозитория запустите сборку remote в watch-режиме, а во втором терминале — статический preview:

```bash
npm --prefix apps/web run dev --workspace @tdn/campaign
npm --prefix apps/web run preview --workspace @tdn/campaign
npm --prefix apps/web run build --workspace @tdn/campaign
```

Preview раздаёт federation assets на `http://localhost:3000`; Hub загружает `http://localhost:3000/assets/remoteEntry.js`. Это не standalone интерфейс кампании. Hub запускается отдельно на `http://localhost:3004` и владеет runtime config и BFF session.

Общий transport отправляет cookie credentials и CSRF header BFF для unsafe запросов. Ошибочные API-запросы автоматически не повторяются. Logout завершает только локальную BFF session, не SSO IdP.

[Публичная HTML-документация](../../../../docs/api/index.html)
