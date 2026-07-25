# Инструкция по миграции: общая БД → отдельные БД для каждого сервиса

## Общая схема

```
backup.sh → split-dump.sh → apply changes → restore.sh → verify
```

## Терминология

- **Стенд** — запущенный Docker Compose стек (MySQL + сервисы)
- **Дамп** — SQL-файл с данными
- **Split-дамп** — три файла: `auth.sql`, `users.sql`, `campaign.sql`

## Пререквизиты

- Стек запущен (`docker compose ps` — все сервисы зеленые)
- Есть доступ к `scripts/` скриптам
- `.env` заполнен (включая новые `AUTH_DATABASE`, `USERS_DATABASE`, `CAMPAIGN_DATABASE`)

## Шаг 1 — Полный дамп и его верификация

```bash
cd backend

# 1.1 Делаем полный дамп через split-dump.sh
../scripts/split-dump.sh -f docker-compose.yaml -o ./backups/pre_migration

# Результат:
# ./backups/pre_migration/
#   ├── full_dump.sql        # Полный дамп всех БД
#   ├── auth.sql             # Таблицы auth (auth_data)
#   ├── users.sql            # Таблицы users (user, linked_services)
#   └── campaign.sql         # Таблицы campaign (остальные)

# 1.2 Проверяем, что дамп читается
head -50 ./backups/pre_migration/full_dump.sql
```

**Что проверяем**: дамп не пустой, header корректен, таблицы присутствуют.

## Шаг 2 — Применение изменений в проекте

### 2.1 Init-скрипты MySQL

Создать для каждого сервиса `.sh` + `.sql` файлы:

| Файл | Назначение |
|------|-----------|
| `auth-service/init-auth.sh` | Создаёт БД `${AUTH_DATABASE}` |
| `auth-service/auth_schema.sql` | CREATE TABLE для auth_data |
| `users-service/init-users.sh` | Создаёт БД `${USERS_DATABASE}` |
| `users-service/users_schema.sql` | CREATE TABLE для user, linked_services |
| `campaign-service/init-campaign.sh` | Создаёт БД `${CAMPAIGN_DATABASE}` |
| `campaign-service/campaign_schema.sql` | CREATE TABLE для всех таблиц campaign |

Старые `sql_script.sql` удалить или переименовать.

### 2.2 Connection strings

В `docker-compose.yaml` (основной) и `api-gateway/tests/docker-compose.yaml` (тестовый):

```yaml
auth-service:
  environment:
    - MYSQL_CONNECTION_STRING=server=mysql;database=$AUTH_DATABASE;user=$MYSQL_USER;password=$MYSQL_PASSWORD;

users-service:
  environment:
    - MYSQL_CONNECTION_STRING=server=mysql;database=$USERS_DATABASE;user=$MYSQL_USER;password=$MYSQL_PASSWORD;

campaign-service:
  environment:
    - MYSQL_CONNECTION_STRING=server=mysql;database=$CAMPAIGN_DATABASE;user=$MYSQL_USER;password=$MYSQL_PASSWORD;
```

### 2.3 Program.cs — автосоздание таблиц

В `Program.cs` каждого C#-сервиса **после** `builder.Build()` добавить:

```csharp
var app = builder.Build();

// Автосоздание таблиц при первом запуске
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<LoginContext>();
    db.Database.EnsureCreated();
}

// ... остальной код
```

Конкретно:

| Сервис | DbContext |
|--------|-----------|
| auth-service | `LoginContext` |
| users-service | `UserContext` |
| campaign-service | Нужно добавить для всех 5 контекстов: `GroupContext`, `EntityContext`, `SkillsContext`, `ItemsContext`, `PolicesContext` |

### 2.4 Test `.env` — добавить новые переменные

В `api-gateway/tests/.env` добавить:

```
AUTH_DATABASE=tdn_auth_test
USERS_DATABASE=tdn_users_test
CAMPAIGN_DATABASE=tdn_campaign_test
```

### 2.5 Montирование init-скриптов

В обоих `docker-compose.yaml` заменить старые монтирования `sql_script.sql` на новые `.sh`:

```yaml
mysql:
  volumes:
    - ./mysql_data:/var/lib/mysql
    - ./auth-service/init-auth.sh:/docker-entrypoint-initdb.d/0_auth.sh
    - ./auth-service/auth_schema.sql:/docker-entrypoint-initdb.d/0_auth_schema.sql
    - ./users-service/init-users.sh:/docker-entrypoint-initdb.d/1_users.sh
    - ./users-service/users_schema.sql:/docker-entrypoint-initdb.d/1_users_schema.sql
    - ./campaign-service/init-campaign.sh:/docker-entrypoint-initdb.d/2_campaign.sh
    - ./campaign-service/campaign_schema.sql:/docker-entrypoint-initdb.d/2_campaign_schema.sql
```

## Шаг 3 — Тестирование с нуля (чистый стек)

```bash
cd backend/api-gateway/tests

# Запустить тесты — они очистят mysql_data и пересоздадут БД с нуля
./test.sh 10
```

**Ожидаемый результат**: все 14 сценариев проходят (зеленые).

Если нет — **остановиться**. Проверить логи, исправить ошибки, повторить.

## Шаг 4 — Тестирование миграции данных

```bash
cd backend

# 4.1 Сбросить стек до чистого состояния
docker compose down -v
docker compose up -d --wait

# 4.2 Восстановить данные из split-дампов
../scripts/restore.sh -f docker-compose.yaml -d ./backups/pre_migration

# 4.3 Перезапустить сервисы — они подхватят данные
docker compose restart

# 4.4 Проверить логи — нет ли ошибок подключения
docker compose logs auth-service | tail -20
docker compose logs users-service | tail -20
docker compose logs campaign-service | tail -20

# 4.5 Ручная проверка конца-в-конец
# Зарегистрироваться, создать группу, персонажа — данные должны сохраниться
```

## Шаг 5 — Боевой переезд

```bash
cd backend

# 5.1 Полный бэкап на всякий случай
../scripts/backup.sh -f docker-compose.yaml

# 5.2 Разделение дампа
../scripts/split-dump.sh -f docker-compose.yaml

# 5.3 Остановить стек
docker compose down

# 5.4 Удалить MySQL volume (осторожно — все данные в MySQL будут стерты!)
docker compose rm -f mysql
sudo rm -rf ./mysql_data

# 5.5 Запустить MySQL, дождаться инициализации
docker compose up -d mysql --wait

# 5.6 Восстановить данные
../scripts/restore.sh -f docker-compose.yaml -d ./backups/split_dump/yyyyMMdd_hhmmss

# 5.7 Запустить остальные сервисы
docker compose up -d

# 5.8 Прогнать тесты
cd api-gateway/tests && ./test.sh 10

# 5.9 Проверить приложение вручную
```

## Шаг 6 — Откат (если что-то пошло не так)

```bash
cd backend
docker compose down

# Восстановить mysql_data из бекапа (если делали cp -r)
sudo rm -rf ./mysql_data
sudo cp -r ./mysql_data.bak ./mysql_data

# Откатить изменения в коде (git checkout или git revert)
git checkout -- docker-compose.yaml
git checkout -- auth-service/
git checkout -- users-service/
git checkout -- campaign-service/

docker compose up -d
```

## Чеклист перед боевым переездом

- [ ] `backup.sh` запущен — бэкап создан
- [ ] `split-dump.sh` запущен — `auth.sql`, `users.sql`, `campaign.sql` созданы
- [ ] Дамп верифицирован (не пустой, таблицы на месте)
- [ ] Тесты проходят на чистом стеке (шаг 3)
- [ ] Тесты проходят с восстановленными данными (шаг 4)
- [ ] `git commit` всех изменений
- [ ] Есть план отката
