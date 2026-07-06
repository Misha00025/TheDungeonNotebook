# Admin Panel — техническое задание

## 1. Архитектура

### 1.1. Общая схема

```
┌─────────────────────────────────────────────────────┐
│  Хост-машина                                        │
│                                                     │
│  docker compose -f admin/docker-compose.yaml up      │
│  ┌──────────────────────────────────────────────┐   │
│  │  admin-panel (контейнер)                      │   │
│  │  ┌──────────┐     ┌──────────────┐           │   │
│  │  │ Flask    │────▶│ Jinja2       │  :8081     │   │
│  │  │ бэкенд   │     │ шаблоны      │  (хост)    │   │
│  │  └────┬─────┘     └──────────────┘           │   │
│  │       │                                      │   │
│  │       │ HTTP (внутри backend_backend-network) │   │
│  │       ▼                                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ auth-svc │ │ users-svc│ │ campaign-svc │  │   │
│  │  │ :8080    │ │ :8080    │ │ :8080        │  │   │
│  │  └──────────┘ └──────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  docker compose -f backend/docker-compose.yaml up    │
│  └────────── backend стек ───────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 1.2. Сеть

Админ-панель подключается к той же Docker-сети, что и бэкенд:
- Имя сети: `backend_backend-network`
- Тип: `external: true` (создаётся основным `docker-compose.yaml` из `backend/`)
- Все сервисы доступны по hostname: `auth-service`, `users-service`, `campaign-service`

### 1.3. Доступ к сервисам

Админ-бэкенд НЕ проходит через `api-gateway`. Он обращается к сервисам напрямую.
Это возможно, потому что **сервисы не имеют собственной проверки авторизации**
(она реализована только в gateway). Любой HTTP-запрос к сервису будет выполнен.

### 1.4. Строгие ограничения (НЕ НАРУШАТЬ)

1. **Нет прямых записей в БД** — никаких SQL-запросов, никаких MongoDB-запросов.
   Только HTTP-запросы к существующим эндпоинтам сервисов.
2. **Нет нового функционала в сервисах** — нельзя менять код `auth-service`,
   `users-service`, `campaign-service`. Работаем только с тем, что уже есть.
3. **Нет интеграции с основным фронтендом** — админка — это отдельное приложение
   на Flask + Jinja2, никакой связи с React SPA.

---

## 2. Стек и зависимости

### 2.1. Бэкенд

| Компонент | Технология |
|-----------|-----------|
| Язык | Python 3.13 |
| Фреймворк | Flask 3.0.x |
| HTTP-клиент | requests |
| JWT | PyJWT |
| Шаблонизатор | Jinja2 (встроен в Flask) |

### 2.2. Фронтенд

| Компонент | Технология | Причина |
|-----------|-----------|---------|
| Шаблоны | Jinja2 | Всё в одном контейнере, без сборки |
| Стили | CSS (vanilla) | Без фреймворков, минималистично |
| Скрипты | Vanilla JS | Только для confirm-диалогов, сортировки таблиц |

### 2.3. Контейнеризация

- **Базовый образ:** `python:3.13` (как и api-gateway)
- **Docker Compose**: аналогично `monitoring/docker-compose.yaml`

### 2.4. Зависимости (requirements.txt)

```
Flask==3.0.1
requests==2.31.0
PyJWT
gunicorn
```

---

## 3. Структура файлов — полное описание

```
admin/
├── PLAN.md                          # Этот файл
├── docker-compose.yaml              # Оркестрация контейнера
├── Dockerfile                       # Сборка образа
├── requirements.txt                 # Python-зависимости
├── .env.example                     # Пример конфига
├── app/
│   ├── __init__.py                  # create_app()
│   ├── config.py                    # Конфигурация из .env
│   ├── middleware.py                 # JWT-аутентификация
│   ├── services.py                  # HTTP-клиенты к микросервисам
│   └── routes/
│       ├── __init__.py              # Регистрация blueprint'ов
│       ├── auth.py                  # Аутентификация админа
│       ├── dashboard.py             # Статистика
│       ├── users.py                 # CRUD пользователей
│       ├── groups.py                # CRUD групп
│       └── content.py               # Модерация контента
├── templates/
│   ├── base.html                    # Layout
│   ├── login.html                   # Страница входа
│   ├── dashboard.html               # Статистика
│   ├── users.html                   # Список пользователей
│   ├── user_detail.html             # Детали пользователя
│   ├── groups.html                  # Список групп
│   ├── group_detail.html            # Детали группы
│   └── content.html                 # Модерация контента
└── static/
    └── style.css                    # Стили
```

---

## 4. Пошаговая реализация

### Шаг 1: docker-compose.yaml

Файл: `admin/docker-compose.yaml`

```yaml
version: '3'

services:
  admin-panel:
    build: .
    container_name: admin-panel
    networks:
      - backend_backend-network
    ports:
      - "${ADMIN_PORT:-8081}:80"
    env_file:
      - ./.env
    environment:
      - AUTH_SERVICE_URL=http://auth-service:8080
      - USERS_SERVICE_URL=http://users-service:8080
      - CAMPAIGN_SERVICE_URL=http://campaign-service:8080

networks:
  backend_backend-network:
    external: true
```

**Детали:**
- Порт по умолчанию 8081, настраивается через `ADMIN_PORT` в `.env`
- Переменные окружения с URL сервисов передаются явно (как в `api-gateway`)
- Сеть `backend_backend-network` объявлена как `external: true`
- **Нет `depends_on`** — админка не должна блокировать запуск основного стека

### Шаг 2: Dockerfile

Файл: `admin/Dockerfile`

```dockerfile
FROM python:3.13

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

COPY . .

EXPOSE 80

CMD ["gunicorn", "--bind", "0.0.0.0:80", "-w", "2", "app:create_app()"]
```

**Детали:**
- 2 worker'а (админка не высоконагруженная)
- Порт 80 внутри контейнера
- Точка входа: `app:create_app()` — фабричная функция

### Шаг 3: requirements.txt

```
Flask==3.0.1
requests==2.31.0
PyJWT
gunicorn
```

**Важно:** пароль хранится в `.env` в открытом виде, поэтому `bcrypt` и `cryptography` не нужны.
Сравнение паролей — через `secrets.compare_digest` (из стандартной библиотеки Python).

### Шаг 4: .env.example

```ini
# Аутентификация админ-панели
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password-here
ADMIN_JWT_SECRET=<random 64-char string>

# Порт на хосте
ADMIN_PORT=8081
```

**Важно:** пароль хранится в открытом виде. `.env` должен быть добавлен в `.gitignore` и
никогда не попадать в репозиторий. Забыл пароль — загляни в `.env`.
Поменял пароль — перезапусти контейнер.

### Шаг 5: Конфигурация приложения

Файл: `app/config.py`

```python
import os


class Config:
    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
    ADMIN_JWT_SECRET = os.environ.get("ADMIN_JWT_SECRET", "dev-secret")

    AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8080")
    USERS_SERVICE_URL = os.environ.get("USERS_SERVICE_URL", "http://users-service:8080")
    CAMPAIGN_SERVICE_URL = os.environ.get("CAMPAIGN_SERVICE_URL", "http://campaign-service:8080")
```

**Назначение:**
- Единый источник конфигурации
- Все переменные берутся из окружения (через `.env`)
- Дефолтные значения для разработки (без .env)

### Шаг 6: Фабрика приложения

Файл: `app/__init__.py`

```python
import os
from flask import Flask


def create_app():
    app = Flask(__name__, template_folder="../templates", static_folder="../static")

    app.config.from_object("app.config.Config")

    # JWT secret для подписи админских токенов
    app.config["JWT_SECRET"] = app.config["ADMIN_JWT_SECRET"]

    from app.routes import register_routes
    register_routes(app)

    from app.middleware import setup_middleware
    setup_middleware(app)

    return app
```

**Детали:**
- Фабричная функция `create_app()` — стандартный паттерн Flask
- `template_folder` и `static_folder` указывают на `admin/templates/` и `admin/static/`
- Регистрация роутов и middleware после создания app
- Используется gunicorn: `app:create_app()`

### Шаг 7: Middleware аутентификации

Файл: `app/middleware.py`

```python
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, redirect, url_for, current_app


def create_token(username: str, secret: str) -> str:
    payload = {
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def verify_token(token: str, secret: str) -> dict | None:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("admin_token")
        if not token:
            return redirect(url_for("auth.login"))
        payload = verify_token(token, current_app.config["JWT_SECRET"])
        if not payload:
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


def setup_middleware(app):
    """Регистрирует before_request для защиты всех /admin/* роутов."""
    # before_request не используем — применяем декоратор @login_required
    # к каждому blueprint'у индивидуально, кроме auth
    pass
```

**Детали:**
- JWT с HS256, отдельный секрет (`ADMIN_JWT_SECRET`)
- Токен живёт 24 часа
- **Не пересекается** с JWT основного приложения (разные секреты, разные алгоритмы: RS256 vs HS256)
- Токен хранится в cookie `admin_token` (не в localStorage — это server-side rendering)
- Декоратор `@login_required` навешивается на каждый blueprint

### Шаг 8: Сервисный слой (HTTP-клиенты)

Файл: `app/services.py`

```python
import requests
from flask import current_app


# ============================================================
# Users Service
# ============================================================

def get_all_users() -> dict:
    """GET /users → { users: [...] }"""
    url = f"{current_app.config['USERS_SERVICE_URL']}/users"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_user(user_id: int) -> dict | None:
    """GET /users/{userId} → user dict or None if 404"""
    url = f"{current_app.config['USERS_SERVICE_URL']}/users/{user_id}"
    resp = requests.get(url, timeout=10)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def get_users_by_ids(ids: list[int]) -> list[dict]:
    """GET /users?ids=1,2,3 → { users: [...] } — возвращает список"""
    ids_str = ",".join(str(i) for i in ids)
    url = f"{current_app.config['USERS_SERVICE_URL']}/users"
    resp = requests.get(url, params={"ids": ids_str}, timeout=10)
    resp.raise_for_status()
    return resp.json().get("users", [])


def delete_user(user_id: int) -> dict:
    """DELETE /users/{userId} → deleted user dict"""
    url = f"{current_app.config['USERS_SERVICE_URL']}/users/{user_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ============================================================
# Campaign Service — Groups
# ============================================================

def get_all_groups() -> list[dict]:
    """GET /groups → [...] (plain array)"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_group(group_id: int) -> dict | None:
    """GET /groups/{groupId} → group dict or None if 404"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}"
    resp = requests.get(url, timeout=10)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def delete_group(group_id: int) -> dict:
    """DELETE /groups/{groupId} → deleted group dict"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ============================================================
# Campaign Service — Policies (access control)
# ============================================================

def get_group_policies(group_id: int = None, user_id: int = None) -> dict:
    """
    GET /polices/groups?groupId=X or ?userId=X
    → { users: [{ userId, groupId, isAdmin, characters: [...] }] }
    """
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/polices/groups"
    params = {}
    if group_id is not None:
        params["groupId"] = group_id
    if user_id is not None:
        params["userId"] = user_id
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def set_group_admin(user_id: int, group_id: int, is_admin: bool) -> dict:
    """PUT /polices/groups body: { userId, groupId, isAdmin }"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/polices/groups"
    resp = requests.put(url, json={
        "userId": user_id,
        "groupId": group_id,
        "isAdmin": is_admin,
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()


def remove_user_from_group(user_id: int, group_id: int) -> dict:
    """DELETE /polices/groups?userId=X&groupId=Y"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/polices/groups"
    resp = requests.delete(url, params={
        "userId": user_id,
        "groupId": group_id,
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ============================================================
# Campaign Service — Content (Items, Skills, Notes, Characters)
# ============================================================

def get_group_items(group_id: int) -> list[dict]:
    """GET /groups/{groupId}/items → { items: [...] }"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/items"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json().get("items", [])


def get_group_skills(group_id: int) -> list[dict]:
    """GET /groups/{groupId}/skills → { skills: [...], total: N }"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/skills"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data.get("skills", [])


def get_group_notes(group_id: int) -> list[dict]:
    """GET /groups/{groupId}/notes → [...] (plain array)"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/notes"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_group_characters(group_id: int) -> list[dict]:
    """GET /groups/{groupId}/characters → [...] (plain array)"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/characters"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_group_item(group_id: int, item_id: int) -> dict:
    """DELETE /groups/{groupId}/items/{itemId}"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/items/{item_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_group_skill(group_id: int, skill_id: int) -> dict:
    """DELETE /groups/{groupId}/skills/{skillId}"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/skills/{skill_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_group_note(group_id: int, note_id: int) -> dict:
    """DELETE /groups/{groupId}/notes/{noteId}"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/notes/{note_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_character_note(group_id: int, character_id: int, note_id: int) -> dict:
    """DELETE /groups/{groupId}/characters/{characterId}/notes/{noteId}"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/characters/{character_id}/notes/{note_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def delete_character(group_id: int, character_id: int) -> dict:
    """DELETE /groups/{groupId}/characters/{characterId}"""
    url = f"{current_app.config['CAMPAIGN_SERVICE_URL']}/groups/{group_id}/characters/{character_id}"
    resp = requests.delete(url, timeout=10)
    resp.raise_for_status()
    return resp.json()
```

**Детали:**
- Каждая функция соответствует одному HTTP-вызову
- Возвращает сырой JSON-ответ из сервиса
- Базовый URL берётся из `current_app.config`
- Все вызовы имеют `timeout=10` секунд
- `raise_for_status()` для автоматической обработки ошибок

### Шаг 9: Регистрация роутов

Файл: `app/routes/__init__.py`

```python
from app.routes.auth import auth_bp
from app.routes.dashboard import dashboard_bp
from app.routes.users import users_bp
from app.routes.groups import groups_bp
from app.routes.content import content_bp


def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix="/admin")
    app.register_blueprint(dashboard_bp, url_prefix="/admin")
    app.register_blueprint(users_bp, url_prefix="/admin")
    app.register_blueprint(groups_bp, url_prefix="/admin")
    app.register_blueprint(content_bp, url_prefix="/admin")

    # Redirect / → /admin/
    @app.route("/")
    def index():
        from flask import redirect, url_for
        return redirect(url_for("dashboard.index"))
```

### Шаг 10: Роут аутентификации

Файл: `app/routes/auth.py`

```python
import secrets
from flask import Blueprint, render_template, request, redirect, url_for, make_response, current_app

from app.middleware import create_token

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    username = request.form.get("username", "")
    password = request.form.get("password", "")

    expected_username = current_app.config["ADMIN_USERNAME"]
    expected_password = current_app.config["ADMIN_PASSWORD"]

    if not secrets.compare_digest(username, expected_username):
        return render_template("login.html", error="Invalid credentials"), 401

    if not secrets.compare_digest(password, expected_password):
        return render_template("login.html", error="Invalid credentials"), 401

    token = create_token(username, current_app.config["JWT_SECRET"])
    resp = make_response(redirect(url_for("dashboard.index")))
    resp.set_cookie("admin_token", token, httponly=True, max_age=86400)
    return resp


@auth_bp.route("/logout")
def logout():
    resp = make_response(redirect(url_for("auth.login")))
    resp.set_cookie("admin_token", "", expires=0)
    return resp
```

**Детали:**
- GET: рендерит страницу логина
- POST: проверяет логин/пароль через `secrets.compare_digest`
- При успехе: создаёт JWT, устанавливает cookie `admin_token` (httponly)
- При неудаче: возвращает ту же страницу с ошибкой
- `/admin/logout`: очищает cookie

### Шаг 11: Роут Dashboard

Файл: `app/routes/dashboard.py`

```python
from flask import Blueprint, render_template
from app.middleware import login_required
from app import services

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/")
@login_required
def index():
    try:
        users_data = services.get_all_users()
        total_users = len(users_data.get("users", []))
    except Exception:
        total_users = "N/A"

    try:
        groups = services.get_all_groups()
        total_groups = len(groups)
    except Exception:
        total_groups = "N/A"

    return render_template("dashboard.html",
                         total_users=total_users,
                         total_groups=total_groups)
```

**Детали:**
- Отображает две метрики: количество пользователей и групп
- При ошибке запроса к сервису показывает "N/A" (не блокирует страницу)
- Защищён `@login_required`

### Шаг 12: Роут пользователей

Файл: `app/routes/users.py`

```python
from flask import Blueprint, render_template, request, redirect, url_for
from app.middleware import login_required
from app import services

users_bp = Blueprint("users", __name__)


@users_bp.route("/users")
@login_required
def list_users():
    search = request.args.get("search", "")

    try:
        if search:
            data = services.get_all_users()
            all_users = data.get("users", [])
            users = [u for u in all_users if search.lower() in u.get("nickname", "").lower()]
        else:
            data = services.get_all_users()
            users = data.get("users", [])
    except Exception:
        users = []

    return render_template("users.html", users=users, search=search)


@users_bp.route("/users/<int:user_id>")
@login_required
def user_detail(user_id):
    user = services.get_user(user_id)
    if user is None:
        return render_template("user_detail.html", user=None, groups=None)

    try:
        policies = services.get_group_policies(user_id=user_id)
        user_groups = policies.get("users", [])
    except Exception:
        user_groups = []

    return render_template("user_detail.html", user=user, groups=user_groups)


@users_bp.route("/users/<int:user_id>/delete", methods=["POST"])
@login_required
def delete_user(user_id):
    try:
        services.delete_user(user_id)
    except Exception:
        pass
    return redirect(url_for("users.list_users"))


@users_bp.route("/users/<int:user_id>/remove-from-group/<int:group_id>", methods=["POST"])
@login_required
def remove_from_group(user_id, group_id):
    try:
        services.remove_user_from_group(user_id, group_id)
    except Exception:
        pass
    return redirect(url_for("users.user_detail", user_id=user_id))


@users_bp.route("/users/<int:user_id>/toggle-admin/<int:group_id>", methods=["POST"])
@login_required
def toggle_group_admin(user_id, group_id):
    try:
        current_admin_status = request.form.get("is_admin", "false") == "true"
        services.set_group_admin(user_id, group_id, not current_admin_status)
    except Exception:
        pass
    return redirect(url_for("users.user_detail", user_id=user_id))
```

**Детали:**
- `/admin/users` — список с поиском по никнейму
- `/admin/users/{id}` — профиль + группы пользователя + роли
- `/admin/users/{id}/delete` — удаление (POST, с redirect)
- `/admin/users/{id}/remove-from-group/{gid}` — удаление из группы
- `/admin/users/{id}/toggle-admin/{gid}` — переключение is_admin

### Шаг 13: Роут групп

Файл: `app/routes/groups.py`

```python
from flask import Blueprint, render_template, redirect, url_for
from app.middleware import login_required
from app import services

groups_bp = Blueprint("groups", __name__)


@groups_bp.route("/groups")
@login_required
def list_groups():
    try:
        groups = services.get_all_groups()
    except Exception:
        groups = []
    return render_template("groups.html", groups=groups)


@groups_bp.route("/groups/<int:group_id>")
@login_required
def group_detail(group_id):
    group = services.get_group(group_id)
    if group is None:
        return render_template("group_detail.html", group=None, members=None)

    try:
        policies = services.get_group_policies(group_id=group_id)
        members = policies.get("users", [])
    except Exception:
        members = []

    # Обогащаем members информацией о пользователях
    user_ids = [m["userId"] for m in members]
    try:
        users_data = services.get_users_by_ids(user_ids)
        user_map = {u["id"]: u for u in users_data}
    except Exception:
        user_map = {}

    for m in members:
        m["user"] = user_map.get(m["userId"])

    return render_template("group_detail.html", group=group, members=members)


@groups_bp.route("/groups/<int:group_id>/delete", methods=["POST"])
@login_required
def delete_group(group_id):
    try:
        services.delete_group(group_id)
    except Exception:
        pass
    return redirect(url_for("groups.list_groups"))


@groups_bp.route("/groups/<int:group_id>/remove-user/<int:user_id>", methods=["POST"])
@login_required
def remove_user(group_id, user_id):
    try:
        services.remove_user_from_group(user_id, group_id)
    except Exception:
        pass
    return redirect(url_for("groups.group_detail", group_id=group_id))
```

### Шаг 14: Роут контента

Файл: `app/routes/content.py`

```python
from flask import Blueprint, render_template, request, redirect, url_for
from app.middleware import login_required
from app import services

content_bp = Blueprint("content", __name__)


@content_bp.route("/content")
@login_required
def content_list():
    group_id = request.args.get("group_id", type=int)

    try:
        groups = services.get_all_groups()
    except Exception:
        groups = []

    items = []
    skills = []
    notes = []
    characters = []

    if group_id:
        try:
            items = services.get_group_items(group_id)
        except Exception:
            items = []

        try:
            skills = services.get_group_skills(group_id)
        except Exception:
            skills = []

        try:
            notes = services.get_group_notes(group_id)
        except Exception:
            notes = []

        try:
            characters = services.get_group_characters(group_id)
        except Exception:
            characters = []

    return render_template("content.html",
                         groups=groups,
                         selected_group_id=group_id,
                         items=items,
                         skills=skills,
                         notes=notes,
                         characters=characters)


@content_bp.route("/content/item/<int:group_id>/<int:item_id>/delete", methods=["POST"])
@login_required
def delete_item(group_id, item_id):
    try:
        services.delete_group_item(group_id, item_id)
    except Exception:
        pass
    return redirect(url_for("content.content_list", group_id=group_id))


@content_bp.route("/content/skill/<int:group_id>/<int:skill_id>/delete", methods=["POST"])
@login_required
def delete_skill(group_id, skill_id):
    try:
        services.delete_group_skill(group_id, skill_id)
    except Exception:
        pass
    return redirect(url_for("content.content_list", group_id=group_id))


@content_bp.route("/content/note/<int:group_id>/<int:note_id>/delete", methods=["POST"])
@login_required
def delete_note(group_id, note_id):
    try:
        services.delete_group_note(group_id, note_id)
    except Exception:
        pass
    return redirect(url_for("content.content_list", group_id=group_id))


@content_bp.route("/content/character/<int:group_id>/<int:character_id>/delete", methods=["POST"])
@login_required
def delete_character(group_id, character_id):
    try:
        services.delete_character(group_id, character_id)
    except Exception:
        pass
    return redirect(url_for("content.content_list", group_id=group_id))
```

**Детали:**
- Сначала выбирается группа через `<select>`
- Отображаются все типы контента группы
- Для каждого — кнопка удалить с подтверждением
- Удаление персонажа удаляет и его заметки/предметы/скиллы через каскад на стороне сервиса

### Шаг 15: Шаблоны Jinja2

#### base.html

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Admin Panel{% endblock %}</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
</head>
<body>
    <nav class="sidebar">
        <div class="sidebar-header">
            <h2>TDN Admin</h2>
        </div>
        <ul class="nav-links">
            <li><a href="{{ url_for('dashboard.index') }}">Dashboard</a></li>
            <li><a href="{{ url_for('users.list_users') }}">Users</a></li>
            <li><a href="{{ url_for('groups.list_groups') }}">Groups</a></li>
            <li><a href="{{ url_for('content.content_list') }}">Content</a></li>
        </ul>
        <div class="sidebar-footer">
            <a href="{{ url_for('auth.logout') }}">Logout</a>
        </div>
    </nav>
    <main class="content">
        {% block content %}{% endblock %}
    </main>
</body>
</html>
```

**Детали:**
- Боковая панель слева с навигацией
- Основной контент справа
- Ссылка Logout внизу сайдбара
- Блоки `title` и `content` для переопределения в дочерних шаблонах

#### login.html

```html
{% extends "base.html" %}
{% block title %}Login — TDN Admin{% endblock %}
{% block content %}
<div class="login-container">
    <form method="POST" class="login-form">
        <h1>Admin Login</h1>
        {% if error %}
        <div class="alert alert-error">{{ error }}</div>
        {% endif %}
        <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required autofocus>
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
        </div>
        <button type="submit" class="btn btn-primary">Login</button>
    </form>
</div>
{% endblock %}
```

**Детали:**
- Центрированная форма логина
- Поля: username, password
- Блок ошибки при неверных credentials
- Не наследует сайдбар (можно переопределить base.html для login)

#### dashboard.html

```html
{% extends "base.html" %}
{% block title %}Dashboard — TDN Admin{% endblock %}
{% block content %}
<h1>Dashboard</h1>
<div class="stats-grid">
    <div class="stat-card">
        <h3>Users</h3>
        <p class="stat-value">{{ total_users }}</p>
    </div>
    <div class="stat-card">
        <h3>Groups</h3>
        <p class="stat-value">{{ total_groups }}</p>
    </div>
</div>
{% endblock %}
```

#### users.html

```html
{% extends "base.html" %}
{% block title %}Users — TDN Admin{% endblock %}
{% block content %}
<h1>Users</h1>

<form method="GET" class="search-form">
    <input type="text" name="search" value="{{ search }}" placeholder="Search by nickname...">
    <button type="submit" class="btn">Search</button>
</form>

<table class="data-table">
    <thead>
        <tr>
            <th>ID</th>
            <th>Nickname</th>
            <th>Visible Name</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        {% for user in users %}
        <tr>
            <td>{{ user.id }}</td>
            <td>{{ user.nickname }}</td>
            <td>{{ user.visibleName or '-' }}</td>
            <td>
                <a href="{{ url_for('users.user_detail', user_id=user.id) }}" class="btn btn-sm">View</a>
                <form method="POST" action="{{ url_for('users.delete_user', user_id=user.id) }}" style="display:inline"
                      onsubmit="return confirm('Delete user {{ user.nickname }}?')">
                    <button type="submit" class="btn btn-sm btn-danger">Delete</button>
                </form>
            </td>
        </tr>
        {% else %}
        <tr>
            <td colspan="4" class="empty">No users found.</td>
        </tr>
        {% endfor %}
    </tbody>
</table>
{% endblock %}
```

#### user_detail.html

```html
{% extends "base.html" %}
{% block title %}User #{{ user.id if user else 'Not Found' }} — TDN Admin{% endblock %}
{% block content %}
{% if user %}
<h1>{{ user.nickname }}</h1>

<div class="detail-card">
    <p><strong>ID:</strong> {{ user.id }}</p>
    <p><strong>Visible Name:</strong> {{ user.visibleName or '-' }}</p>
    <p><strong>Image Link:</strong> {{ user.imageLink or '-' }}</p>
</div>

<h2>Groups ({{ groups|length }})</h2>
<table class="data-table">
    <thead>
        <tr>
            <th>Group ID</th>
            <th>Is Admin</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        {% for g in groups %}
        <tr>
            <td>{{ g.groupId }}</td>
            <td>{{ 'Yes' if g.isAdmin else 'No' }}</td>
            <td>
                <form method="POST" action="{{ url_for('users.toggle_group_admin', user_id=user.id, group_id=g.groupId) }}" style="display:inline">
                    <input type="hidden" name="is_admin" value="{{ 'true' if g.isAdmin else 'false' }}">
                    <button type="submit" class="btn btn-sm">
                        {{ 'Revoke Admin' if g.isAdmin else 'Make Admin' }}
                    </button>
                </form>
                <form method="POST" action="{{ url_for('users.remove_from_group', user_id=user.id, group_id=g.groupId) }}" style="display:inline"
                      onsubmit="return confirm('Remove user from group {{ g.groupId }}?')">
                    <button type="submit" class="btn btn-sm btn-danger">Remove</button>
                </form>
            </td>
        </tr>
        {% else %}
        <tr>
            <td colspan="3" class="empty">Not a member of any group.</td>
        </tr>
        {% endfor %}
    </tbody>
</table>

{% else %}
<h1>User Not Found</h1>
<p>The requested user does not exist.</p>
{% endif %}
<a href="{{ url_for('users.list_users') }}" class="btn">← Back to Users</a>
{% endblock %}
```

#### groups.html

```html
{% extends "base.html" %}
{% block title %}Groups — TDN Admin{% endblock %}
{% block content %}
<h1>Groups</h1>

<table class="data-table">
    <thead>
        <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Icon</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        {% for group in groups %}
        <tr>
            <td>{{ group.id }}</td>
            <td>{{ group.name }}</td>
            <td>{{ group.icon or '-' }}</td>
            <td>
                <a href="{{ url_for('groups.group_detail', group_id=group.id) }}" class="btn btn-sm">View</a>
                <form method="POST" action="{{ url_for('groups.delete_group', group_id=group.id) }}" style="display:inline"
                      onsubmit="return confirm('Delete group {{ group.name }}? This cannot be undone.')">
                    <button type="submit" class="btn btn-sm btn-danger">Delete</button>
                </form>
            </td>
        </tr>
        {% else %}
        <tr>
            <td colspan="4" class="empty">No groups found.</td>
        </tr>
        {% endfor %}
    </tbody>
</table>
{% endblock %}
```

#### group_detail.html

```html
{% extends "base.html" %}
{% block title %}Group #{{ group.id if group else 'Not Found' }} — TDN Admin{% endblock %}
{% block content %}
{% if group %}
<h1>{{ group.name }}</h1>

<div class="detail-card">
    <p><strong>ID:</strong> {{ group.id }}</p>
    <p><strong>Icon:</strong> {{ group.icon or '-' }}</p>
</div>

<h2>Members ({{ members|length }})</h2>
<table class="data-table">
    <thead>
        <tr>
            <th>User ID</th>
            <th>Nickname</th>
            <th>Admin</th>
            <th>Characters</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        {% for m in members %}
        <tr>
            <td>{{ m.userId }}</td>
            <td>{{ m.user.nickname if m.user else 'N/A' }}</td>
            <td>{{ 'Yes' if m.isAdmin else 'No' }}</td>
            <td>{{ m.characters|length }}</td>
            <td>
                <a href="{{ url_for('users.user_detail', user_id=m.userId) }}" class="btn btn-sm">View User</a>
                {% if not m.isAdmin %}
                <form method="POST" action="{{ url_for('groups.remove_user', group_id=group.id, user_id=m.userId) }}" style="display:inline"
                      onsubmit="return confirm('Remove user from group?')">
                    <button type="submit" class="btn btn-sm btn-danger">Remove</button>
                </form>
                {% endif %}
            </td>
        </tr>
        {% else %}
        <tr>
            <td colspan="5" class="empty">No members.</td>
        </tr>
        {% endfor %}
    </tbody>
</table>

{% else %}
<h1>Group Not Found</h1>
<p>The requested group does not exist.</p>
{% endif %}
<a href="{{ url_for('groups.list_groups') }}" class="btn">← Back to Groups</a>
{% endblock %}
```

#### content.html

```html
{% extends "base.html" %}
{% block title %}Content Moderation — TDN Admin{% endblock %}
{% block content %}
<h1>Content Moderation</h1>

<form method="GET" class="search-form">
    <label for="group_id">Select Group:</label>
    <select name="group_id" id="group_id" onchange="this.form.submit()">
        <option value="">— Select a group —</option>
        {% for g in groups %}
        <option value="{{ g.id }}" {{ 'selected' if g.id == selected_group_id }}>{{ g.name }} (ID: {{ g.id }})</option>
        {% endfor %}
    </select>
</form>

{% if selected_group_id %}

<h2>Items ({{ items|length }})</h2>
<table class="data-table">
    <thead>
        <tr><th>ID</th><th>Name</th><th>Secret</th><th>Actions</th></tr>
    </thead>
    <tbody>
        {% for item in items %}
        <tr>
            <td>{{ item.id }}</td>
            <td>{{ item.name }}</td>
            <td>{{ 'Yes' if item.isSecret else 'No' }}</td>
            <td>
                <form method="POST" action="{{ url_for('content.delete_item', group_id=selected_group_id, item_id=item.id) }}"
                      onsubmit="return confirm('Delete item {{ item.name }}?')" style="display:inline">
                    <button type="submit" class="btn btn-sm btn-danger">Delete</button>
                </form>
            </td>
        </tr>
        {% else %}
        <tr><td colspan="4" class="empty">No items.</td></tr>
        {% endfor %}
    </tbody>
</table>

<h2>Skills ({{ skills|length }})</h2>
<table class="data-table">
    <thead>
        <tr><th>ID</th><th>Name</th><th>Secret</th><th>Actions</th></tr>
    </thead>
    <tbody>
        {% for skill in skills %}
        <tr>
            <td>{{ skill.id }}</td>
            <td>{{ skill.name }}</td>
            <td>{{ 'Yes' if skill.isSecret else 'No' }}</td>
            <td>
                <form method="POST" action="{{ url_for('content.delete_skill', group_id=selected_group_id, skill_id=skill.id) }}"
                      onsubmit="return confirm('Delete skill {{ skill.name }}?')" style="display:inline">
                    <button type="submit" class="btn btn-sm btn-danger">Delete</button>
                </form>
            </td>
        </tr>
        {% else %}
        <tr><td colspan="4" class="empty">No skills.</td></tr>
        {% endfor %}
    </tbody>
</table>

<h2>Notes ({{ notes|length }})</h2>
<table class="data-table">
    <thead>
        <tr><th>ID</th><th>Header</th><th>Actions</th></tr>
    </thead>
    <tbody>
        {% for note in notes %}
        <tr>
            <td>{{ note.id }}</td>
            <td>{{ note.header }}</td>
            <td>
                <form method="POST" action="{{ url_for('content.delete_note', group_id=selected_group_id, note_id=note.id) }}"
                      onsubmit="return confirm('Delete note?')" style="display:inline">
                    <button type="submit" class="btn btn-sm btn-danger">Delete</button>
                </form>
            </td>
        </tr>
        {% else %}
        <tr><td colspan="3" class="empty">No notes.</td></tr>
        {% endfor %}
    </tbody>
</table>

<h2>Characters ({{ characters|length }})</h2>
<table class="data-table">
    <thead>
        <tr><th>ID</th><th>Name</th><th>Actions</th></tr>
    </thead>
    <tbody>
        {% for character in characters %}
        <tr>
            <td>{{ character.id }}</td>
            <td>{{ character.name or 'Unnamed' }}</td>
            <td>
                <form method="POST" action="{{ url_for('content.delete_character', group_id=selected_group_id, character_id=character.id) }}"
                      onsubmit="return confirm('Delete character {{ character.name }} and all their data?')" style="display:inline">
                    <button type="submit" class="btn btn-sm btn-danger">Delete</button>
                </form>
            </td>
        </tr>
        {% else %}
        <tr><td colspan="3" class="empty">No characters.</td></tr>
        {% endfor %}
    </tbody>
</table>

{% endif %}
{% endblock %}
```

### Шаг 16: Стили

Файл: `static/style.css`

```css
/* ============================================================
   Layout
   ============================================================ */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    min-height: 100vh;
    background: #f5f5f5;
    color: #333;
}

/* ============================================================
   Sidebar
   ============================================================ */
.sidebar {
    width: 240px;
    background: #1a1a2e;
    color: #fff;
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
}

.sidebar-header {
    padding: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

.sidebar-header h2 { font-size: 18px; font-weight: 600; }

.nav-links {
    list-style: none;
    padding: 10px 0;
    flex: 1;
}

.nav-links li a {
    display: block;
    padding: 10px 20px;
    color: #ccc;
    text-decoration: none;
    transition: background 0.2s;
}

.nav-links li a:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
}

.sidebar-footer {
    padding: 15px 20px;
    border-top: 1px solid rgba(255,255,255,0.1);
}

.sidebar-footer a {
    color: #e74c3c;
    text-decoration: none;
}

/* ============================================================
   Main Content
   ============================================================ */
.content {
    margin-left: 240px;
    padding: 30px;
    flex: 1;
    width: calc(100% - 240px);
}

.content h1 {
    margin-bottom: 20px;
    font-size: 24px;
}

.content h2 {
    margin: 25px 0 10px;
    font-size: 18px;
    color: #555;
}

/* ============================================================
   Login Form
   ============================================================ */
.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    width: 100%;
}

.login-form {
    background: #fff;
    padding: 40px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    width: 360px;
}

.login-form h1 {
    margin-bottom: 20px;
    text-align: center;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
}

.form-group input,
.search-form input,
.search-form select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

/* ============================================================
   Buttons
   ============================================================ */
.btn {
    display: inline-block;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    font-size: 14px;
    background: #4a90d9;
    color: #fff;
    transition: background 0.2s;
}

.btn:hover { background: #357abd; }

.btn-sm { padding: 4px 10px; font-size: 12px; }

.btn-danger { background: #e74c3c; }
.btn-danger:hover { background: #c0392b; }

/* ============================================================
   Tables
   ============================================================ */
.data-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border-radius: 4px;
    overflow: hidden;
}

.data-table th,
.data-table td {
    padding: 10px 15px;
    text-align: left;
    border-bottom: 1px solid #eee;
}

.data-table th {
    background: #f8f9fa;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    color: #666;
}

.data-table tr:hover { background: #f8f9fa; }

.empty {
    text-align: center;
    color: #999;
    padding: 30px !important;
}

/* ============================================================
   Stats / Dashboard
   ============================================================ */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
}

.stat-card {
    background: #fff;
    padding: 25px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    text-align: center;
}

.stat-card h3 {
    font-size: 14px;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 10px;
}

.stat-value {
    font-size: 36px;
    font-weight: 700;
    color: #1a1a2e;
}

/* ============================================================
   Detail Card
   ============================================================ */
.detail-card {
    background: #fff;
    padding: 20px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.detail-card p {
    margin-bottom: 8px;
}

/* ============================================================
   Alerts
   ============================================================ */
.alert {
    padding: 10px 15px;
    border-radius: 4px;
    margin-bottom: 15px;
    font-size: 14px;
}

.alert-error {
    background: #fde8e8;
    color: #c0392b;
    border: 1px solid #f5c6cb;
}

/* ============================================================
   Search Form
   ============================================================ */
.search-form {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 20px;
}

.search-form input,
.search-form select {
    max-width: 300px;
}

.search-form label {
    font-weight: 500;
}
```

---

## 5. API-контракты (что дёргаем у сервисов)

### 5.1. Response-форматы сервисов (для справки)

#### GET /users — список пользователей
```json
{
  "users": [
    { "id": 1, "nickname": "misha", "visibleName": "Misha", "imageLink": "..." }
  ]
}
```

#### GET /users/{id} — один пользователь
```json
{ "id": 1, "nickname": "misha", "visibleName": "Misha", "imageLink": "..." }
```

#### GET /groups — список групп (plain array, без обёртки!)
```json
[
  { "id": 1, "name": "My Campaign", "icon": null }
]
```

#### GET /polices/groups?groupId=X — политики доступа
```json
{
  "users": [
    {
      "userId": 1,
      "groupId": 1,
      "isAdmin": true,
      "characters": [
        { "characterId": 10, "canWrite": true }
      ]
    }
  ]
}
```

#### GET /groups/{id}/items — предметы группы
```json
{
  "items": [
    { "id": 1, "name": "Sword", "description": "...", "attributes": [...], "price": 100, "amount": 2, "isSecret": false }
  ]
}
```

#### GET /groups/{id}/skills — скиллы группы
```json
{
  "skills": [
    { "id": 1, "name": "Stealth", "description": "...", "attributes": [...], "isSecret": false }
  ],
  "total": 1
}
```

#### GET /groups/{id}/notes — заметки группы (plain array!)
```json
[
  { "id": 1, "header": "Session 1", "short_description": "...", "body": "...", "keywords": [...], "created_at": "...", "updated_at": "..." }
]
```

#### GET /groups/{id}/characters — персонажи группы (plain array!)
```json
[
  {
    "id": 10,
    "group": { "id": 1, "name": "My Campaign", "icon": null },
    "name": "Gandalf",
    "description": "...",
    "fields": { ... },
    "templateId": 1
  }
]
```

---

## 6. Тестирование

### 6.1. Локальный запуск без Docker

```bash
cd admin
pip install -r requirements.txt

# Экспорт переменных для локальной разработки
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=admin
export ADMIN_JWT_SECRET=dev-secret
export AUTH_SERVICE_URL=http://localhost:5000
export USERS_SERVICE_URL=http://localhost:5000
export CAMPAIGN_SERVICE_URL=http://localhost:5000

# Запуск (если сервисы не запущены — страницы будут показывать N/A)
flask --app app:create_app run --port 8081 --debug
```

### 6.2. Тестирование с Docker

```bash
# Запустить основной стек
cd backend && docker compose up -d

# Собрать и запустить админку
cd ../admin
cp .env.example .env  # и отредактировать пароль
docker compose up -d --build

# Проверить
curl http://localhost:8081/admin/
```

### 6.3. Проверка функционала

| Действие | Ожидаемый результат |
|----------|-------------------|
| Открыть `http://localhost:8081/admin/` | Редирект на `/admin/login` |
| Ввести неверный пароль | Ошибка "Invalid credentials" |
| Ввести верные credentials | Редирект на Dashboard |
| Dashboard | Показывает количество пользователей и групп |
| Users → View | Открывается профиль пользователя |
| Users → Delete | Пользователь удалён, редирект на список |
| Users → Make Admin | Пользователь становится админом группы |
| Groups → View | Показывает участников группы |
| Groups → Delete | Группа удалена |
| Content → выбрать группу | Показывает items, skills, notes, characters |
| Content → Delete (item) | Предмет удалён |
| Logout | Cookie очищен, редирект на логин |

---

## 7. Стандарты кодирования

1. **Python**: PEP 8, именование snake_case для функций и переменных
2. **Flask**: фабричная функция `create_app()`, Blueprint'ы для групп роутов
3. **Jinja2**: наследование через `{% extends %}`, блоки `{% block %}`, циклы `{% for %}`
4. **CSS**: БЭМ-подобные имена классов (`.stat-card`, `.data-table`, `.btn-danger`)
5. **Обработка ошибок**: каждый вызов к сервисам обёрнут в try/except, UI не падает
6. **Безопасность**: JWT в httpOnly cookie, пароль в `.env` (файл в `.gitignore`), сравнение через `secrets.compare_digest`, подтверждение на удаление
7. **Админка не должна падать целиком при недоступности одного из сервисов**

---

## 8. Очерёдность разработки

| № | Что делать | Кто | Оценка |
|---|-----------|-----|--------|
| 1 | `docker-compose.yaml`, `Dockerfile`, `requirements.txt`, `.env.example` | Инфраструктура | 1 ч |
| 2 | `app/__init__.py`, `config.py` — фабрика + конфиг | Бэкенд | 1 ч |
| 3 | `app/middleware.py` — JWT create/verify, `@login_required` | Бэкенд | 1.5 ч |
| 4 | `app/services.py` — HTTP-клиенты ко всем сервисам | Бэкенд | 2 ч |
| 5 | `app/routes/auth.py` + `templates/login.html` — логин | Бэкенд + шаблоны | 1.5 ч |
| 6 | `templates/base.html` — layout + `static/style.css` | Фронтенд | 2 ч |
| 7 | `app/routes/dashboard.py` + `templates/dashboard.html` | Бэкенд + шаблоны | 1 ч |
| 8 | `app/routes/users.py` + `templates/{users,user_detail}.html` | Бэкенд + шаблоны | 2 ч |
| 9 | `app/routes/groups.py` + `templates/{groups,group_detail}.html` | Бэкенд + шаблоны | 2 ч |
| 10 | `app/routes/content.py` + `templates/content.html` | Бэкенд + шаблоны | 2.5 ч |
| 11 | Интеграционное тестирование | QA | 2 ч |
| | **Итого** | | **~16.5 ч** |
