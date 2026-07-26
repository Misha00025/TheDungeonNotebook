# План перехода на EF Core Migrations

## Текущая ситуация

Три C# сервиса (auth-service, users-service, campaign-service) используют
`Database.EnsureCreated()` для создания схемы БД при старте. Это опасный паттерн:

- Создаёт таблицы только при первом запуске
- При изменении модели **молча ничего не делает**
- Единственный способ применить изменения — дропнуть и пересоздать БД

Пакеты `Microsoft.EntityFrameworkCore.Design` и `Tools` уже установлены во всех
трёх сервисах, но не используются. Init-скрипты (`init-*.sh`) создают только
БД и гранты — таблицы не трогают.

---

## 1. Pre-migration: общие задачи

### 1.1 Создать shared class library для общих сущностей

**Проблема:** `IndexedData`, `BaseDbContext<T>`, `IEntityBuildersConfigurer`
дублируются во всех сервисах. Это мешает миграциям — каждая копия живущая.
Кроме того, при разделении на отдельные БД это дублирование оправдано, но
для миграций и поддержки неудобно.

**Решение:** Вынести `BaseDbContext<T>` и `IEntityBuildersConfigurer` в общую
библиотеку (например `Tdn.Common`), если они действительно идентичны во всех
сервисах. Если нет — хотя бы синхронизировать.

**Оценка:** Можно отложить, не блокирует миграции.

### 1.2 Добавить `IDesignTimeDbContextFactory` для каждого DbContext

EF Core требует фабрику для `dotnet ef migrations add`, т.к. контексты
принимают `IEntityBuildersConfigurer` через DI.

**Где нужно:**

| Сервис | DbContext | Файл |
|--------|-----------|------|
| auth-service | `LoginContext` | `Source/Db/DesignTimeDbContextFactory.cs` |
| users-service | `UserContext` | `Source/Db/DesignTimeDbContextFactory.cs` |
| campaign-service | 6 MySQL контекстов | `Source/Models/Db/DesignTimeDbContextFactory.cs` |

Шаблон фабрики (один на сервис, с переключателем по контексту):

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Tdn.Configuration;

namespace Tdn.Db.Contexts;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<LoginContext>
{
    public LoginContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<LoginContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new LoginContext(optionsBuilder.Options, configurer);
    }
}
```

Для campaign-service — одна фабрика, возвращающая нужный контекст по
командной строке или环境 переменной.

---

## 2. auth-service

### 2.1 Текущее состояние
- 1 DbContext: `LoginContext`
- 1 entity: `UserData` → таблица `auth_data`
- `Program.cs:36-54`: `ctx.Database.EnsureCreated()` с retry

### 2.2 План

1. Создать `DesignTimeDbContextFactory`
2. Сгенерировать миграцию:
   ```bash
   dotnet ef migrations add InitialCreate
   ```
3. Заменить в `Program.cs`:
   ```diff
   - ctx.Database.EnsureCreated();
   + ctx.Database.Migrate();
   ```
4. Проверить, что `retry`-цикл работает с `Migrate()` так же корректно

### 2.3 Особенности
- Единственный контекст, всё прямолинейно
- `UserData` использует **public fields** (`int Id`), не auto-properties — EF
  Core это поддерживает, миграция сгенерируется корректно

---

## 3. users-service

### 3.1 Текущее состояние
- 1 DbContext: `UserContext`
- 2 entity: `UserData` → таблица `user`, `LinkedServicesData` → `linked_services`
- `Program.cs:22-41`: `ctx.Database.EnsureCreated()` с retry

### 3.2 План
Аналогично auth-service:
1. Создать `DesignTimeDbContextFactory`
2. Сгенерировать `InitialCreate`
3. Заменить `EnsureCreated()` → `Database.Migrate()`

### 3.3 Особенности
- `LinkedServicesData.HasOne(l => l.User).WithMany()` — navigation property на
  `UserData`. Валидно, миграция сгенерирует FK.
- Все entity — public fields, не auto-properties.

---

## 4. campaign-service

### 4.1 Текущая архитектура контекстов

```
BaseDbContext<T>
├── GroupContext          — Groups
├── EntityContext         — Notes, NoteKeywords, Quests, QuestAssignments
│   ├── ItemsContext      — + Items, CharacterItems  (наследует EntityContext)
│   └── SkillsContext     — + Skills, CharacterSkills (наследует EntityContext)
├── PolicesContext        — UserGroup, UserCharacter
└── CampaignContext       — ВСЕ 13 entity (только для EnsureCreated!)
```

Иерархия наследования `ItemsContext : EntityContext` и
`SkillsContext : EntityContext` **странная**: ItemsContext и SkillsContext
получают лишние DbSet'ы (Notes, Quests) через наследование, хотя они им не
нужны. `EntityContext::OnModelCreating` конфигурирует entity, для которых у
него нет DbSet'ов (GroupData, ItemData и т.д.) — эти конфигурации
«наследуются» дочерними контекстами, где они нужны.

**Использование контекстов:**

| Контекст | Инжектится | Используется для |
|----------|-----------|------------------|
| GroupContext | Да, в 10 местах | Контроллеры групп |
| EntityContext | Да, в 7 местах | Providers (Notes, Quests) |
| ItemsContext | Да, в 2 местах | ItemsProvider |
| SkillsContext | Да, в 2 местах | SkillsProvider |
| PolicesContext | Да, в 3 местах | GroupAccessHelper, PolicesController |
| CampaignContext | **Нет** | Только EnsureCreated в Program.cs |

### 4.2 Стратегия миграций

Есть два варианта:

#### Вариант A (минимальный, рекомендую)

Оставить текущую архитектуру как есть. Создать отдельную миграцию для каждого
из 6 контекстов. Каждая миграция будет содержать только те таблицы, которые
определены в соответствующем контексте.

**Плюсы:**
- Ничего не ломается, все контексты продолжают работать как раньше
- Каждый провайдер работает со «своим» контекстом
- Минимальные изменения

**Минусы:**
- Наследование `ItemsContext : EntityContext` остаётся кривым
- 6 миграций вместо одной
- EF Migration History будет одна (общая БД), названия миграций нужно
  координировать

#### Вариант B (рефакторинг + миграция)

1. Упростить иерархию: `ItemsContext` и `SkillsContext` наследуют напрямую от
   `BaseDbContext`, а не от `EntityContext`
2. Каждый контекст держит только свои DbSet'ы и конфигурирует только их
3. `EntityContext` перестаёт конфигурировать entity без своих DbSet'ов
4. `CampaignContext` больше не нужен — удаляем
5. Создать 5 миграций (GroupContext, EntityContext, ItemsContext, SkillsContext,
   PolicesContext)

**Плюсы:**
- Архитектура становится чище
- Контексты не имеют лишних зависимостей
- `CampaignContext` — мёртвый код, убираем

**Минусы:**
- Нужно проверить, что `EntityBuildersConfigurer` не перестанет работать из-за
  того, что конфигурации через наследование больше не подхватываются
- Больше изменений, выше риск

### 4.3 План для campaign-service

1. **Выбрать вариант A или B**
2. Создать `DesignTimeDbContextFactory` для всех нужных контекстов
3. Для каждого контекста сгенерировать миграцию:
   ```bash
   dotnet ef migrations add InitialCreate_Group -c GroupContext
   dotnet ef migrations add InitialCreate_Entity -c EntityContext
   dotnet ef migrations add InitialCreate_Items -c ItemsContext
   dotnet ef migrations add InitialCreate_Skills -c SkillsContext
   dotnet ef migrations add InitialCreate_Polices -c PolicesContext
   # Если вариант B — CampaignContext не нужен
   ```
4. Заменить `EnsureCreated()` на `Database.Migrate()` для каждого контекста

   Текущий код в `Program.cs:52-71`:
   ```csharp
   var ctx = scope.ServiceProvider.GetRequiredService<CampaignContext>();
   // ... retry loop ...
   ctx.Database.EnsureCreated();
   ```

   Нужно заменить на запуск миграций для ВСЕХ используемых контекстов
   (GroupContext, EntityContext, ItemsContext, SkillsContext, PolicesContext),
   либо (если вариант B) — просто для CampaignContext, который включает все
   таблицы, а остальные контексты будут работать с уже созданными таблицами:

   ```csharp
   var contextsToMigrate = new[] {
       typeof(GroupContext), typeof(EntityContext),
       typeof(ItemsContext), typeof(SkillsContext), typeof(PolicesContext)
   };
   foreach (var ctxType in contextsToMigrate)
   {
       var ctx = (DbContext)scope.ServiceProvider.GetRequiredService(ctxType);
       // ... retry loop ...
       ctx.Database.Migrate();
   }
   ```

### 4.4 Особенности EntityBuildersConfigurer

`IEntityBuildersConfigurer` в campaign-service имеет 13 перегрузок
`ConfigureModel<T>()` — по одной на каждый entity. Каждый контекст в
`OnModelCreating` вызывает `Configurer.ConfigureModel()` только для
нужных ему entity.

Если мы реструктурируем контексты (вариант B), нужно проверить, что:
- `ItemsContext.OnModelCreating` вызывает `ConfigureModel(ItemData)` и
  `ConfigureModel(CharacterItemData)` — это и так происходит
- Конфигурации, которые раньше пробрасывались через наследование
  (`GroupData` в EntityContext → ItemsContext), теперь не нужны —
  ItemsContext их не использует

### 4.5 MongoDB

MongoDB схема-он-райт — миграции не нужны. Единственное, что можно
сделать — добавить `EnsureCollectionsCreated()` или явное создание
коллекций при старте, если это критично. По умолчанию коллекции
создаются при первой вставке документа.

MongoDB contexts (2):
- `MongoDbContext` — используется в 8+ местах, не трогать
- `SchemasMongoDbContext` — используется в 4 местах, не трогать

---

## 5. uploads-service, api-gateway, admin-panel

**Не имеют БД.** Миграции не нужны.

---

## 6. Переход без потери данных

### Проблема

На существующей БД таблицы уже созданы через `EnsureCreated()`.
Если просто добавить миграцию и вызвать `Database.Migrate()`, EF Core
попытается создать таблицы заново и упадёт с ошибкой «таблица уже
существует».

### Решение: snapshot-миграция

1. Сгенерировать миграцию из текущей модели (как описано выше)
2. Добавить ручную «пустую» миграцию, которая говорит EF Core, что
   схема уже актуальна

   **Способ 1 (через --idempotent):**
   ```bash
   dotnet ef migrations script --idempotent
   ```
   Сгенерирует SQL-скрипт с проверками `IF NOT EXISTS`. Применить
   напрямую к БД.

   **Способ 2 (создать пустую начальную миграцию):**
   ```bash
   dotnet ef migrations add InitialCreate
   # Удалить весь код из Up() и Down() — оставить пустым
   # Метод Up() будет пустым, но EF Core запишет в __EFMigrationsHistory,
   # что миграция применена
   ```

   Недостаток способа 2: при `dotnet ef migrations list` будет
   показано, что всё применено, но реальная схема не совпадает с
   моделью — может рассинхронизироваться.

   **Способ 3 (на staging — пересоздать БД):**
   Проще всего на не-продакшене: дропнуть БД, запустить сервис с
   `Database.Migrate()`, он создаст всё заново.

### Рекомендация

На текущем этапе (staging/development):
1. Создать миграции
2. Дропнуть БД (`docker compose down -v && rm -rf mysql_data/`)
3. Поднять всё с `Database.Migrate()`

Если нужно сохранить данные — вариант с `--idempotent`.

---

## 7. Проверка

После реализации каждого сервиса:

1. **Собрать проект:** `dotnet build`
2. **Сгенерировать SQL-скрипт миграции:**
   ```bash
   dotnet ef migrations script --idempotent -o migrate.sql
   ```
3. **Проверить `migrate.sql`** — DDL должен совпадать с текущей схемой
4. **Протестировать интеграционно:**
   - `docker compose down -v`
   - `docker compose up -d`
   - Проверить, что сервисы стартуют, таблицы создаются
   - Проделать типовые сценарии (регистрация, создание группы и т.д.)

---

## 8. Post-migration: чистка

После успешного перехода:
1. Удалить init-скрипты (`.sh`), которые только создают БД — они
   дублируются образом MySQL и docker-compose
   - `backend/auth-service/init-auth.sh`
   - `backend/users-service/init-users.sh`
   - `backend/campaign-service/init-campaign.sh`
2. Обновить docker-compose — убрать монтирование init-скриптов
3. Удалить мёртвый код (если выбран вариант B — `CampaignContext`)

---

## 9. Документация

Обновить:

- `rules/tech-csharp.md`:
  - Заменить секцию EF Core: вместо `EnsureCreated` — `Database.Migrate()`
  - Добавить команды создания миграций
  - Добавить шаблон `DesignTimeDbContextFactory`
  - Добавить команду генерации SQL-скрипта

- `AGENTS.md`:
  - При необходимости — упомянуть миграции в разделе Gateway действий
  - Добавить команду `dotnet ef migrations` в процесс разработки

- `rules/tech-docker.md`:
  - Обновить секцию init-скриптов (если они были удалены)

---

## 10. Итоговый план работ

| № | Задача | Сервис | Зависимости |
|---|--------|--------|------------|
| 1 | `DesignTimeDbContextFactory` | auth-service | — |
| 2 | `InitialCreate` миграция | auth-service | 1 |
| 3 | Замена `EnsureCreated` → `Migrate` | auth-service | 2 |
| 4 | `DesignTimeDbContextFactory` | users-service | — |
| 5 | `InitialCreate` миграция | users-service | 4 |
| 6 | Замена `EnsureCreated` → `Migrate` | users-service | 5 |
| 7 | Выбор варианта A/B для campaign-service | — | — |
| 8 | `DesignTimeDbContextFactory` | campaign-service | 7 |
| 9 | Миграции для всех MySQL контекстов | campaign-service | 7, 8 |
| 10 | Замена `EnsureCreated` → `Migrate` | campaign-service | 9 |
| 11 | Интеграционное тестирование | все | 3, 6, 10 |
| 12 | Чистка init-скриптов | — | 11 |
| 13 | Обновление документации | — | 11 |
