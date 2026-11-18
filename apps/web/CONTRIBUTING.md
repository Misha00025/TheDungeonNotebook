# Разработка Web-интерфейса

## Границы компонентов

- Повторно используемые UI-контролы и их общие стили принадлежат `@tdn/shared`. Не создавайте в remote копии кнопок, полей, панелей, списков или общей компоновки.
- Экранные и предметные компоненты связывают UI с API, состояниями загрузки и правами. Не переносите эту ответственность в shared-компоненты.
- Hub владеет глобальной навигацией, авторизацией и темой. Remote не добавляет вторую глобальную навигацию и отдельную палитру.
- Используйте существующие theme variables (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent-color`, `--border-color` и связанные переменные). Не задавайте remote-собственные цвета темы.

## Нативная семантика и компоновка

- `Button` рендерит настоящий `<button>` и по умолчанию имеет `type="button"`. Для отправки формы всегда указывайте `type="submit"` явно.
- `LinkButton` и `SectionNav` рендерят настоящие ссылки React Router. Не имитируйте переходы через `onClick` на `div` и не вкладывайте интерактивные элементы друг в друга.
- `Field` связывает подпись с контролом через обязательный `htmlFor`; hint/error получают ID `${htmlFor}-hint` и `${htmlFor}-error`. Если контролу нужно объявить эти связи, потребитель передаёт соответствующие ID в `aria-describedby`; `Field` не клонирует детей.
- Расширяйте `List`, `AdaptiveLayout`, `PageHeader` и `SearchBar` обратно совместимо, сохраняя существующее поведение по умолчанию.
- Для grid/flex-потомков задавайте `min-width: 0`, чтобы длинный контент не расширял контейнер. Ограничивайте ширину локально и включайте горизонтальную прокрутку только у той области, которая действительно должна прокручиваться.

## Shared SDK

Реализованные пилотные компоненты расположены здесь:

| Компонент | Исходный файл |
| --- | --- |
| `Button`, `LinkButton` | `packages/shared/src/ui/Buttons/Button.tsx`, `packages/shared/src/ui/Buttons/LinkButton.tsx`, `packages/shared/src/styles/components/Button.module.css` |
| `Panel`, `Badge`, `StatePanel` | `packages/shared/src/ui/Panel/Panel.tsx`, `packages/shared/src/ui/StatePanel/StatePanel.tsx`, `packages/shared/src/ui/Panel/Panel.module.css` |
| `Field`, `Input`, `Select` | `packages/shared/src/ui/Form/Field.tsx`, `packages/shared/src/ui/Form/Input.tsx`, `packages/shared/src/ui/Form/Select.tsx`, `packages/shared/src/ui/Form/Field.module.css`, `packages/shared/src/styles/components/Input.module.css` |
| `WorkspaceLayout` | `packages/shared/src/ui/WorkspaceLayout/WorkspaceLayout.tsx`, `packages/shared/src/ui/WorkspaceLayout/WorkspaceLayout.module.css` |
| `SectionNav` | `packages/shared/src/ui/SectionNav/SectionNav.tsx`, `packages/shared/src/ui/SectionNav/SectionNav.module.css` |
| `ActionRow`, `Toolbar` | `packages/shared/src/ui/Composition/ActionRow.tsx`, `packages/shared/src/ui/Composition/Toolbar.tsx`, `packages/shared/src/ui/Composition/Composition.module.css` |
| `PageHeader` | `packages/shared/src/ui/PageLayout/PageHeader.tsx`, `packages/shared/src/ui/PageLayout/PageLayout.module.css` |
| `SearchBar` | `packages/shared/src/ui/Search/SearchBar.tsx`, `packages/shared/src/ui/Search/SearchBar.module.css` |
| `List` | `packages/shared/src/ui/List/List.tsx`, `packages/shared/src/ui/List/List.module.css` |

Публичный API shared-пакета объявляется в `packages/shared/src/index.ts`. При добавлении компонента экспортируйте сам компонент и его публичный тип пропсов. Сначала проверьте реальные потребители и существующие аналоги, затем вносите минимальное совместимое расширение и добавляйте unit/component-тесты поведения и семантики. Не считайте пилотную интеграцию миграцией всех экранов: остальные экраны переносятся отдельно.

Пример формы:

```tsx
import { Button, Field, Input, Panel } from '@tdn/shared';

function NameForm() {
  return (
    <form>
      <Panel title="Имя персонажа">
        <Field label="Имя" htmlFor="character-name" hint="Введите имя">
          <Input id="character-name" aria-describedby="character-name-hint" />
        </Field>
        <Button type="submit">Сохранить</Button>
      </Panel>
    </form>
  );
}
```

## Проверки

Команды запускаются из `apps/web`:

```sh
npm run test:run
npm run typecheck --workspaces --if-present
npm run build:campaign
npm run build:hub
npm run build:profile
npm run build:login
npm run build:game-systems
```

Unit/component-тесты проверяют поведение и доступную семантику; они не подтверждают визуальную геометрию. Визуальный просмотр выполняется отдельно. Руководство описывает публичные правила разработки Web и не заменяет визуальную проверку.
