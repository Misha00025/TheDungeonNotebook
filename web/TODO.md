# TODO

## Баги
- [ ] `CreateGroupItemRequest` / `UpdateGroupItemRequest` не содержат `isSecret` и `attributes` — при создании/редактировании айтемов группы эти данные не отправляются на бэкенд (см. `src/types/groupItems.ts`)
