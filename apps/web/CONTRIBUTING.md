# Разработка Web-интерфейса

## Границы компонентов

- Повторно используемые UI-контролы и их общие стили принадлежат `@tdn/shared`. Не создавайте в remote копии кнопок, полей, панелей, списков или общей компоновки.
- Экранные и предметные компоненты связывают UI с API, состояниями загрузки и правами. Не переносите эту ответственность в shared-компоненты.
- Hub владеет глобальной навигацией, авторизацией и темой. Remote не добавляет вторую глобальную навигацию и отдельную палитру.
- Используйте существующие theme variables (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent-color`, `--border-color` и связанные переменные). Не задавайте remote-собственные цвета темы.

## Композиция GM Campaign UI

- Обзор кампании показывает слева имя персонажа и отдельные теги назначенных ведущих с правом записи, а справа — компактную ссылку-кнопку `LinkButton size="small"` к GM-обзору; наблюдатели в этом списке не отображаются.
- Полный список персонажей GM сгруппирован по важности. Описания карточек и фоновых строк загружаются из листа персонажа.
- Страница шаблона — singleton: metadata шаблона не редактируется; базовые и виртуальные поля отображаются в отдельных native `DataTable` с одним field на строку и собственными действиями сохранения, отмены и удаления.
- Сохранение строки шаблона формирует полный список соответствующего вида из последнего сохранённого baseline, заменяя только целевое поле; несохранённые соседние строки и черновики не включаются. Базовое сохранение roundtrips пассивное описание шаблона.
- Описание, варианты, значения MultiChoice и связи виртуального поля редактируются отдельными Template-модалками как локальный draft. «Применить» обновляет черновик строки, а серверная запись выполняется её row-action Save.
- Формула виртуального поля выбирается в таблице. Модалка связей загружает объявленные параметры выбранной формулы и показывает пары «параметр/поле» в табличных строках; связывать можно только с сохранёнными полями. Ручного ввода ID, отдельного родителя и произвольных параметров нет. Ошибку чтения можно повторить; модалка меняет только локальный draft bindings.
- В таблицах шаблона действия ✓/× показываются только для изменённых строк; удаление помечено danger-вариантом `IconButton`.
- `VirtualFieldsEditor` поддерживает opt-in `compact`. Потребитель `CharacterVirtuals` использует default-режим без этого флага.

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
| `Button`, `LinkButton`, `IconButton` | `packages/shared/src/ui/Buttons/Button.tsx`, `packages/shared/src/ui/Buttons/LinkButton.tsx`, `packages/shared/src/ui/Buttons/IconButton/IconButton.tsx`, `packages/shared/src/styles/components/Button.module.css`, `packages/shared/src/ui/Buttons/IconButton/IconButton.module.css` |
| `Panel`, `Badge`, `StatePanel`, `Statistic` | `packages/shared/src/ui/Panel/Panel.tsx`, `packages/shared/src/ui/Panel/Panel.module.css`, `packages/shared/src/ui/StatePanel/StatePanel.tsx`, `packages/shared/src/ui/Statistic/Statistic.tsx`, `packages/shared/src/ui/Statistic/Statistic.module.css` |
| `DataTable` | `packages/shared/src/ui/DataTable/DataTable.tsx`, `packages/shared/src/ui/DataTable/DataTable.module.css` |
| `Field`, `Input`, `Select`, `Textarea` | `packages/shared/src/ui/Form/Field.tsx`, `packages/shared/src/ui/Form/Input.tsx`, `packages/shared/src/ui/Form/Select.tsx`, `packages/shared/src/ui/Form/Textarea.tsx`, `packages/shared/src/ui/Form/Field.module.css`, `packages/shared/src/styles/components/Input.module.css` |
| `FieldSet` | `packages/shared/src/ui/Form/FieldSet.tsx`, `packages/shared/src/ui/Form/FieldSet.module.css` |
| `FormGrid` | `packages/shared/src/ui/Form/FormGrid.tsx`, `packages/shared/src/ui/Form/FormGrid.module.css` |
| `WorkspaceLayout` | `packages/shared/src/ui/WorkspaceLayout/WorkspaceLayout.tsx`, `packages/shared/src/ui/WorkspaceLayout/WorkspaceLayout.module.css` |
| `SectionNav` | `packages/shared/src/ui/SectionNav/SectionNav.tsx`, `packages/shared/src/ui/SectionNav/SectionNav.module.css` |
| `ActionRow`, `Toolbar` | `packages/shared/src/ui/Composition/ActionRow.tsx`, `packages/shared/src/ui/Composition/Toolbar.tsx`, `packages/shared/src/ui/Composition/Composition.module.css` |
| `PageHeader` | `packages/shared/src/ui/PageLayout/PageHeader.tsx`, `packages/shared/src/ui/PageLayout/PageLayout.module.css` |
| `TabBar` | `packages/shared/src/ui/PageLayout/TabBar.tsx`, `packages/shared/src/ui/PageLayout/PageLayout.module.css` |
| `SearchBar` | `packages/shared/src/ui/Search/SearchBar.tsx`, `packages/shared/src/ui/Search/SearchBar.module.css` |
| `List`, `ListItem` | `packages/shared/src/ui/List/List.tsx`, `packages/shared/src/ui/List/ListItem.tsx`, `packages/shared/src/ui/List/List.module.css`, `packages/shared/src/ui/List/ListItem.module.css` |
| `DropdownMenu` | `packages/shared/src/ui/DropdownMenu/DropdownMenu.tsx`, `packages/shared/src/ui/DropdownMenu/DropdownMenu.module.css` |
| `BottomNavigation`, `NavigationIcon` | `packages/shared/src/ui/BottomNavigation/BottomNavigation.tsx`, `packages/shared/src/ui/BottomNavigation/BottomNavigation.module.css`, `packages/shared/src/ui/NavigationIcon/NavigationIcon.tsx`, private hook `packages/shared/src/ui/hooks/useMediaQuery.ts` |
| `ModalPortal` | `packages/shared/src/ui/ModalPortal/ModalPortal.tsx`, `packages/shared/src/ui/ModalPortal/ModalPortal.module.css` |

Публичный API shared-пакета объявляется в `packages/shared/src/index.ts`. При добавлении компонента экспортируйте сам компонент и его публичный тип пропсов. Сначала проверьте реальные потребители и существующие аналоги, затем вносите минимальное совместимое расширение и добавляйте unit/component-тесты поведения и семантики. Не считайте пилотную интеграцию миграцией всех экранов: остальные экраны переносятся отдельно.

### Native modal и контекстная навигация

`ModalPortal` с API `isOpen`, `onClose`, `children`, `title?`, `size?` (`compact` по умолчанию при title, либо `wide`) и `dismissDisabled?` сохраняет legacy-разметку, если `title` не задан. Указанный `title` включает native `<dialog>` с порталом в `document.body`; браузер отвечает за modal focus/inert поведение. Диалог остаётся смонтирован, пока потребитель держит `isOpen=true`. Потребитель владеет подтверждением отмены, dirty draft и busy guard в `onClose`, а `dismissDisabled` блокирует Escape, backdrop и кнопку закрытия во время busy. SDK не очищает данные и не закрывает диалог самостоятельно.

`BottomNavigation` создаёт нижнюю полосу только при совпадении media query `(max-width: 768px)` и портирует её в `document.body`, чтобы контейнеры `WorkspaceLayout` не меняли fixed positioning. Потребитель передаёт строки label, иконки, реальные Router `to` и вычисленное active состояние. Переполнение превращается в кнопку «Ещё» справа с меню вверх; горизонтальной прокрутки нет. В desktop режиме компонента в DOM нет, обычная боковая навигация остаётся на месте. `WorkspaceLayout.mobileNavigation`, `SectionNav.hideOnMobile` и `TabBar.hideOnMobile` предназначены для согласования этих двух представлений.

`List` поддерживает `columns={2|3}` и `minItemWidth` для сетки, которая рассчитывается от фактической ширины контейнера; число колонок ограничивает максимум, а не обещает его на узком месте. `auto-fill` оставляет одиночные карточки в track обычного размера. Для текстовой строки с дополнительными данными и действиями используйте `ListItem` props `meta` и `actions`; старый режим целой кликабельной строки не меняется.

`Panel` и `ListItem` принимают `density="compact"` для более плотной компоновки; по умолчанию используется `density="default"`. `FormGrid` задаёт адаптивную сетку полей и принимает `minColumnWidth` (по умолчанию `12rem`), а также обычные атрибуты и `style` контейнера. Он не изменяет размеры вложенных контролов.

`Textarea` — нативный textarea с теми же theme-based контрол-стилями, что `Input`, и вертикальным resize. `Field` остаётся ответственным за label/hint/error association.

`FieldSet` рендерит нативный `<fieldset>` с необязательным `legend`; стандартное поведение `disabled` наследуется браузером.

`DataTable` — нативная таблица с ручной композицией `thead`/`tbody` и прокручиваемой обёрткой. Передавайте стандартные атрибуты таблицы, `className`/`style` для самой таблицы, `wrapperClassName` для обёртки и `minWidth` (по умолчанию `40rem`) для её CSS-переменной `--table-min-width`. Колонки и строки задаёт потребитель; компонент не добавляет сортировку, пагинацию или адаптацию таблицы в карточки.

`Statistic` принимает отдельные `label` и `value`, выводя их как `dt` и `dd` внутри article; не передавайте этот label повторно как заголовок `Panel`. `Panel` допускает title-only и body-only варианты без пустого body или header. `PageHeader.title` и `subtitle` принимают ReactNode; optional `titleAside` размещается рядом с semantic heading, но вне него. При нетекстовом title задайте явный `imageAlt`, если в заголовке есть изображение. `IconButton` поддерживает `check` и `close`, `disabled`, `busy` и `ariaLabel`; доступное имя по умолчанию берётся из `title`.

Пользовательские подписи и сообщения об ошибках не должны выводить служебные идентификаторы, ревизии, коды ошибок или необработанные payload/error details. Внутренние DTO, option values и API-запросы при этом сохраняют необходимые идентификаторы и ревизии. JSON, который пользователь редактирует как конфигурацию, остаётся доступным для редактирования и не является debug dump.

В листе персонажа имя редактируется inline в шапке, важность отображается рядом с ним, а описание находится ниже имени и редактируется inline. Обзор содержит только полноширинное представление листа. Описание записывается отдельным запросом со своей content revision; поля и описание сериализуются через общий content revision, а метаданные используют независимую metadata revision. Редактирование метаданных создаёт локальный dirty draft; blur не сохраняет. Сохранение отправляется только явной командой и использует текущую metadata revision. При конфликте или неизвестном результате выполняется GET для обновления baseline, черновик остаётся на месте, а запись автоматически не повторяется.

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

`apps/web/.dockerignore` исключает unit/spec-файлы и setup tests из build context для Web-образов. Это ограничение контекста контейнерной сборки; unit-тесты и typecheck запускаются из checkout перечисленными командами.
