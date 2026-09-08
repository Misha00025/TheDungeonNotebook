# Tdn.Shared

Общая C# библиотека (classlib, net8.0) с типами/DTO, разделяемыми между C#-сервисами
TheDungeonNotebook: `game-systems-service` и `campaign-service`.

## Модели (`Tdn.Shared.Models`)

| Модель | Назначение |
|--------|-----------|
| `GameSystem` | Игровая система (D&D 5e, Pathfinder 2e и т.п.), агрегат верхнего уровня |
| `SystemVersion` | Версия игровой системы с неизменяемым набором контента |
| `ContentItem` | Элемент контента версии; тип задаётся `ContentType` (Item / Skill / CharacterTemplate) |
| `SnapshotRef` | Ссылка на снапшот версии для «закрепления» контента сервисами-потребителями |

## Подключение

Добавить `ProjectReference` в `.csproj` сервиса:

```xml
<ItemGroup>
  <ProjectReference Include="..\Tdn.Shared\Tdn.Shared.csproj" />
</ItemGroup>
```

## Примечание по именованию

Модель игровой системы названа `GameSystem`, а не `System`, чтобы избежать конфликта
с корневым пространством имён `System` (при включённом `ImplicitUsings` каждый файл
сервиса имеет неявный `using System;`).
