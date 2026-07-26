# План: Переход с `EnsureCreated()` на EF Core Migrations

## Зачем

- `EnsureCreated()` не обновляет существующие таблицы — новая колонка в модели не появится в БД
- Нет `__EFMigrationsHistory` — нельзя откатить или версионировать изменения
- При изменении модели придётся дропать БД и создавать заново

## Шаг 1 — Установка dotnet-ef tool

```bash
dotnet tool install --global dotnet-ef
```

Для каждого сервиса добавить пакет `Microsoft.EntityFrameworkCore.Design`:

```bash
cd backend/auth-service
dotnet add package Microsoft.EntityFrameworkCore.Design
```

То же для users-service и campaign-service.

## Шаг 2 — Сгенерировать InitialCreate миграции

### Зачем нужны переменные окружения

`dotnet ef migrations add` запускает код проекта через `Program.cs`/`ConfigParser`, который в конструкторе читает env-переменные (`MYSQL_CONNECTION_STRING`, `MYSQL_DATABASE`). Без них команда упадёт.

Connection string может указывать на любую БД (даже несуществующую) — EF Core строит модель без подключения к MySQL.

### auth-service

```bash
cd backend/auth-service
export MYSQL_CONNECTION_STRING="server=localhost;database=tdn_auth;user=root;password=root"
dotnet ef migrations add InitialCreate --context LoginContext -o Migrations
```

### users-service

```bash
cd backend/users-service
export MYSQL_CONNECTION_STRING="server=localhost;database=tdn_users;user=root;password=root"
dotnet ef migrations add InitialCreate --context UserContext -o Migrations
```

### campaign-service

Для `CampaignContext` ConfigParser требует ещё и `MONGO_CONNECTION_STRING`:

```bash
cd backend/campaign-service
export MYSQL_CONNECTION_STRING="server=localhost;database=tdn_campaign;user=root;password=root"
export MONGO_CONNECTION_STRING="mongodb://localhost:27017"
dotnet ef migrations add InitialCreate --context CampaignContext -o Migrations
```

## Шаг 3 — Заменить `EnsureCreated()` → `Migrate()` в Program.cs

Во всех трёх сервисах заменить:

```csharp
ctx.Database.EnsureCreated();
```

На:

```csharp
ctx.Database.Migrate();
```

Retry-цикл остаётся — миграция тоже может упасть, если MySQL не готов.

## Шаг 4 — Первый запуск с Migrate()

Если таблицы уже созданы через `EnsureCreated()`, `Migrate()` упадёт — он увидит, что `__EFMigrationsHistory` пустая, и попробует применить `InitialCreate`, а таблицы уже есть.

**Для dev/тестов** — дропнуть volume и создать заново:

```bash
cd backend
docker compose down -v
docker compose up -d
```

**Для прода** — либо:

1. Сделать дамп данных
2. Дропнуть БД
3. Применить миграцию
4. Восстановить дамп

Либо сгенерировать пустую миграцию как snapshot существующей схемы (сложнее).

## Шаг 5 — Дальнейшие изменения модели

После `InitialCreate` каждая новая миграция:

```bash
export MYSQL_CONNECTION_STRING="..."
# ...
dotnet ef migrations add <MigrationName> --context <Context>
```

`docker compose up -d` автоматом применит все неприменённые миграции через `Migrate()`.

## Риски

| Риск | Решение |
|------|---------|
| `dotnet ef` не может зарезолвить Mongo для campaign | Задать `MONGO_CONNECTION_STRING` в env |
| Миграция упадёт, если таблицы уже созданы | Сбросить volume (dev) или вручную подменить `__EFMigrationsHistory` (prod) |
