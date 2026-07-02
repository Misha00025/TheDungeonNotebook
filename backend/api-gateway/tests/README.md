# Тестовый фреймворк API Gateway

## Обзор

Интеграционные тесты для API Gateway. Поднимают все микросервисы (auth, users, campaign) через Docker Compose, прогоняют HTTP-сценарии через реальный gateway, затем собирают логи и выводят сводку.

---

## Быстрый запуск

```bash
./test.sh 15
```

Где `15` — количество секунд ожидания после старта контейнера `api-gateway` (зависит от скорости машины).

Запуск конкретного сценария:

```bash
./test.sh 15 -S GatewayMain
```

Несколько сценариев:

```bash
./test.sh 15 -S GatewayMain -S UserProfile -S ExportImport
```

С компактным выводом (без тел ответов):

```bash
./test.sh 15 -c
```

С отладкой:

```bash
./test.sh 15 -d
```

---

## Структура директории

```
tests/
├── .env                      # Переменные окружения для docker-compose
├── certs/                    # RSA-ключи для JWT
├── docker-compose.yaml       # Инфраструктура: mongo, mysql, auth, users, campaign, api-gateway
├── variables.py              # server_url (заполняется из --server)
├── test.sh                   # Bash-оркестратор
├── test.py                   # Точка входа Python
├── venv/                     # Виртуальное окружение Python
├── tests/                    # Ядро фреймворка
│   ├── __init__.py
│   ├── test_variables.py     # Константы (статусы, ID, заголовки)
│   ├── templates.py          # Test, Step, GatewayStep, Scenario
│   ├── request_tests.py      # HTTP-обёртки (get/post/put/patch/delete)
│   ├── validation.py         # Валидаторы ответов
│   ├── main_test.py          # Запуск всех сценариев
│   └── tests_data.py         # Вспомогательные функции с тестами
├── scenarios/                # Сценарии тестирования
│   ├── __init__.py
│   ├── auth_helper.py        # Утилита регистрации/логина
│   ├── gateway_main.py       # Основной сценарий
│   ├── user_profile.py       # Профили пользователей
│   ├── group_items.py        # Групповые предметы
│   ├── character_lifecycle.py # Жизненный цикл персонажа
│   ├── group_skills.py       # Навыки группы
│   ├── character_skills.py   # Навыки персонажа
│   └── export_import.py      # Экспорт/импорт
└── logs/                     # Директория с логами (создаётся test.sh)
```

---

## test.sh — оркестратор

Bash-скрипт управляет всем циклом тестирования:

1. **Очищает данные БД** — `sudo rm -rf mongo_data/* mysql_data/*`
2. **Собирает образы** — `docker-compose build`
3. **Запускает контейнеры** — `docker-compose up -d`
4. **Ждёт готовности** `api-gateway` — цикл `until docker inspect`
5. **Дополнительное ожидание** — первый аргумент скрипта (секунды)
6. **Запускает тесты** — `./venv/bin/python test.py ... > logs/test.log`
7. **Собирает логи** — `server.log`, `all.log`, `db.log`
8. **Выводит сводку** — всего запросов, распределение статусов, ошибки, стартовые логи gateway, проверка на 501
9. **Гасит контейнеры** — `docker-compose down`

### Аргументы

```
./test.sh <ожидание_секунд> [аргументы_test.py...]
```

Всё, что передано после первого аргумента, пробрасывается в `test.py`.

---

## test.py — точка входа

### Аргументы

| Аргумент | Описание |
|---|---|
| `--server URL` | **Обязательный.** Адрес сервера (например `http://localhost:5000`) |
| `-S` / `--scenario NAME` | Имена сценариев (можно несколько). Если не указан — запускаются все |
| `-c` / `--compact` | Компактный вывод (без тел ответов) |
| `-d` / `--debug` | Отладочный вывод |

### Доступные сценарии

| Имя | Файл | Описание |
|---|---|---|
| `GatewayMain` | `gateway_main.py` | Регистрация, логин, группы, персонажи, заметки, предметы, права доступа |
| `UserProfile` | `user_profile.py` | Профили пользователей |
| `GroupItemsLifecycle` | `group_items.py` | Жизненный цикл групповых предметов |
| `CharacterLifecycle` | `character_lifecycle.py` | Жизненный цикл персонажа |
| `GroupSkills` | `group_skills.py` | Навыки группы |
| `CharacterSkillsAssignment` | `character_skills.py` | Назначение навыков персонажа |
| `ExportImport` | `export_import.py` | Экспорт и импорт |

---

## Архитектура фреймворка

### Test

Базовое описание одного HTTP-запроса:

| Поле | Описание |
|---|---|
| `request` | Относительный URL (без базового адреса) |
| `method` | GET / POST / PUT / PATCH / DELETE |
| `headers` | Словарь заголовков |
| `data` | Тело запроса (словарь) |
| `params` | Query-параметры |
| `requirement` | Ожидаемый HTTP-статус |
| `is_valid` | Опциональная функция-валидатор тела ответа |

Константы статусов (`test_variables.py`):

```python
OK = 200
CREATED = 201
BAD = 400
NOT_AUTH = 401
FORBID = 403
NOT_FOUND = 404
NOT_ALLOW = 405
CONFLICT = 409
```

### Placeholder-подстановка

В URL, данных и заголовках можно использовать плейсхолдеры вида `{steps.N.key}`:

- После каждого шага JSON-ответ сохраняется в `data["steps"][N]`
- `{steps.0.id}` — подставится `id` из ответа 0-го шага
- `{steps.2.accessToken}` — подставится `accessToken` из ответа 2-го шага
- Поддерживается навигация по вложенным словарям через точку: `{steps.0.some.nested.field}`
- Поддерживаются отрицательные индексы: `{steps.-1.id}` — последний шаг
- Специальное ключевое слово `last` — возвращает индекс последнего элемента: `{steps.last}`

### Step и GatewayStep

**Step** — исполнитель одного `Test`:
- Заменяет плейсхолдеры в URL и данных
- Выполняет HTTP-запрос через соответствующую обёртку
- Проверяет статус и вызывает валидатор
- Сохраняет результат

**GatewayStep** (наследник Step) — дополнительно обрабатывает заголовки через `replace_placeholders`. Используется когда в заголовках встречаются `{at}` (accessToken) или `{ut}` (userToken) из data-контекста. Все сценарии в `gateway_main.py` используют `GatewayStep`, так как в заголовках `Authorization: {steps.7.accessToken}`.

### Scenario

Последовательность шагов:

```python
scenario = Scenario("MyTest", steps)
scenario.start()  # Запускает все шаги по порядку
```

- Накапливает результаты в `data["steps"]`
- При ошибке (статус не совпал или валидатор вернул `False`) помечает сценарий как неудачный
- Выводит детали ошибки: заголовки, данные, сообщение, ожидаемый статус

### request_tests.py

HTTP-обёртки, формируют полный URL из `variables.server_url` и переданного относительного пути:

```python
get_test(headers, params, url)
post_test(headers, params, url, data)
put_test(headers, params, url, data)
patch_test(headers, params, url, data)
delete_test(headers, params, url)
```

### validation.py

Функции-валидаторы, проверяющие структуру ответа:

- `check_user_data` — проверяет поля пользователя (`id`, `first_name`, `last_name`, `photo_link`)
- `check_group_data` — проверяет поля группы (`id`, `name`, `photo_link`)
- `check_character_data` — проверяет поля персонажа (`id`, `name`, `description`)
- `check_item` — проверяет поля предмета (`name`, `description`)
- `check_note` — проверяет поля заметки (`header`, `body`, `addition_date`, `modified_date`)
- `check_many_*` — проверяет массив объектов того же типа
- `eq(required: dict)` — проверяет точное соответствие переданного словаря

Декоратор `@trying` оборачивает валидатор в try/except, возвращая `(False, error_message)` при исключении.

Декоратор `@parsed("type")` автоматически извлекает JSON из ответа и проверяет наличие обязательных полей соответствующего типа.

### auth_helper.py

```python
from scenarios.auth_helper import register_or_auth

result = register_or_auth("username", "password")
# Возвращает: {"id": ..., "token": ..., "accessToken": ...}
```

Функция:
1. Пытается залогиниться (`POST /auth/login`)
2. Если 401 — регистрируется (`POST /auth/register`) и логинится
3. Получает access token через `POST /auth/refresh` с `Refresh-Token`

---

## Добавление нового сценария

1. Создайте файл в `scenarios/`, например `scenarios/my_feature.py`:

```python
from tests.templates import Test, Scenario, GatewayStep
from tests.test_variables import *

scenarios: list[Scenario] = []

def register_my_feature_scenario():
    tests = []

    # Аутентификация
    tests.append(Test(
        headers={"Content-Type": "application/json; charset=utf-8"},
        request="auth/login", method="POST",
        data={"username": "adminTester", "password": "TestPass"},
        requirement=OK
    ))

    # GET с проверкой структуры ответа
    tests.append(Test(
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": "{steps.0.accessToken}"
        },
        request="groups/1", method="GET",
        requirement=OK,
        is_valid=check_group_data
    ))

    steps = [GatewayStep(t) for t in tests]
    scenarios.append(Scenario("MyFeature", steps))
```

2. Зарегистрируйте сценарий в `test.py`:

```python
from scenarios.my_feature import register_my_feature_scenario, scenarios as mf_scenarios

# В секции сценариев:
elif scenario == "MyFeature":
    register_my_feature_scenario()

# В all_scenarios:
all_scenarios = gw_scenarios + up_scenarios + gi_scenarios + cl_scenarios + gs_scenarios + cs_scenarios + ei_scenarios + mf_scenarios
```

3. Запустите:

```bash
./test.sh 15 -S MyFeature
```

### Рекомендации

- Для запросов, где в заголовках есть `Authorization: {steps.N.accessToken}`, всегда используйте `GatewayStep`, а не `Step`
- Для тестов без токена в заголовках можно использовать обычный `Step`
- Определяйте тестовые данные (словари) на уровне модуля, а не внутри функции
- Используйте валидаторы из `validation.py` вместо ручной проверки статуса, чтобы убедиться и в структуре ответа
- Если в сценарии нужно несколько пользователей — используйте `auth_helper.register_or_auth()` или зарегистрируйте их в начале сценария

---

## Чтение результатов

После выполнения `test.sh` выводится сводка:

```
╔═══════════════════════════════════════╗
║         Сводка тестирования           ║
╚═══════════════════════════════════════╝

=== Всего запросов ===
<число>

=== Распределение статусов ===
<сколько 201, 200, 403, 404, 401>

=== Ошибок в тестах ===
<0 = всё ок>

=== Стартовые логи Gateway ===
<первые 10 строк [Engine]>

=== Any 501? ===
✅ Нет
```

Логи сохраняются в `logs/`:

| Файл | Содержание |
|---|---|
| `test.log` | Вывод `test.py` — все REQUEST, ERROR, отладочные сообщения |
| `server.log` | Логи контейнера `api-gateway` |
| `all.log` | Логи всех контейнеров, кроме `api-gateway` |
| `db.log` | Логи `mongo` и `mysql` |

---

## docker-compose.yaml

Поднимает 5 сервисов:

| Сервис | Контейнер | Зависит от |
|---|---|---|
| `mongo` | `mongo-db-gateway-test` | — |
| `mysql` | `mysql-db-gateway-test` | — (с healthcheck) |
| `auth-service` | `auth-service-gateway-test` | mysql (healthy) |
| `users-service` | `users-service-gateway-test` | mysql (healthy) |
| `campaign-service` | `campaign-service-gateway-test` | mongo (healthy), mysql (healthy) |
| `api-gateway` | `api-gateway` | auth, users, campaign (started) |

Порты: `5000:5000` — gateway доступен на `localhost:5000`.
