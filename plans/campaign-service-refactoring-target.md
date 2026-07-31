# Целевое состояние campaign-service — Refactoring Target

## 1. Мета-информация

| Поле | Значение |
|------|----------|
| **Статус** | Черновик |
| **Основание** | Extended Council audit |
| **Цель** | Устранить 5 корневых дефектов архитектуры campaign-service |

---

## 2. Проблемы и мотивация

### 2.1. `userId` query param bypass (корневой дефект)

28+ мест в контроллерах проверяют доступ через опциональный `[FromQuery] int? userId`. В `GroupsBaseController.cs`:

```
if (userId == null) return true;
```

Это client-supplied identity без верификации — любой запрос без параметра `userId` получает полный доступ. Проблема усугубляется тем, что часть контроллеров не наследует `GroupsBaseController` и не имеет доступа к `CheckGroupAccess` вовсе (например, `GroupNotesController` — декларирует `string? userId` и никогда его не использует).

**Решение:** Единственный источник identity — `X-Subject` header, разобранный `SubjectPresentMiddleware`. `SubjectAccessHelper` — единый gateway всех решений об access. Никакой query param.

### 2.2. Фрагментированная иерархия контроллеров

Из 19 контроллеров:
- 10 наследуют `BaseController` напрямую
- 8 наследуют `GroupsBaseController`
- 1 наследует промежуточный `CharactersBaseController` (пустой, exists only as pass-through)

`GroupSkillsController` определяет собственный private `CheckAccess()` — дублирует `GroupAccessHelper.HasGroupAccess`. `GroupNotesController`, `CharacterSkillsController` и другие не имеют доступа к `GroupsBaseController.CheckGroupAccess()` вовсе.

**Решение:** Единая цепочка `BaseController → GroupsBaseController → Domain-specific controllers`. `GroupsBaseController` предоставляет `CampaignContext`, `SubjectAccessHelper`, `TryGetGroup`, `TryGetCharacter`. `BaseController` остаётся для не-group сущностей.

### 2.3. PermissionLevel.None для quests и polices

В `CampaignAccessMiddleware.GetRequiredPermission`:
- `GET /groups/{id}/quests` → `None` (пропускает без проверки)
- `GET /polices/groups` → `None` (пропускает без проверки)

**Решение:** Минимальный уровень — `Member` для GET, `Admin` для POST/PUT/DELETE. `None` удаляется из middleware.

### 2.4. Provider-level access control (несогласованность)

`QuestsProvider.GetQuests(groupId, userId?, characterId?)` — единственный провайдер, делающий data-level filtering (character-based, скрывает квесты, не назначенные персонажам пользователя).

`NotesProvider`, `ItemsProvider`, `SkillsProvider` — не фильтруют.

**Решение:** Консистентный подход: провайдеры НЕ делают access control. Только бизнес-логика и data-level scoping по groupId/characterId (которые уже проверены middleware). Character-based filtering для quests переносится из провайдера в middleware-логику или остаётся в провайдере, но без `userId` — через `SubjectAccessHelper`.

### 2.5. Race condition DualDbRepository (Mongo → SQL deferred)

`DualDbRepository.TryCreate` сначала пишет в Mongo (получает ObjectId), потом в SQL. При падении между операциями — orphan в Mongo.

**Решение (концептуальное):**
- В идеале: паттерн Outbox — запись в SQL (с флагом `PendingMongoSync`), фоновый процесс синхронизирует в Mongo
- Приемлемый минимум: компенсационные транзакции (если SQL упал — удалить Mongo-документ)
- Де-факто: deferred, текущее поведение документируется как known accepted risk

---

## 3. Целевая архитектура

### 3.1. Pipeline

```
X-Subject header (от api-gateway)
  → SubjectPresentMiddleware
      → HttpContext.Items["Subject"]
  → CampaignAccessMiddleware (Member по умолчанию, Admin для writes)
      → SubjectAccessHelper (проверка членства)
      → 403 при несовпадении
  → Controller (GroupsBaseController)
      → SubjectAccessHelper для domain-specific проверок (character-level)
      → Provider (чистая бизнес-логика)
```

### 3.2. Роли компонентов

| Компонент | Роль |
|-----------|------|
| **api-gateway** | Парсит JWT, формирует X-Subject. Не делает `/polices/groups`. Не подставляет `?userId=`. Dumb proxy. |
| **SubjectPresentMiddleware** | Парсит X-Subject header → Subject record → `HttpContext.Items["Subject"]`. Если заголовка нет — ничего не делает (обратная совместимость с админ-панелью). |
| **CampaignAccessMiddleware** | Определяет `PermissionLevel` по пути+методу. Проверяет членство (`HasGroupAccess`), character access, admin, character write. Единственный gate. PermissionLevel.None удалён. |
| **SubjectAccessHelper** | Обёртка над `GroupAccessHelper`. Ветвление по `SubjectType`. Используется middleware и контроллерами. Никакой query param. |
| **GroupsBaseController** | Предоставляет `SubjectAccessHelper`, `TryGetGroup`, `TryGetCharacter`. Все group-scoped контроллеры наследуют его. |
| **Provider** | Чистая бизнес-логика. Не принимает `userId`. Не делает access control. Фильтрует только по groupId/characterId (уже проверены middleware). |

### 3.3. PermissionLevel mapping (целевой)

| Path pattern | GET | POST | PUT | PATCH | DELETE |
|---|---|---|---|---|---|
| `/groups/{id}` | Member | — | — | Admin | Admin |
| `/groups/{id}/users` | Member | Admin | — | — | Admin |
| `/groups/{id}/items` | Member | Admin | Admin | — | Admin |
| `/groups/{id}/skills` | Member | Admin | Admin | — | Admin |
| `/groups/{id}/schemas` | Member | Admin | Admin | — | Admin |
| `/groups/{id}/export` | Member | — | — | — | — |
| `/groups/{id}/import` | — | Admin | — | — | — |
| `/groups/{id}/quests` | **Member** (было None) | **Member** (было None) | Admin | **Member** (было None) | Admin |
| `/groups/{id}/notes/{id}` | Admin | Admin | Admin | — | Admin |
| `/groups/{id}/polices` | **Member** (было None) | Admin | — | — | Admin |
| `/groups/{id}/characters` | Member | *Member | — | — | — |
| `/groups/{id}/characters/{charId}` | Member | — | — | CharacterWrite | CharacterWrite |
| `/groups/{id}/characters/{charId}/users` | Member | Admin | — | — | — |
| `/groups/{id}/characters/{charId}/items` | Member | CharacterWrite | — | — | CharacterWrite |
| `/groups/{id}/characters/{charId}/notes` | Member | CharacterWrite | — | — | CharacterWrite |
| `/groups/{id}/characters/{charId}/skills` | Member | CharacterWrite | — | — | CharacterWrite |
| `/groups/{id}/characters/{charId}/equipment` | CharacterWrite | CharacterWrite | — | — | CharacterWrite |
| `/groups/{id}/characters/{charId}/log` | Member | — | — | — | — |
| `/schemas/groups/{groupId}/items` | Member | Admin | Admin | — | Admin |
| `/schemas/groups/{groupId}/skills` | Member | Admin | Admin | — | Admin |
| `/schemas/groups/{groupId}/template` | Member | Admin | Admin | — | Admin |
| `/schemas/groups/{groupId}/characters` | Member | Admin | Admin | — | Admin |

Все пути, где было `None`, поднимаются до `Member`. Исключений нет.

---

## 4. Изменения концептуально (без кода)

### 4.1. Access control

- **Удалить** все `[FromQuery] int? userId` из контроллеров (28+ мест)
- **Удалить** `CheckGroupAccess(groupId, userId?)` и `CheckCharacterAccess(groupId, userId?)` из `GroupsBaseController` — их заменяет `SubjectAccessHelper`
- **Удалить** private `CheckAccess()` из `GroupSkillsController`
- **Удалить** `userId` из сигнатур всех методов провайдеров (`GroupProvider.GetAll`, `QuestsProvider.GetQuests`, `GroupPolicesProvider.*`)
- **Добавить** `SubjectAccessHelper` как protected свойство в `GroupsBaseController`
- **Удалить** `GroupAccessHelper` из прямого use в контроллерах (заменить на `SubjectAccessHelper`)
- **Удалить** `PermissionLevel.None` из `CampaignAccessMiddleware`

### 4.2. Controller hierarchy

- `GroupSkillsController` → переходит на `GroupsBaseController`
- `GroupAttributesController` → переходит на `GroupsBaseController`
- `GroupNotesController` → переходит на `GroupsBaseController`
- `CharacterNotesController` → переходит на `GroupsBaseController` (предоставляет `TryGetCharacter`)
- `CharacterSkillsController` → переходит на `GroupsBaseController`
- `GroupsPolicesController` → переходит на `GroupsBaseController`
- `GroupSchemasController` → переходит на `GroupsBaseController`
- `CharacterTemplateSchemaController` → переходит на `GroupsBaseController`
- `CharacterResourcesSchemaController` → переходит на `GroupsBaseController`
- `CharactersBaseController` → убрать (слить в `GroupsBaseController` или оставить для character-specific helpers)

Итог: все контроллеры, работающие с group-scoped ресурсами, наследуют `GroupsBaseController`. `BaseController` остаётся только для не-group сущностей (если такие появятся в будущем).

### 4.3. Provider pattern

- Все провайдеры перестают принимать `userId` параметр
- Data-level filtering — только по groupId/characterId (проверены middleware)
- Character-based filtering для quests: middleware пропускает Member+; на уровне контроллера/провайдера — фильтрация по characterId из SubjectAccessHelper (если character-scoped)
- DualDbRepository — deferred, documented known risk

### 4.4. Middleware

- `CampaignAccessMiddleware.GetRequiredPermission`: убрать все case-ы, возвращающие `None`
- Минимальный уровень для всех group-scoped GET — `Member`
- `SubjectPresentMiddleware` остаётся без изменений (уже реализован)

### 4.5. Логирование

- Все решения `SubjectAccessHelper` логируются на info-level
- `CampaignAccessMiddleware` логирует принятые решения (level + groupId + subject)
- Контроллеры не дублируют логирование доступа (только бизнес-логика)

---

## 5. Контракт API (что видит клиент)

### 5.1. Нельзя менять

- Существующие эндпоинты (пути, методы)
- Типы ответов (response models)
- Статус-коды
- Формат ошибок

### 5.2. Можно менять

- Убрать `?userId=` query param (он опциональный, клиенты его не шлют — его подставлял gateway)
- Добавить новые статус-коды только если их возвращал `CampaignAccessMiddleware` (403) — они уже есть

### 5.3. Что изменится для клиента при неправильном использовании

- Раньше: `GET /groups/{id}/items?userId=` → проверка в контроллере
- Теперь: `GET /groups/{id}/items` → middleware проверяет X-Subject → если Subject нет → 403 (раньше было null bypass → allow)
- Клиенты, которые ходили без userId (админ-панель), должны передавать `X-Subject: {"type":"admin","id":0}`

---

## 6. Миграционная стратегия (пофазовая)

### Фаза 0 — Уже сделано
- SubjectPresentMiddleware
- SubjectAccessHelper
- inject_x_subject handler в api-gateway
- Аудит null bypass путей

### Фаза 1 — Controller hierarchy (campaign-service only)
- Перевести 9 контроллеров с `BaseController` на `GroupsBaseController`
- `GroupsBaseController` получает `SubjectAccessHelper` (protected)
- `CharactersBaseController` — решить: оставить или слить
- Удалить private `CheckAccess()` из `GroupSkillsController`
- Никаких изменений access control — только иерархия

### Фаза 2 — Удаление userId из контроллеров
- Удалить `[FromQuery] int? userId` из всех action methods
- Заменить `CheckGroupAccess` / `CheckCharacterAccess` на `SubjectAccessHelper.HasGroupAccess` / `HasCharacterAccess`
- `GroupsBaseController.CheckGroupAccess` и `CheckCharacterAccess` — удалить
- `GroupSkillsController` — заменить private `CheckAccess()` на `SubjectAccessHelper`

### Фаза 3 — Удаление PermissionLevel.None
- Поднять PermissionLevel для quests (GET) и polices (GET) с None до Member
- Все остальные None не найдены (проверить grep'ом)
- После этого Middleware становится единственным gate

### Фаза 4 — Provider cleanup
- Удалить `userId` из `GroupProvider.GetAll` / `Create`
- Удалить `userId` из `QuestsProvider.GetQuests` (заменить на SubjectAccessHelper внутри провайдера, если character-filtering нужен)
- Удалить `userId` из `GroupPolicesProvider.*`
- Character-based filtering: решить, где он живёт (провайдер или сервис-слой над провайдером)

### Фаза 5 — DualDbRepository (опционально, deferred)
- Паттерн Outbox или компенсационные транзакции
- Документировать accepted risk

---

## 7. Риски

| Риск | Описание | Митигация |
|------|----------|-----------|
| **Админ-панель без X-Subject** | Ходит напрямую, получит 403 везде | Добавить Subject(Admin,0) fallback в SubjectPresentMiddleware, если админ-панель не может отправлять X-Subject |
| **Service token без X-Subject** | Если gateway не пробрасывает X-Subject для service token | Уже пробрасывает (inject_x_subject). Проверить все пути. |
| **Character-based filtering для quests** | QuestsProvider — единственный с data-level filtering. Перенос логики может сломать фильтрацию. | Оставить filtering в провайдере, но убрать userId — заменить на Subject из SubjectAccessHelper |
| **Тесты** | Gateway тесты (320) могут ожидать null bypass. C# unit тестов почти нет. | Прогонять gateway тесты после каждой фазы. Добавить C# unit тесты для SubjectAccessHelper + middleware |
| **Порядок middleware** | SubjectPresentMiddleware должен быть до CampaignAccessMiddleware | Проверить Program.cs order |

---

## 8. Что НЕ делаем

- ❌ Не пишем код — этот документ концептуальный
- ❌ Не меняем базу данных (MySQL/MongoDB схемы)
- ❌ Не меняем response models
- ❌ Не добавляем новых эндпоинтов
- ❌ Не трогаем api-gateway (кроме уже сделанного inject_x_subject)
- ❌ Не убираем GroupAccessHelper (он нужен SubjectAccessHelper как делегат)
