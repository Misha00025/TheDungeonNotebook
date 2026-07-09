# Admin Panel — план разработки

## 1. Выполнено

| № | Задача | Статус |
|---|--------|--------|
| 1 | `docker-compose.yaml`, `Dockerfile`, `requirements.txt`, `.env.example` — инфраструктура | ✓ |
| 2 | `app/__init__.py`, `config.py` — фабрика + конфиг | ✓ |
| 3 | `app/middleware.py` — JWT create/verify, `@login_required` | ✓ |
| 4 | `app/services.py` — HTTP-клиенты к сервисам (users, groups, policies, content) | ✓ |
| 5 | `app/routes/auth.py` + `templates/login.html` — логин | ✓ |
| 6 | `templates/base.html` — layout + `static/style.css` | ✓ |
| 7 | `app/routes/dashboard.py` + `templates/dashboard.html` | ✓ |
| 8 | `app/routes/users.py` + `templates/{users,user_detail}.html` | ✓ |
| 9 | `app/routes/groups.py` + `templates/{groups,group_detail}.html` | ✓ |
| 10 | `app/routes/content.py` + `templates/content.html` | ✓ |

## 2. Следующие задачи

| № | Задача | Описание |
|---|--------|----------|
| 11 | Создание пользователя | Страница `/admin/users/create` с формой (username, password, nickname). Два вызова: (1) `POST auth-service:8080/auth/register` → `{id}`, (2) `POST users-service:8080/users` с `{id, nickname}`. Функция `register_user()` в `services.py`. Шаблон `user_create.html`. Кнопка «+ Create User» на странице списка. | ✓ |
| 12 | Создание группы | Страница `/admin/groups/create` с формой (name, icon). Вызов `POST campaign-service:8080/groups` с `{name, icon}`. Функция `create_group()` в `services.py`. Шаблон `group_create.html`. Кнопка «+ Create Group» на странице списка. | ✓ |
| 13 | Вкладка Bots / Service Tokens | Страница `/admin/bots` с выбором группы + сроком жизни. Вызов `POST auth-service:8080/auth/groups/{groupId}/service-token/generate`. Функция `generate_service_token()` в `services.py`. Шаблон `bots.html`. Ссылка в сайдбаре. | ✓ |

## 3. Не реализуется

| Причина | Что |
|---------|-----|
| Нет эндпоинта; менять сервисы запрещено | Смена пароля пользователя |
