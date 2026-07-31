# Auth Migration Plan: X-Subject Contract Migration

## 1. Мета-информация

| Поле | Значение |
|------|----------|
| **Статус** | Утверждён |

---

## 2. Мотивация

### 2.1. Проблема: неявный контракт null bypass

В `GroupsBaseController.cs:29`:

```csharp
if (userId == null) return true;
```

Это **сознательный backdoor** для internal trust (сервисные токены, админ-панель, кросс-сервисные вызовы). Не баг — доказано 320 тестами, убрать → ломает сервисные токены и админ-панель. Но:

- **Неявность**: различие между service token (admin bypass) и user token (DB check) определяется только по наличию полей в JWT, не по типу токена
- **Хрупкость**: любой запрос без `userId` получает полный доступ
- **Сцепленность**: gateway сам принимает решение о доступе, дублируя логику campaign-service
- **Double-call**: gateway сначала вызывает `/polices/groups?userId=N`, проверяет права, потом проксирует запрос — campaign-service при необходимости проверяет снова

### 2.2. Решение: явный контракт X-Subject

Заменить неявный null bypass на явный HTTP-заголовок `X-Subject`:

```
X-Subject: {"type":"user"|"group"|"admin", "id":"42"}
```

Где:
- **type** — кто стучится (субъект)
- **id** — идентификатор субъекта

### 2.3. Преимущества

- Явный контракт между gateway и сервисами
- Возможность убрать access.py (gateway → dumb proxy)
- Устранение double-call `/polices/groups`
- Единая точка принятия решений в campaign-service (middleware)
- Возможность добавлять ActionFilter-ы, HMAC-подпись, аудит

---

## 3. Текущая архитектура

### 3.1. Поток запроса (сейчас)

```
Client → Gateway (JWT) → access.py → [HTTP GET /polices/groups?userId=N] → campaign → GroupsBaseController (null bypass) → controller logic
```

### 3.2. Два режима в access.py

**User token** (есть `userId`):
```
access.py → HTTP GET /polices/groups?userId=N → получает права → принимает решение → проксирует запрос с ?userId= в query
```

**Service token** (есть `groupId`, нет `userId`):
```
access.py → gid != None → is_admin = True → проксирует запрос без ?userId=
```

Различие **неявное** — по наличию полей в JWT, не по типу токена.

### 3.3. Структура access.py

`backend/api-gateway/handlers/access.py` — 239 строк, 8 хендлеров:

| Хендлер | Строк | Логика |
|---------|-------|--------|
| `group_member` | ~20 | Проверка доступа к группе |
| `group_admin` | ~15 | Проверка админства в группе |
| `character_viewer` | ~20 | Проверка доступа к персонажу |
| `character_writer` | ~20 | Проверка права записи персонажа |
| `character_admin` | ~15 | Проверка админства персонажа |
| `self_only` | ~10 | Проверка `userId == path_param.user_id` |
| `quest_writer` | ~48 | 2 HTTP-вызова: квест + проверка прав |

### 3.4. null bypass в campaign-service

- **9 контроллеров** наследуют `GroupsBaseController` — получают `CheckGroupAccess(groupId, userId)` с `if (userId == null) return true`
- **11 контроллеров** наследуют `BaseController` напрямую — некоторые используют `_accessHelper.HasGroupAccess(groupId, userId.Value)` с собственным `if (userId != null && !...)`
- `GroupAccessHelper` (77 строк) — чисто DB-логика, без null-обработки
- `GroupPolicesProvider` (111 строк) — CRUD для правил доступа
- В `Program.cs` middleware нет (только `UseHttpMetrics`)

### 3.5. Кто вызывает без userId (админ-панель)

Админ-панель (`admin/app/services.py`) вызывает campaign-service напрямую:
- `GET /groups` — без userId → null bypass → полный доступ
- `GET /groups/{id}` — без userId → null bypass
- `DELETE /groups/{id}` — без userId → null bypass
- `PUT /polices/groups` — без userId → null bypass
- `POST /groups` — без userId, но этот endpoint не проверяет доступ

А также: `POST /generate-service-token` на auth-service — возвращает JWT с `groupId`.

---

## 4. Целевая архитектура

### 4.1. Поток запроса (цель)

```
Client → Gateway (JWT) → JWT verification → формирование X-Subject → campaign(X-Subject header) → SubjectPresentMiddleware → SubjectAccessHelper → controller logic
```

### 4.2. Роли

| Компонент | Роль в цели |
|-----------|-------------|
| **Gateway** | Парсит JWT, формирует `X-Subject`, пробрасывает. Перестаёт делать `/polices/groups`. Становится dumb proxy. |
| **SubjectPresentMiddleware** | Парсит `X-Subject`, кладёт `Subject` в `HttpContext.Items["Subject"]`. Если заголовка нет — ничего не делает. |
| **SubjectAccessHelper** | Обёртка над `GroupAccessHelper`. Ветвление по `SubjectType`. Единая точка принятия решения. |
| **Контроллеры** | Постепенно переходят на `Subject` из `HttpContext.Items`. |

### 4.3. Схема данных

```
JWT payload (user token):
  { "userId": 42, ... }
→ X-Subject: {"type":"user","id":"42"}

JWT payload (service token):
  { "groupId": 101, ... }
→ X-Subject: {"type":"group","id":"101"}

Admin panel (direct call, no JWT):
  Без X-Subject → fallback к текущему поведению (null bypass)
  (пока не добавим Subject(Admin,0))
```

---

## 5. Контракт X-Subject

### 5.1. Формат

HTTP-заголовок:
```
X-Subject: {"type":"user","id":"42"}
```

JSON-объект, всегда валидный JSON, минимальный размер.

### 5.2. SubjectType enum

```csharp
public enum SubjectType
{
    User,   // обычный пользователь
    Group,  // сервисный токен (admin bypass)
    Admin   // системный администратор (полный доступ)
}
```

### 5.3. Subject record

```csharp
public record Subject(SubjectType Type, int Id);
```

### 5.4. Семантика каждого SubjectType

| SubjectType | Subject.Id | Что означает | Поведение SubjectAccessHelper |
|-------------|------------|--------------|-------------------------------|
| `user` | userId | Обычный пользователь | Делегат в `GroupAccessHelper` — существующая DB-логика |
| `group` | groupId | Сервисный токен | Admin bypass: всегда разрешено для этой группы (как сейчас service token) |
| `admin` | любой | Системный администратор | Всегда разрешено (полный доступ) |

### 5.5. Отсутствие заголовка X-Subject

**При отсутствии X-Subject запрос пропускается (поведение не меняется).** SubjectPresentMiddleware не сеттит `Subject`, SubjectAccessHelper возвращает `false` если вызван без Subject, контроллеры с null bypass продолжают работать как сейчас.

Это гарантирует, что Фаза 1 ничего не ломает.

### 5.6. Ограничения

- X-Subject передаётся только между gateway и сервисами (internal network, Docker Compose)
- Клиенты никогда не видят X-Subject
- X-Subject НЕ подписан (HMAC — отложено на Фазу 3)
- **Subject(Admin,0) fallback не реализовывать без аудита** — сейчас access.py возвращает 403 при отсутствии uid и gid, fallback изменил бы поведение

---

## 6. Пофазовая имплементация

### Фаза 1 — Middleware (campaign-service)

**Что делаем:** Создаём SubjectPresentMiddleware и SubjectAccessHelper в campaign-service. Gateway не трогаем.

#### 6.1.1. Subject.cs

**Новый файл:** `backend/campaign-service/Source/Models/Access/Subject.cs`

```csharp
namespace Tdn.Models.Access;

public enum SubjectType { User, Group, Admin }

public record Subject(SubjectType Type, int Id);
```

#### 6.1.2. SubjectPresentMiddleware

**Новый файл:** `backend/campaign-service/Source/Middleware/SubjectPresentMiddleware.cs`

- Парсит `X-Subject` из заголовка (JSON → Subject)
- Кладёт `Subject` в `HttpContext.Items["Subject"]`
- Если заголовка нет, пустой, или невалидный JSON — **ничего не делает** (не логирует ошибку, не возвращает 400)
- Логгирование info-level: `"X-Subject present: {type}:{id}"` / `"X-Subject not present"`

**Регистрация в Program.cs:**
```csharp
app.UseHttpMetrics();
app.UseMiddleware<SubjectPresentMiddleware>();
app.MapMetrics();
app.MapControllers();
app.Run();
```

Middleware должна быть зарегистрирована после `UseHttpMetrics`, но до `MapControllers`.

#### 6.1.3. SubjectAccessHelper

**Новый файл:** `backend/campaign-service/Source/Models/Access/SubjectAccessHelper.cs`

- Регистрируется в DI как scoped (как GroupAccessHelper)
- Зависит от `GroupAccessHelper` (делегат)
- Конструктор принимает `IHttpContextAccessor` (чтобы достать Subject из Items)
- Методы:

```csharp
public class SubjectAccessHelper
{
    private readonly GroupAccessHelper _groupAccessHelper;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<SubjectAccessHelper> _logger;

    public SubjectAccessHelper(
        GroupAccessHelper groupAccessHelper,
        IHttpContextAccessor httpContextAccessor,
        ILogger<SubjectAccessHelper> logger)
    { ... }

    private Subject? GetSubject() =>
        _httpContextAccessor.HttpContext?.Items["Subject"] as Subject;

    public bool HasGroupAccess(int groupId)
    {
        var subject = GetSubject();
        if (subject == null) return false; // без Subject — нет решения
        return subject.Type switch
        {
            SubjectType.Admin => true,
            SubjectType.Group => subject.Id == groupId,
            SubjectType.User => _groupAccessHelper.HasGroupAccess(groupId, subject.Id),
            _ => false
        };
    }

    public bool IsAdmin(int groupId)
    {
        var subject = GetSubject();
        if (subject == null) return false;
        return subject.Type switch
        {
            SubjectType.Admin => true,
            SubjectType.Group => subject.Id == groupId,
            SubjectType.User => _groupAccessHelper.IsAdmin(groupId, subject.Id),
            _ => false
        };
    }

    public bool HasCharacterAccess(int groupId, int characterId)
    {
        var subject = GetSubject();
        if (subject == null) return false;
        return subject.Type switch
        {
            SubjectType.Admin => true,
            SubjectType.Group => true, // service token = admin bypass
            SubjectType.User => _groupAccessHelper.HasCharacterAccess(groupId, characterId, subject.Id),
            _ => false
        };
    }

    public bool CanWriteCharacter(int groupId, int characterId)
    {
        var subject = GetSubject();
        if (subject == null) return false;
        return subject.Type switch
        {
            SubjectType.Admin => true,
            SubjectType.Group => true,
            SubjectType.User => _groupAccessHelper.CanWriteCharacter(groupId, characterId, subject.Id),
            _ => false
        };
    }

    public List<int> GetAccessibleGroupIds()
    {
        var subject = GetSubject();
        if (subject == null) return new List<int>();
        if (subject.Type == SubjectType.Admin) return new List<int>(); // admin имеет доступ ко всем — особый случай
        if (subject.Type == SubjectType.Group) return new List<int> { subject.Id };
        return _groupAccessHelper.GetAccessibleGroupIds(subject.Id);
    }
}
```

Логгирование info-level всех решений: `"SubjectAccessHelper: HasGroupAccess({groupId}) → {result} [{subject}]"`.

**Регистрация в DI (Program.cs):**
```csharp
builder.Services.AddScoped<SubjectAccessHelper>();
```

#### 6.1.4. Критерии завершения Фазы 1

- [ ] Subject.cs создан
- [ ] SubjectPresentMiddleware создан и зарегистрирован
- [ ] SubjectAccessHelper создан и зарегистрирован в DI
- [ ] Логгирование info-level работает
- [ ] Все существующие тесты (320 gateway + 11 C# unit) проходят
- [ ] При отсутствии X-Subject поведение не меняется
- [ ] При наличии X-Subject решения логгируются

#### 6.1.5. Риски Фазы 1

- **Первая middleware в проекте** — нет прецедентов, может быть неожиданное поведение с порядком middleware
- SubjectAccessHelper не используется контроллерами — только создан и не вызывает ошибок
- `IHttpContextAccessor` уже зарегистрирован (`builder.Services.AddHttpContextAccessor()`)

---

### Фаза 1.5 — Аудит 403 путей

**Что делаем:** Анализируем, кто реально вызывает campaign-service без userId и получает доступ через null bypass. Это **исследовательская фаза** — никаких изменений кода.

#### 6.2.1. Действия

1. Временно добавить логгирование в `GroupsBaseController.CheckGroupAccess` и `CheckCharacterAccess` при `userId == null`
2. Собрать данные за 1-3 дня по всем случаям null bypass
3. Определить источники: админ-панель, сервисные токены, тесты, что-то ещё
4. Задокументировать все пути null bypass

#### 6.2.2. Решение по Subject(Admin,0) fallback

На основе данных аудита:
- Если 100% вызовов без Subject — это админ-панель → можно добавить `Subject(Admin,0)` fallback
- Если есть неизвестные источники → **не добавлять fallback**, документировать как риск
- **Subject(Admin,0) fallback не реализовывать без аудита** — сейчас access.py возвращает 403 при отсутствии uid и gid, fallback изменил бы поведение

#### 6.2.3. Предварительный анализ

- **Админ-панель**: `GET /groups`, `GET /groups/{id}`, `DELETE /groups/{id}`, `PUT /polices/groups` — все без userId, через null bypass
- **Сервисные токены**: не передают userId, gateway не подставляет → null bypass (admin bypass)
- **Тесты**: некоторые тесты gateway могут ходить без авторизации

#### 6.2.4. Критерии завершения Фазы 1.5

- [ ] Данные аудита собраны
- [ ] Все источники null bypass идентифицированы
- [ ] Принято решение по Subject(Admin,0) fallback
- [ ] Временное логгирование null bypass убрано

---

### Фаза 2 — Gateway пробрасывает X-Subject

**Что делаем:** Gateway парсит JWT, формирует X-Subject, пробрасывает в campaign-service. Параллельный режим: access.py продолжает работать, campaign логирует, совпадает ли решение.

#### 6.3.1. Изменения в gateway

**Новый файл:** `backend/api-gateway/handlers/inject_x_subject.py`

```python
@register_pre_proxy_handler("inject_x_subject")
def inject_x_subject(ctx: RouteContext):
    jwt = ctx.jwt
    if jwt is None:
        return  # no JWT → nothing to inject (behavior unchanged)
    
    uid = jwt.get("userId") or jwt.get("sub")
    gid = jwt.get("groupId")
    
    if uid is not None:
        subject = json.dumps({"type": "user", "id": int(uid)})
    elif gid is not None:
        subject = json.dumps({"type": "group", "id": int(gid)})
    else:
        return  # no identifiable subject → nothing (behavior unchanged)
    
    ctx.services.campaign.set_header("X-Subject", subject)
```

#### 6.3.2. Параллельный режим (verify mode)

- Gateway пробрасывает X-Subject **и** продолжает выполнять access.py
- Campaign логгирует, совпадает ли решение SubjectAccessHelper со статус-кво
- Расхождение = alarm
- Для упрощения: gateway логирует своё решение перед проксированием, campaign-service логирует решение SubjectAccessHelper. Сравнение — пост-фактум по логам.

#### 6.3.3. Изменяемые/создаваемые файлы

- `backend/api-gateway/handlers/inject_x_subject.py` — новый
- `backend/api-gateway/configs/routes.yaml` — добавить `inject_x_subject` в pipeline (после auth, перед proxy)
- `backend/campaign-service/Source/Models/Access/SubjectAccessHelper.cs` — доработка verify mode

#### 6.3.4. Критерии завершения Фазы 2

- [ ] X-Subject пробрасывается для всех проксируемых запросов к campaign-service
- [ ] access.py продолжает работать (ничего не удалено)
- [ ] Parallel verify mode включён
- [ ] Gateway тесты проходят (все 17 integration-тестов)
- [ ] C# тесты проходят (11 unit-тестов)
- [ ] Логи показывают 0 расхождений между gateway и campaign

#### 6.3.5. Риски Фазы 2

- Gateway может случайно не пробросить X-Subject для некоторых путей → verify mode покажет расхождение
- Gateway engine может не поддерживать `set_header` для сервисных прокси → может потребоваться доработка engine
- Некоторые пути в routes.yaml могут иметь нетривиальную маршрутизацию (custom handlers)

---

### Фаза 2.5 — Мониторинг (1-2 недели)

**Что делаем:** Наблюдаем за логами, отслеживаем расхождения.

#### 6.4.1. Условия успеха

- **0 расхождений** между решением gateway (access.py) и решением campaign-service (SubjectAccessHelper) за период мониторинга
- Все запросы от gateway содержат X-Subject
- Нет ошибок, связанных с X-Subject

#### 6.4.2. Что делаем при успехе

1. **Удаляем access.py**: gateway перестаёт делать HTTP-вызов `/polices/groups?userId=N`
2. **Gateway перестаёт подставлять `?userId=`** в query-параметры при проксировании
3. **Gateway становится dumb proxy**: единственная логика — JWT verification → X-Subject → прокси
4. **Double-call `/polices/groups` исчезает**

#### 6.4.3. Изменяемые файлы

- `backend/api-gateway/handlers/access.py` — удалить все хендлеры (оставить пустой файл или удалить)
- `backend/api-gateway/configs/routes.yaml` — убрать `access` из pipeline всех путей (или заменить на `inject_x_subject`)

#### 6.4.4. Критерии завершения Фазы 2.5

- [ ] 0 расхождений за период мониторинга
- [ ] access.py удалён
- [ ] Double-call `/polices/groups` устранён
- [ ] Все gateway тесты проходят (есть риск, что некоторые тесты проверяют access.py)

---

### Фаза 3 — Отложено

**Что делаем:** Улучшения, которые не блокируют основную миграцию.

#### 6.5.1. HMAC-подпись X-Subject (P0 тикет)

- Добавить HMAC-ключ, общий для gateway и campaign-service
- Gateway подписывает X-Subject: `X-Subject-Signature: HMAC-SHA256(...)`
- Middleware проверяет подпись
- **Зачем:** защита от подделки X-Subject при компрометации internal network

#### 6.5.2. ActionFilter-ы

- `[RequireGroupAccess]` — проверяет SubjectAccessHelper.HasGroupAccess
- `[RequireCharacterWrite]` — проверяет SubjectAccessHelper.CanWriteCharacter
- `[RequireAdmin]` — проверяет IsAdmin
- Позволяют убрать разрозненные `if (userId != null && !...)` из контроллеров

#### 6.5.3. Аудит 11 BaseController

- 11 контроллеров наследуют `BaseController` напрямую
- Некоторые из них (Notes, Characters) не проверяют доступ вообще
- Определить, какие из них должны быть защищены
- Добавить SubjectAccessHelper-зависимость и проверки

#### 6.5.4. null bypass removal

- Убрать `if (userId == null) return true;` из `GroupsBaseController.cs:29`
- **Только когда 100% вызывающих перейдут на X-Subject**
- Требует завершения аудита (Фаза 1.5) и проверки, что админ-панель и все сервисы используют X-Subject

---

## 7. Тестовая стратегия

### 7.1. Фаза 1 — Middleware

**C# unit-тесты (campaign-service):**

| Тест | Описание |
|------|----------|
| `Subject_UserType_HasGroupAccess_DelegatesToHelper` | Subject(User,42) → HasGroupAccess(1) → вызывает GroupAccessHelper.HasGroupAccess(1,42) |
| `Subject_GroupType_HasGroupAccess_ReturnsTrueIfSameGroup` | Subject(Group,1) → HasGroupAccess(1) → true |
| `Subject_GroupType_HasGroupAccess_ReturnsFalseIfDifferentGroup` | Subject(Group,1) → HasGroupAccess(2) → false |
| `Subject_AdminType_HasGroupAccess_AlwaysTrue` | Subject(Admin,0) → HasGroupAccess(any) → true |
| `NoSubject_HasGroupAccess_ReturnsFalse` | Без X-Subject → HasGroupAccess(1) → false |
| `Subject_UserType_IsAdmin_DelegatesToHelper` | Subject(User,42) → IsAdmin(1) → вызывает GroupAccessHelper.IsAdmin(1,42) |
| `Subject_GroupType_IsAdmin_ReturnsTrueIfSameGroup` | Subject(Group,1) → IsAdmin(1) → true |
| `Subject_UserType_HasCharacterAccess_DelegatesToHelper` | Subject(User,42) → HasCharacterAccess(1,100) → вызывает helper |
| `Subject_UserType_CanWriteCharacter_DelegatesToHelper` | Subject(User,42) → CanWriteCharacter(1,100) → вызывает helper |
| `Subject_GroupType_CharacterAccess_AlwaysTrue` | Subject(Group,1) → HasCharacterAccess(1,100) → true (admin bypass) |

**Mock-стратегия:**
- Mock `GroupAccessHelper` (у него уже есть unit-тесты)
- Mock `IHttpContextAccessor` для подмены `HttpContext.Items["Subject"]`
- Для тестов без Subject — `IHttpContextAccessor` возвращает `null`

### 7.2. Фаза 2 — Gateway

**Integration-тесты (gateway, Python):**

| Тест | Описание |
|------|----------|
| `UserToken_ProducesXSubjectUser` | JWT с userId → gateway добавляет `X-Subject: {"type":"user","id":42}` |
| `ServiceToken_ProducesXSubjectGroup` | JWT с groupId → gateway добавляет `X-Subject: {"type":"group","id":101}` |
| `NoToken_NoXSubject` | Без JWT → X-Subject не добавляется |

### 7.3. Фаза 2.5 — Валидация

- Gateway тесты (17 штук) продолжают работать
- C# тесты (11 штук) продолжают работать
- После удаления access.py: убедиться, что все gateway тесты переписаны для работы без access.py (или удалены)

### 7.4. Тесты, которые НЕ меняем

320 тестов gateway проходят без изменений — **критично**. Фаза 1 и 2 не должны их ломать.

---

## 8. Риски и слепые зоны

### 8.1. Утверждённые советом

| Риск | Описание | Митигация |
|------|----------|-----------|
| **Нет тестов на null bypass** | Контроллеры GroupsBaseController не покрыты unit-тестами. Нет тестов, проверяющих, что `userId == null → true` | Фаза 1.5 (аудит). Не удалять null bypass без проверки. |
| **Subject(Admin,0) fallback меняет поведение** | Сейчас access.py возвращает 403 при отсутствии uid и gid. Fallback сделал бы все запросы без X-Subject admin-доступом. | **Не реализовывать без аудита.** Фаза 1.5 сначала собирает данные. |
| **Первая middleware в проекте** | Раньше middleware не использовались. Порядок регистрации может влиять. | Зарегистрировать после UseHttpMetrics, до MapControllers. Тестировать. |
| **Админ-панель не использует X-Subject** | Админ-панель ходит напрямую к campaign-service без JWT и без X-Subject. | null bypass остаётся для админ-панели до Фазы 3. |
| **Gateway может не пробросить X-Subject для всех путей** | routes.yaml сложный (608 строк), custom handlers могут обходить inject_x_subject | Verify mode (Фаза 2) выявит расхождения. |
| **Параллельный режим увеличивает latency** | access.py + SubjectAccessHelper = двойная проверка. | Временный оверхед (1-2 недели). После удаления access.py latency снизится. |
| **Нет controller/integration тестов в campaign-service** | 11 unit-тестов только на провайдеры. Контроллеры не тестируются. | Фаза 3: добавить controller-тесты вместе с ActionFilter-ами. |

### 8.2. Дополнительные риски

| Риск | Описание |
|------|----------|
| **quest_writer** | Самый сложный хендлер (48 строк, 2 HTTP-вызова). Его логика специфична: проверка assignedCharacters, PATCH-ограничения. При удалении access.py эту логику надо перенести в campaign-service или оставить quest_writer как exception. |
| **Порядок middleware в .NET** | `UseMiddleware<SubjectPresentMiddleware>()` vs `app.UseWhen(...)`. Нужно убедиться, что middleware выполняется для всех путей, включая polices. |
| **Service token test** | Существующий test scenario `service_token_access.py` проверяет поведение service token через gateway. При удалении access.py нужно убедиться, что тест всё ещё проходит (заменён на X-Subject проверку). |
| **NullReferenceException** | `HttpContext.Items["Subject"] as Subject` — если Subject не установлен, вернёт null. SubjectAccessHelper должен корректно обрабатывать null. |

---

## 9. Rollback план

### Фаза 1 — Middleware

| Действие | Команда/шаг |
|----------|-------------|
| **Откат** | Убрать `app.UseMiddleware<SubjectPresentMiddleware>()` из Program.cs. Убрать `builder.Services.AddScoped<SubjectAccessHelper>()`. Удалить файлы Subject.cs, SubjectPresentMiddleware.cs, SubjectAccessHelper.cs. |
| **Время** | < 5 минут (пересобрать Docker образ) |
| **Проверка** | Все тесты проходят |
| **Риск** | Минимальный — middleware ничего не меняет без X-Subject |

### Фаза 2 — Gateway пробрасывает X-Subject

| Действие | Команда/шаг |
|----------|-------------|
| **Откат** | Убрать `inject_x_subject` из pipeline routes.yaml. Удалить inject_x_subject.py. |
| **Время** | < 5 минут (перезапустить gateway, не требует пересборки Docker) |
| **Проверка** | Gateway тесты проходят |
| **Риск** | Низкий — добавление заголовка не влияет на логику |

### Фаза 2.5 — Удаление access.py

| Действие | Команда/шаг |
|----------|-------------|
| **Откат** | Вернуть access.py из git (git checkout). Вернуть `access` в pipeline routes.yaml. |
| **Время** | < 5 минут |
| **Проверка** | Все gateway тесты проходят |
| **Риск** | **Средний** — удаление access.py меняет поведение. Если возникли проблемы, откат немедленный. |

### Фаза 3 — null bypass removal

| Действие | Команда/шаг |
|----------|-------------|
| **Откат** | Вернуть `if (userId == null) return true;` в GroupsBaseController |
| **Время** | < 2 минут |
| **Риск** | **Высокий** — изменение затрагивает все контроллеры. Должен быть тщательно протестирован до деплоя. |

---

## 10. График

| Фаза | Оценка | Реалистично |
|------|--------|-------------|
| Фаза 1 — Middleware | 1 день | 2 дня (разработка + тесты + code review) |
| Фаза 1.5 — Аудит | 1-3 дня сбора данных | Зависит от нагрузки на production |
| Фаза 2 — Gateway X-Subject | 1 день | 2 дня (разработка + тесты + parallel verify) |
| Фаза 2.5 — Мониторинг | 1-2 недели | 1-2 недели реального времени |
| Фаза 3 — Отложено | N/A | Не планируется сейчас |

**Общее время до Фазы 2.5 включительно:** ~3-5 дней разработки + 1-2 недели мониторинга.

---

## 11. Что НЕ делаем (из вердикта совета)

- ❌ Subject(Admin,0) fallback без аудита
- ❌ Atomic migration (все фазы сразу)
- ❌ Убирать null bypass сейчас
- ❌ Планировать 4-часовые спринты
- ❌ Менять access.py до подтверждения 0 divergence
- ❌ Добавлять HMAC в Фазе 1-2 (отложено на Фазу 3)

---

## 12. Приложение: Полный список файлов

### Новые файлы

| Файл | Фаза | Описание |
|------|------|----------|
| `backend/campaign-service/Source/Models/Access/Subject.cs` | 1 | Subject record + SubjectType enum |
| `backend/campaign-service/Source/Middleware/SubjectPresentMiddleware.cs` | 1 | Парсинг X-Subject из заголовка |
| `backend/campaign-service/Source/Models/Access/SubjectAccessHelper.cs` | 1 | Обёртка над GroupAccessHelper |
| `backend/api-gateway/handlers/inject_x_subject.py` | 2 | Pre-proxy handler для X-Subject |

### Изменяемые файлы

| Файл | Фаза | Изменение |
|------|------|-----------|
| `backend/campaign-service/Program.cs` | 1 | Регистрация Middleware + SubjectAccessHelper |
| `backend/api-gateway/configs/routes.yaml` | 2 | Добавление inject_x_subject в pipeline |

### Файлы для удаления (Фаза 2.5)

| Файл | Описание |
|------|----------|
| `backend/api-gateway/handlers/access.py` | Весь файл (239 строк) |
| `backend/api-gateway/configs/routes.yaml` | Убрать `access` из pipeline всех путей |
