# Campaign-Service Refactoring — State

## Миссия

Привести campaign-service к единой access control модели:
- Единственный источник identity — X-Subject header, никаких `userId` query param
- Middleware — единый gate (Member по умолчанию), контроллер — domain-specific проверки, провайдер — чистая бизнес-логика
- Не-участник группы — 404 вместо 403

## Ключевые архитектурные решения

- **Identity должен быть server-verified** (X-Subject от gateway), а не client-supplied (`?userId=`)
- **Middleware + контроллер — два уровня**: middleware режет membership, контроллер режет domain
- **404 для не-участников** — не раскрываем существование группы атакующему

## План

`plans/campaign-service-refactoring-target.md`
`plans/campaign-service-migration-phases.md`

## Что сделано (6 коммитов)

| Коммит | Описание |
|--------|----------|
| `2ee1f2b` | feat: migrate 9 controllers to GroupsBaseController hierarchy |
| `ba98ffb` | feat: add SubjectAccessHelper parallel access checks in GroupsBaseController |
| `ecca840` | feat: switch to Subject-only access control, remove userId query params |
| `6ff60e6` | feat: remove PermissionLevel.None, raise minimal level to Member in middleware |
| `81e7463` | feat: remove userId from providers, clean up provider signatures |
| `dca4d1c` | fix: return 404 instead of 403 for non-member group access |
| `75de855` | fix: update test expectations for 404 on non-member group access |

## Что остаётся

- **Race condition DualDbRepository** (Mongo→SQL) — осознанно отложено, documented risk
- **Quests character-based filtering** — работает через провайдер, архитектурно не идеально, но стабильно
- **Модель владения** (кто owner entity: создатель? group admin? superuser?) — не решена, хотели потом обсудить
