# Миграция campaign-service — поэтапный план

## Мета-информация

| Поле | Значение |
|------|----------|
| **Статус** | План |
| **Основание** | Extended Council audit → `campaign-service-refactoring-target.md` |
| **Цель** | Пошаговая миграция campaign-service с нулевой регрессией gateway-тестов |
| **Правило** | После каждого коммита — `./test.sh 15` проходит с 0 ошибок |

---

## Фаза 0 — уже сделано (не входит в план миграции)

- `SubjectPresentMiddleware` — парсит X-Subject header, кладёт в `HttpContext.Items["Subject"]`
- `SubjectAccessHelper` — обёртка над `GroupAccessHelper`, ветвление по `SubjectType`
- `inject_x_subject` handler в api-gateway — пробрасывает X-Subject в campaign-service
- Аудит null bypass путей

---

## Фаза 1 — Controller hierarchy fix

**Commit:** `feat: migrate 9 controllers to GroupsBaseController hierarchy`

### Что меняется

1. **9 контроллеров** переводятся с `BaseController` на `GroupsBaseController`:
   - `GroupSkillsController` — удалить private `CheckAccess()`, использовать наследуемый `CheckGroupAccess`
   - `GroupAttributesController`
   - `GroupNotesController` — добавить `CampaignContext` + `GroupAccessHelper` в конструктор (для base)
   - `CharacterNotesController` — добавить `CampaignContext` + `GroupAccessHelper` в конструктор (для base)
   - `CharacterSkillsController`
   - `GroupSchemasController`
   - `CharacterTemplateSchemaController`
   - `CharacterResourcesSchemaController`
   - `GroupsPolicesController` — добавить `CampaignContext` + `GroupAccessHelper` в конструктор (для base); `SubjectAccessHelper` остаётся в контроллере

2. **`CharactersBaseController`** — удалить (абстрактный класс-пустышка, ни у кого не наследуется). Его единственный конструктор и функциональность уже покрыты GroupsBaseController.

3. **`GroupsBaseController`** — без изменений access logic. Добавить `SubjectAccessHelper` как protected property (инжектится через DI, но не используется в `CheckGroupAccess` / `CheckCharacterAccess` — готовность к фазе 2).

4. **GroupsPolicesController** — уже использует `SubjectAccessHelper`. После перехода на GroupsBaseController получает доступ к `CampaignContext` через base (необходимо для конструктора base).

### Почему тесты не сломаются

- Access control logic **не изменяется** — все проверки доступа остаются через `[FromQuery] int? userId` и `GroupAccessHelper`
- `GroupSkillsController.CheckAccess()` → `GroupsBaseController.CheckGroupAccess()` — **идентичная логика** (обе: `if (userId == null) return true; return AccessHelper.HasGroupAccess(...)`)
- Контроллеры без access checks (`GroupNotesController`, `CharacterNotesController`) остаются без access checks
- Response models, статус-коды, роуты — без изменений
- `GroupsPolicesController` продолжает использовать `SubjectAccessHelper.IsAdmin()` как и раньше

### Что работает после коммита

- Все 19 контроллеров имеют единую цепочку наследования: `ControllerBase → BaseController → GroupsBaseController → Domain-specific`
- `SubjectAccessHelper` доступен protected во всех group-scoped контроллерах
- Все gateway-тесты проходят

---

## Фаза 2 — SubjectAccessHelper dualism (параллельные проверки)

**Commit:** `feat: add SubjectAccessHelper parallel access checks in GroupsBaseController`

### Что меняется

1. **`GroupsBaseController.CheckGroupAccess(groupId, userId?)`** — новая логика:
   ```
   result = false
   if (userId != null && AccessHelper.HasGroupAccess(groupId, userId.Value))
       result = true
   if (SubjectAccessHelper.HasGroupAccess(groupId))
       result = true
   return result
   ```
   — проверка проходит, если **хотя бы один** из механизмов (userId ИЛИ Subject) разрешает доступ

2. **`GroupsBaseController.CheckCharacterAccess(groupId, characterId, userId?)`** — аналогично:
   ```
   result = false
   if (userId != null && AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value))
       result = true
   if (SubjectAccessHelper.HasCharacterAccess(groupId, characterId))
       result = true
   return result
   ```

3. Все контроллеры, которые вызывают `CheckGroupAccess` / `CheckCharacterAccess`, **автоматически** получают Subject-проверку без изменений своего кода.

4. **Логирование расхождений:** Если userId-проверка разрешает, а Subject-проверка запрещает — пишется `LogWarning`. Это позволяет выявить дыры в Subject-механизме до полного переключения.

5. `GroupsPolicesController` — уже использует `SubjectAccessHelper` напрямую (не через base). Оставляем как есть — его логика не меняется.

### Почему тесты не сломаются

- **OR-логика** — если старый userId-путь разрешает доступ, Subject-проверка не блокирует
- Все существующие тесты передают `?userId=` (через gateway, который его подставляет) → userId != null → старая проверка работает
- SubjectAccessHelper уже проверен в `GroupsPolicesController` и `GroupQuestsController`
- Если Subject отсутствует — `SubjectAccessHelper` возвращает `false`, но userId-путь всё ещё разрешает → запрос не блокируется
- Логирование расхождений — только warn, не влияет на ответ

### Что работает после коммита

- Два механизма access control работают параллельно: userId-query-param (legacy) и Subject (новый)
- Все gateway-тесты проходят
- В логах видны расхождения, указывающие на потенциальные проблемы при миграции
- Можно отключить userId-проверку для отдельных эндпоинтов и убедиться, что Subject покрывает все случаи

---

## Фаза 3 — Удаление userId из контроллеров

**Commit:** `feat: switch to Subject-only access control, remove userId query params`

### Что меняется

1. **Удалить `[FromQuery] int? userId`** из всех action методов всех контроллеров (28+ мест)

2. **`GroupsBaseController.CheckGroupAccess` и `CheckCharacterAccess`** — удалить параметр `userId`:
   - `CheckGroupAccess(groupId)` — только `SubjectAccessHelper.HasGroupAccess(groupId)`
   - `CheckCharacterAccess(groupId, characterId)` — только `SubjectAccessHelper.HasCharacterAccess(groupId, characterId)`
   - Удалить `null`-bypass: `if (userId == null) return true`

3. **`GroupsBaseController`** — убрать `AccessHelper` (GroupAccessHelper) из protected, если он больше не используется ни одним наследником. `GroupAccessHelper` остаётся только внутри `SubjectAccessHelper` (через DI).

4. **Контроллеры с inline access checks** (CharactersController, CharacterItemsController и др. на GroupsBaseController) — заменить прямые вызовы `AccessHelper.HasGroupAccess(...userId...)` на `CheckGroupAccess(groupId)` (который внутри использует SubjectAccessHelper).

5. **Удалить `string? userId`** из `GroupNotesController.GetAll` (это была мёртвая строка, никогда не использовалась)

6. **`GroupsPolicesController`** — уже использует `SubjectAccessHelper`, userId query params удаляются. Заменить `_accessHelper.IsAdmin(data.GroupId.Value)` на наследуемый `CheckGroupAccess`.

7. **ExportImportController** — заменить `_accessHelper.IsAdmin(groupId, userId)` на `SubjectAccessHelper.IsAdmin(groupId)` (через base).

### Почему тесты не сломаются

- Фаза 2 доказала (через OR-логику и логирование расхождений), что SubjectAccessHelper корректно покрывает все случаи
- Все запросы к campaign-service проходят через api-gateway, который инжектит X-Subject header
- Middleware (`CampaignAccessMiddleware`) уже проверяет Subject до контроллера — это второй слой защиты
- **Риск:** если какой-то тест ходит без X-Subject — SubjectAccessHelper вернёт false, и запрос будет заблокирован. Но api-gateway уже инжектит X-Subject для всех запросов (inject_x_subject handler).

### Что работает после коммита

- Ни один контроллер не принимает `userId` query param
- Access control полностью через `SubjectAccessHelper`
- `GroupAccessHelper` живёт только внутри `SubjectAccessHelper` как делегат
- Null-bypass устранён — без Subject запросы получают 403

---

## Фаза 4 — PermissionLevel.None → middleware как единый gate

**Commit:** `feat: remove PermissionLevel.None, raise minimal level to Member`

### Что меняется

1. **`CampaignAccessMiddleware.GetRequiredPermission`**:
   - `GET /groups/{id}/quests` — `None` → `Member`
   - `GET /polices/groups` — `None` → `Member`
   - Default fallback для `/schemas/groups/{groupId}/` sub-resources — `None` → `Member`
   - Default fallback для не-matching путей — `None` → `Member`
   - Удалить ветку `if (requiredLevel == PermissionLevel.None)` из middleware pipeline (теперь middleware всегда проверяет)

2. **`PermissionLevel.None`** — удалить из enum, если используется только в middleware.

### Почему тесты не сломаются

- Middleware использует `SubjectAccessHelper`, который уже корректно работает (фазы 2-3)
- Поднятие `None` до `Member` означает, что запросы, которые раньше пропускались без проверки, теперь проверяются на членство в группе
- Все легитимные запросы от членов группы проходят проверку Member
- Не-члены группы получают 403 — это корректное поведение (раньше они получали доступ через null-bypass)
- Если какой-то тест ходит без членства в группе и ожидает успех — он сломается. **Проверить тесты перед этим коммитом.** Если тест создаёт пользователя и добавляет его в группу — он пройдёт.

### Что работает после коммита

- Middleware — единственный gate для group-scoped запросов
- PermissionLevel.None удалён
- Все group-scoped эндпоинты требуют минимум Member
- Контроллеры не дублируют access checks (хотя могут делать дополнительные character-level проверки)

---

## Фаза 5 — Provider cleanup

**Commit:** `feat: remove userId from providers, clean up provider signatures`

### Что меняется

1. **`GroupProvider.GetAll(userId)`** — удалить `userId`. GetAll больше не фильтрует по пользователю (middleware уже отсекла не-членов). Можно заменить на `GetAll()` без параметров или с groupId.

2. **`QuestsProvider.GetQuests(groupId, userId?, characterId?)`** — удалить `userId`. Character-based filtering остаётся (если нужно), но использует `characterId` из пути, а не `userId` для определения, какие квесты видны. Если нужно определить владельца персонажа — использует `SubjectAccessHelper` (передаётся в провайдер или проверяется в контроллере перед вызовом).

3. **`GroupPolicesProvider`** — удалить `userId` из сигнатур методов. Policy management не требует userId — только groupId.

4. **Провайдеры без userId** (ItemsProvider, SkillsProvider, NotesProvider и др.) — никаких изменений, они уже чисты.

5. **DualDbRepository** — deferred. Паттерн Outbox не реализуется, known risk документируется в коде комментарием.

### Почему тесты не сломаются

- Все провайдеры, принимающие userId, использовали его для фильтрации, которая теперь гарантирована middleware/контроллером
- `QuestsProvider` — единственный sensitive случай. Его character-based filtering переписывается без userId (через characterId из роута + SubjectAccessHelper), что не меняет внешнее поведение для легитимных запросов
- Тесты проверяют ответы, а не внутренние сигнатуры провайдеров

### Что работает после коммита

- Все провайдеры имеют чистые сигнатуры без `userId`
- Data-level filtering — только по groupId/characterId (проверены middleware)
- Character-based filtering для quests работает через Subject или characterId
- `GroupAccessHelper` остаётся только как внутренний делегат `SubjectAccessHelper`

---

## Итоговая архитектура после всех фаз

```
X-Subject header (от api-gateway)
  → SubjectPresentMiddleware
      → HttpContext.Items["Subject"]
  → CampaignAccessMiddleware (Member по умолчанию, Admin для writes)
      → SubjectAccessHelper (проверка членства)
      → 403 при несовпадении
  → Controller (GroupsBaseController)
      → SubjectAccessHelper для domain-specific проверок (character-level)
      → Provider (чистая бизнес-логика, без userId)
```

### Иерархия контроллеров

```
ControllerBase
  └── BaseController (не-group сущности, если появятся)
        └── GroupsBaseController (SubjectAccessHelper, TryGetGroup, TryGetCharacter)
              ├── GroupsController
              ├── CharactersController
              ├── CharacterItemsController
              ├── CharacterSkillsController
              ├── CharacterEquipmentController
              ├── TemplatesController
              ├── ExportImportController
              ├── GroupItemsController
              ├── GroupQuestsController
              ├── GroupSkillsController
              ├── GroupAttributesController
              ├── GroupNotesController
              ├── CharacterNotesController
              ├── GroupSchemasController
              ├── CharacterTemplateSchemaController
              ├── CharacterResourcesSchemaController
              └── GroupsPolicesController
```

---

## Риски по этапам

| Этап | Риск | Митигация |
|------|------|-----------|
| **Фаза 1** | `GroupNotesController` и `CharacterNotesController` не инжектят `CampaignContext` — добавить в конструктор может сломать DI, если контекст не зарегистрирован | Проверить `Program.cs` — `CampaignContext` уже зарегистрирован (используется GroupsBaseController) |
| **Фаза 2** | OR-логика маскирует проблемы SubjectAccessHelper — тесты проходят, но реальные дыры не видны | `LogWarning` на расхождениях — прогонять тесты и проверять логи |
| **Фаза 3** | Тест может ходить в обход api-gateway (напрямую в campaign-service) без X-Subject | Прогнать тесты через gateway (./test.sh). Если есть прямой доступ — SubjectPresentMiddleware должен иметь fallback |
| **Фаза 4** | Тест для quests или polices может не создавать членство в группе и ожидать успех (раньше было None → allow) | Проверить тесты перед коммитом. Добавить тестового пользователя в группу в сценарии, если нужно |
| **Фаза 5** | Quests character-filtering сломается при переписывании без userId | Сначала добавить SubjectAccessHelper в QuestsProvider, тестировать, потом удалить userId |

---

## Порядок выполнения

```bash
# Фаза 1
git commit -m "feat: migrate 9 controllers to GroupsBaseController hierarchy"
./test.sh 15  # ✅ 0 errors

# Фаза 2
git commit -m "feat: add SubjectAccessHelper parallel access checks in GroupsBaseController"
./test.sh 15  # ✅ 0 errors

# Фаза 3
git commit -m "feat: switch to Subject-only access control, remove userId query params"
./test.sh 15  # ✅ 0 errors

# Фаза 4
git commit -m "feat: remove PermissionLevel.None, raise minimal level to Member"
./test.sh 15  # ✅ 0 errors

# Фаза 5
git commit -m "feat: remove userId from providers, clean up provider signatures"
./test.sh 15  # ✅ 0 errors
```

Все 5 фаз самодостаточны. После каждого коммита сервис запускается, gateway-тесты проходят.
