# Campaign-Service Defects P0-P3 — План закрытия

## Статус
- Основание: Extended Council v2 (2026-07-31)
- Активная миграция access control: 5 фаз (campaign-service-migration-phases.md) — **выполнена**
- X-Subject контракт (auth-migration.md) — Phase 1-2 выполнены
- Все 5 фаз закоммичены (git log verified)

---

## Секция 1: Целевое состояние

### Проблемы

| ID | Приоритет | Описание | Статус |
|----|-----------|----------|--------|
| P0 | CRITICAL | DualDbRepository race — 8 fault paths (Mongo orphan при падении SQL; SQL orphan при падении Mongo) | Открыт |
| P1 | LOW | TryUpdateOwnerId никогда не вызывается, OwnerId=null в ответах | Открыт, вероятно dead code |
| P2 | LOW | 7 мест с `SubjectAccess.CurrentUserId ?? 0` — админ/сервис логируются как userId=0 | Открыт |
| P3 | HIGH | CharactersProvider.PatchCharacter (179 строк) — ноль unit-тестов | Открыт |

### Целевая архитектура (после фикса)

1. **P0:** DualDbRepository устойчив к асимметричным сбоям: при падении SQL после Mongo — Mongo orphan удаляется (компенсация). При падении Mongo после SQL — SQL orphan логируется. QuestsProvider применяет тот же паттерн.
2. **P1:** TryUpdateOwnerId удалён как dead code. OwnerId остаётся в модели (API-контракт), но PostCharacter/PatchCharacter его не трогают до появления реального потребителя.
3. **P2:** Логи содержат осмысленный идентификатор субъекта: `user:42`, `admin:0`, `group:5`, `anonymous`.
4. **P3:** CharactersProvider.PatchCharacter покрыт 3 unit-тестами (success, not-found, validation error).

### Hard constraints
- Не менять API-контракты (response модели, статус-коды)
- Не менять схему БД
- Gateway тесты (./test.sh 15) — 0 ошибок после каждого коммита
- TransactionScope невозможен (MongoDB не участвует в System.Transactions)

### Риски
- P0: компенсационное удаление может само упасть → логируем и алертим
- P3: 3 теста — минимальный baseline, не полное покрытие
- P2: 7 мест исправления, SubjectAccessHelper уже протестирован (399 строк тестов)

---

## Секция 2: Фазы

### Фаза 1 — P0: DualDbRepository race fix

**Commit:** `feat: add bidirectional compensational delete for DualDbRepository race condition`

**Что меняется:**

1. **DualDbRepository.cs, TryCreate (строка 82):**
   - Текущий порядок: Mongo InsertOne → SQL Add + SaveChanges
   - Меняем на: генерация GUID на клиенте (`Guid.NewGuid().ToString()`) → SQL Add + SaveChanges → Mongo InsertOne
   - Если Mongo падает после SQL — компенсация: удалить SQL-строку (или залогировать orphan)
   
   Фактически, из-за того что Mongo ObjectId используется как UUID в SQL, проще оставить порядок Mongo→SQL, но добавить компенсационное удаление Mongo-документа при падении SQL. Это меньшее изменение с меньшим риском.

   ```csharp
   // TryCreate — новый вариант
   try {
       var mongoData = ToMongoData(entity);
       Mongo.GetCollection<TMongoData>(CollectionName).InsertOne(mongoData);
       var sqlData = CreateSqlData(groupId, mongoData.Id.ToString(), entity);
       Db.Set<TSqlData>().Add(sqlData);
       Db.SaveChanges();
       SetEntityId(entity, sqlData.Id);
       return true;
   } catch (Exception e) {
       // Компенсация: удаляем Mongo-orphan, если SQL упал
       try {
           Mongo.GetCollection<TMongoData>(CollectionName)
               .DeleteOne(Builders<TMongoData>.Filter.Eq(x => x.Id, mongoData.Id));
       } catch (Exception cleanupEx) {
           Logger.LogWarning($"Failed to clean up Mongo orphan for {typeof(TEntity).Name}: {cleanupEx}");
       }
       Logger.LogWarning($"Error creating {typeof(TEntity).Name}: {e}");
       return false;
   }
   ```

2. **DualDbRepository.cs, TryDelete (строка 127):**
   - Текущий порядок: Mongo DeleteOne → SQL Remove + SaveChanges
   - Меняем на: SQL Remove + SaveChanges → Mongo DeleteOne
   - Если Mongo падает после SQL — SQL данные уже удалены (best-effort, хотя бы нет SQL orphan)

   ```csharp
   // TryDelete — новый вариант
   try {
       var sqlData = Db.Set<TSqlData>().FirstOrDefault(IdFilter(groupId, entityId));
       if (sqlData == null) return false;
       var uuid = sqlData.UUID;
       Db.Set<TSqlData>().Remove(sqlData);
       Db.SaveChanges();
       Mongo.GetCollection<TMongoData>(CollectionName)
           .DeleteOne(Builders<TMongoData>.Filter.Eq(x => x.Id, new ObjectId(uuid)));
       return true;
   } catch (Exception e) {
       Logger.LogWarning($"Error deleting {typeof(TEntity).Name}: {e}");
       return false;
   }
   ```

3. **QuestsProvider.cs, TryCreateQuest (строка 107):**
   - Текущий порядок: Mongo InsertOne → SQL Add → SaveChanges → SQL assignments → SaveChanges
   - Меняем на: сохраняем порядок, добавляем компенсационное удаление Mongo-документа при падении SQL

4. **QuestsProvider.cs, TryDeleteQuest (строка 215):**
   - Текущий порядок: SQL Remove → SaveChanges → Mongo DeleteOne — уже правильный relative порядок
   - Добавляем проверку: если Mongo падает — логируем, SQL уже удалён (приемлемо)

**Почему тесты не сломаются:**
- Никаких изменений API
- Никаких изменений response моделей
- Компенсация только при ошибке — happy path не меняется
- DualDbRepository уже имеет try-catch, мы просто расширяем catch

---

### Фаза 2 — P3: PatchCharacter tests

**Commit:** `feat: add unit tests for CharactersProvider.PatchCharacter`

**Что меняется:**

Новый файл тестов: `Tests/Source/CharactersProviderTests.cs`

Три сценария:
1. **PatchCharacter_NonExistentCharacter_Returns404** — запрос для несуществующего персонажа → Success=false, StatusCode=404
2. **PatchCharacter_UpdateNameAndDescription** — happy path: патч Name и Description → Success=true, поле обновлено
3. **PatchCharacter_InvalidPatch_Returns400** — пустой/невалидный патч → Success=false, StatusCode=400

**Мок-стратегия:**
- Мокаем `CampaignContext` (через `CampaignContextFactory`)
- Мокаем `IMongoDbContext` для Mongo операций
- Мокаем `ILogger<CharactersProvider>`

**Почему тесты не сломаются:**
- Новые тесты, не меняют существующий код
- CharactersProvider — public class, все методы virtual или уже тестируемы
- Используем те же фикстуры, что и существующие тесты

---

### Фаза 3 — P2: Logging userId=0 fix

**Commit:** `feat: fix audit logging for non-user subjects in character controllers`

**Что меняется:**

1. **SubjectAccessHelper.cs** — добавить метод `CurrentUserLogLabel()`:
   ```csharp
   public string CurrentUserLogLabel()
   {
       var subject = GetSubject();
       return subject switch
       {
           { Type: SubjectType.User } => $"user:{subject.Id}",
           { Type: SubjectType.Admin } => "admin",
           { Type: SubjectType.Group } => $"group:{subject.Id}",
           null => "anonymous"
       };
   }
   ```

2. В 4 контроллерах (7 мест) заменить `SubjectAccess.CurrentUserId ?? 0` на `SubjectAccess.CurrentUserLogLabel()`:
   - `CharacterSkillsController.cs:52, 70`
   - `CharacterItemsController.cs:59, 104, 125`
   - `CharactersController.cs:133`
   - `CharacterEquipmentController.cs:55`

   LogProvider требует `int userId` — нужно проверить сигнатуру. Если LogProvider.LogFieldChange/LogItemChange/LogSkillChange/LogEquipmentChange принимают `int userId`, то меняем тип параметра на `string` или добавляем overload.

**Почему тесты не сломаются:**
- SubjectAccessHelper уже протестирован (399 строк тестов)
- Логирование — add-only, не влияет на бизнес-логику
- Gateway тесты не проверяют содержимое логов

---

### Фаза 4 — P1: Remove dead code TryUpdateOwnerId

**Commit:** `feat: remove unused TryUpdateOwnerId method`

**Что меняется:**

1. **CharactersProvider.cs** — удалить метод `TryUpdateOwnerId` (строки 65-72)
2. Проверить, что никто не вызывает этот метод (grep confirmation — уже verified)

**Почему тесты не сломаются:**
- Метод никем не вызывается (grep verified)
- Удаление dead code не влияет на поведение

---

### Порядок выполнения

```bash
# Фаза 1 — P0
cd backend/campaign-service && dotnet build && dotnet test
cd ../api-gateway/tests && ./test.sh 15
git commit -m "feat: add bidirectional compensational delete for DualDbRepository race condition"

# Фаза 2 — P3
cd ../../campaign-service && dotnet build && dotnet test
cd ../api-gateway/tests && ./test.sh 15
git commit -m "feat: add unit tests for CharactersProvider.PatchCharacter"

# Фаза 3 — P2
cd ../../campaign-service && dotnet build && dotnet test
cd ../api-gateway/tests && ./test.sh 15
git commit -m "feat: fix audit logging for non-user subjects in character controllers"

# Фаза 4 — P1
cd ../../campaign-service && dotnet build && dotnet test
cd ../api-gateway/tests && ./test.sh 15
git commit -m "feat: remove unused TryUpdateOwnerId method"

# Финальный прогон
cd ../../campaign-service && dotnet build && dotnet test
cd ../api-gateway/tests && ./test.sh 15
```
