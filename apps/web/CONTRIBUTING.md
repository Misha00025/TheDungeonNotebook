# Разработка Web-интерфейса

## Границы компонентов

- Повторно используемые UI-контролы и их общие стили принадлежат `@tdn/shared`. Не создавайте в remote копии кнопок, полей, панелей, списков или общей компоновки.
- Экранные и предметные компоненты связывают UI с API, состояниями загрузки и правами. Не переносите эту ответственность в shared-компоненты.
- Hub владеет глобальной навигацией, авторизацией и темой. Remote не добавляет вторую глобальную навигацию и отдельную палитру.
- Используйте существующие theme variables (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent-color`, `--border-color` и связанные переменные). Не задавайте remote-собственные цвета темы.

## Композиция GM Campaign UI

- Обзор кампании показывает слева имя персонажа и отдельные теги назначенных ведущих с правом записи, а справа — компактную ссылку-кнопку `LinkButton size="small"` к GM-обзору; наблюдатели в этом списке не отображаются.
- Список кампаний показывает одну кнопку входа: `Вести` при `canWrite` (с приоритетом над чтением), иначе `Играть` при `canRead`; рядом с названием доступна роль `ГМ` или `Игрок`. Карточки имеют приблизительные пропорции 2:1 и нижнюю кнопку входа во всю ширину.
- Полный список персонажей GM сгруппирован по важности. Кнопки записей прозрачны без наведения и получают фон при наведении; имена и описания выравниваются слева.
- Key-персонажи представлены карточками фиксированной ширины `10rem` с пропорцией 3:4, полной рамкой и именем с описанием у нижнего левого края.
- Secondary отображаются вертикальными строками с короткой акцентной полосой слева; Background — компактными строками. Для обоих описания показываются в одну строку с многоточием, рамок нет.
- Описание Key занимает не более 40% высоты карточки и может переноситься на несколько строк; короткий текст не создаёт пустой области. Пустые описания не показываются, полные значения остаются в данных.
- Страница шаблона — singleton: metadata шаблона не редактируется; базовые и виртуальные поля отображаются в отдельных native `DataTable`, а общие команды «Сохранить» и «Отменить» находятся в шапке страницы.
- Формулы кампании отображаются в общей inline-таблице с редактированием названия, выражения и параметров; общие команды «Сохранить» и «Отменить» применяются ко всем строкам, а создание открывается отдельным диалогом без потери табличного черновика.
- Сохранение формул выполняется последовательно и не является атомарной транзакцией. Название и содержимое используют независимые ревизии; после подтверждённого частичного успеха baseline сохранённого домена остаётся принятым, а остальные изменения остаются черновиком.
- После конфликта или неопределённого результата формулу нужно перечитать явно. Перечитывание обновляет подтверждённые baseline, сохраняет локальные изменения, не запускает запись автоматически и снимает блокировку только после успешного чтения.
- Удаление поля сначала локально помечает его к удалению; строку можно восстановить до общего сохранения. Общая отмена возвращает последний подтверждённый baseline и удаляет новые черновики.
- Общая команда сохранения отправляет полные массивы всех изменённых групп: сначала базовые поля, затем виртуальные, используя общую content revision. Запросы не атомарны: после частичного успеха подтверждённый baseline сохраняется, а общая отмена сбрасывает только оставшиеся черновики. Базовый PUT roundtrips пассивное описание шаблона.
- Левый drag handle позволяет менять локальный порядок базовых и виртуальных полей отдельно; общие «Сохранить» и «Отменить» сохраняют и отменяют порядок вместе с остальными черновиками. На handle доступны стрелки вверх и вниз.
- Описание, варианты, значения MultiChoice и связи виртуального поля редактируются отдельными Template-модалками как локальный draft. «Применить» обновляет draft; серверная запись выполняется только общей командой «Сохранить».
- Формула виртуального поля выбирается в таблице. Модалка связей загружает объявленные параметры выбранной формулы и показывает пары «параметр/поле» в табличных строках; связывать можно только с сохранёнными полями. Ручного ввода ID, отдельного родителя и произвольных параметров нет. Ошибку чтения можно повторить; модалка меняет только локальный draft bindings.
- Изменённые, новые и помеченные к удалению строки имеют theme-based цветовое различие; действие восстановления и удаление доступны для соответствующих строк до общей команды сохранения.
- `VirtualFieldsEditor` поддерживает opt-in `compact`; компонент `CharacterVirtuals` не подключён к активному интерфейсу листа персонажа.

## Нативная семантика и компоновка

- `Button` рендерит настоящий `<button>` и по умолчанию имеет `type="button"`; поддерживает общий параметр `size="small"` и вариант `ghost`, не меняющий стандартный вариант. Для отправки формы всегда указывайте `type="submit"` явно.
- `LinkButton` и `SectionNav` рендерят настоящие ссылки React Router. Не имитируйте переходы через `onClick` на `div` и не вкладывайте интерактивные элементы друг в друга.
- `Field` связывает подпись с контролом через обязательный `htmlFor`; hint/error получают ID `${htmlFor}-hint` и `${htmlFor}-error`. Если контролу нужно объявить эти связи, потребитель передаёт соответствующие ID в `aria-describedby`; `Field` не клонирует детей.
- Расширяйте `List`, `AdaptiveLayout`, `PageHeader` и `SearchBar` обратно совместимо, сохраняя существующее поведение по умолчанию.
- Для grid/flex-потомков задавайте `min-width: 0`, чтобы длинный контент не расширял контейнер. Ограничивайте ширину локально и включайте горизонтальную прокрутку только у той области, которая действительно должна прокручиваться.

## Shared SDK

Реализованные пилотные компоненты расположены здесь:

| Компонент | Исходный файл |
| --- | --- |
| `Button`, `LinkButton`, `IconButton`, `DragHandle` | `packages/shared/src/ui/Buttons/Button.tsx`, `packages/shared/src/ui/Buttons/LinkButton.tsx`, `packages/shared/src/ui/Buttons/IconButton/IconButton.tsx`, `packages/shared/src/ui/Buttons/DragHandle.tsx`, `packages/shared/src/styles/components/Button.module.css`, `packages/shared/src/ui/Buttons/IconButton/IconButton.module.css`, `packages/shared/src/ui/Buttons/DragHandle.module.css` |
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
| `ClampedText` | `packages/shared/src/ui/ClampedText/ClampedText.tsx`, `packages/shared/src/ui/ClampedText/ClampedText.module.css`; принимает строковые `children`, необязательный `className` и CSS-длину `maxHeight`. По умолчанию заполняет доступную область; с `maxHeight` ограничивает естественную высоту. Усечение относится только к отображению, полный текст остаётся в данных |
| `DropdownMenu` | `packages/shared/src/ui/DropdownMenu/DropdownMenu.tsx`, `packages/shared/src/ui/DropdownMenu/DropdownMenu.module.css` |
| `BottomNavigation`, `NavigationIcon` | `packages/shared/src/ui/BottomNavigation/BottomNavigation.tsx`, `packages/shared/src/ui/BottomNavigation/BottomNavigation.module.css`, `packages/shared/src/ui/NavigationIcon/NavigationIcon.tsx`, private hook `packages/shared/src/ui/hooks/useMediaQuery.ts` |
| `ModalPortal` | `packages/shared/src/ui/ModalPortal/ModalPortal.tsx`, `packages/shared/src/ui/ModalPortal/ModalPortal.module.css` |
| `Notification` | `packages/shared/src/ui/Notification/Notification.tsx`, `packages/shared/src/ui/Notification/Notification.module.css`, `packages/shared/src/styles/globals.css` |

Публичный API shared-пакета объявляется в `packages/shared/src/index.ts`. При добавлении компонента экспортируйте сам компонент и его публичный тип пропсов. Сначала проверьте реальные потребители и существующие аналоги, затем вносите минимальное совместимое расширение и добавляйте unit/component-тесты функциональности согласно разделу «Проверки». Не считайте пилотную интеграцию миграцией всех экранов: остальные экраны переносятся отдельно.

### Native modal и контекстная навигация

`ModalPortal` с API `isOpen`, `onClose`, `children`, `title?`, `size?` (`compact` по умолчанию при title, либо `wide`) и `dismissDisabled?` сохраняет legacy-разметку, если `title` не задан. Указанный `title` включает native `<dialog>` с порталом в `document.body`; браузер отвечает за modal focus/inert поведение. Диалог остаётся смонтирован, пока потребитель держит `isOpen=true`. Потребитель владеет подтверждением отмены, dirty draft и busy guard в `onClose`, а `dismissDisabled` блокирует Escape, backdrop и кнопку закрытия во время busy. SDK не очищает данные и не закрывает диалог самостоятельно.

`BottomNavigation` создаёт нижнюю полосу только при совпадении media query `(max-width: 768px)` и портирует её в `document.body`, чтобы контейнеры `WorkspaceLayout` не меняли fixed positioning. Потребитель передаёт строки label, иконки, реальные Router `to` и вычисленное active состояние. Переполнение превращается в кнопку «Ещё» справа с меню вверх; горизонтальной прокрутки нет. В desktop режиме компонента в DOM нет, обычная боковая навигация остаётся на месте. `WorkspaceLayout.mobileNavigation`, `SectionNav.hideOnMobile` и `TabBar.hideOnMobile` предназначены для согласования этих двух представлений.

`Notification` принимает `kind` (`success`, `error`, `warning`, `info`), `children`, необязательный `eventKey` и `durationMs` (по умолчанию 6000 мс). Компонент портирует уведомления в общий верхний правый DOM-stack и показывает оставшееся время полосой прогресса; hover, фокус внутри и ручное закрытие управляют таймером. Семантические theme tokens `--notification-success-color`, `--notification-error-color`, `--notification-warning-color` и `--notification-info-color` задают зелёный success, красный error, янтарный warning и синий info; фон и текст остаются theme-based. Новый `eventKey` показывает новое событие, тогда как повторный render прежнего ключа не перезапускает закрытое уведомление. Root перемещается в верхний открытый native dialog, а remote bundles используют общий DOM-root без общего React context. Operational feedback активных маршрутов может исчезать по таймеру или закрываться пользователем; recovery-команды остаются inline и доступны после этого. Закрытие уведомления не снимает dirty/blocked состояние и не повторяет небезопасную команду. Loading/empty, field validation и вычисляемая диагностика остаются inline.

`List` поддерживает `columns={2|3}` и `minItemWidth` для сетки, которая рассчитывается от фактической ширины контейнера; число колонок ограничивает максимум, а не обещает его на узком месте. `auto-fill` оставляет одиночные карточки в track обычного размера. Для текстовой строки с дополнительными данными и действиями используйте `ListItem` props `meta` и `actions`; старый режим целой кликабельной строки не меняется.

`Panel` и `ListItem` принимают `density="compact"` для более плотной компоновки; по умолчанию используется `density="default"`. `FormGrid` задаёт адаптивную сетку полей и принимает `minColumnWidth` (по умолчанию `12rem`), а также обычные атрибуты и `style` контейнера. Он не изменяет размеры вложенных контролов.

`Textarea` — нативный textarea с теми же theme-based контрол-стилями, что `Input`, и вертикальным resize. `Field` остаётся ответственным за label/hint/error association.

`FieldSet` рендерит нативный `<fieldset>` с необязательным `legend`; стандартное поведение `disabled` наследуется браузером.

`DataTable` — нативная таблица с ручной композицией `thead`/`tbody` и прокручиваемой обёрткой. Передавайте стандартные атрибуты таблицы, `className`/`style` для самой таблицы, `wrapperClassName` для обёртки и `minWidth` (по умолчанию `40rem`) для её CSS-переменной `--table-min-width`. Колонки и строки задаёт потребитель; компонент не добавляет сортировку, пагинацию или адаптацию таблицы в карточки.

`Statistic` принимает отдельные `label` и `value`, выводя их как `dt` и `dd` внутри article; не передавайте этот label повторно как заголовок `Panel`. `Panel` допускает title-only и body-only варианты без пустого body или header. `PageHeader.title` и `subtitle` принимают ReactNode; optional `titleAside` размещается рядом с semantic heading, но вне него. При нетекстовом title задайте явный `imageAlt`, если в заголовке есть изображение. `IconButton` поддерживает `check` и `close`, `disabled`, `busy` и `ariaLabel`; доступное имя по умолчанию берётся из `title`.

Пользовательские подписи и сообщения об ошибках не должны выводить служебные идентификаторы, ревизии, коды ошибок или необработанные payload/error details. Внутренние DTO, option values и API-запросы при этом сохраняют необходимые идентификаторы и ревизии. JSON, который пользователь редактирует как конфигурацию, остаётся доступным для редактирования и не является debug dump.

В листе персонажа имя редактируется inline в шапке, важность отображается рядом с ним, а описание находится ниже имени и редактируется inline. Обзор содержит только полноширинное представление листа. Вкладка характеристик показывает базовые поля и вычисляемые значения в таблицах. Валидное изменение базового поля сразу ставится на запись отдельным запросом; пока запрос выполняется, последующие правки того же поля объединяются в последнее значение. Записи сериализуются через общий актуальный content revision с запросами описания и других изменений листа. Для явного базового значения доступен сброс; после ошибки или блокировки повторная отправка черновика требует явного действия. Неизвестный результат и конфликт не приводят к автоматическому повтору записи; перечитывание обновляет baseline, сохраняя черновик. Индивидуальные формулы удалены из интерфейса персонажа, не затрагивая сохранённые данные или вычисляемые значения.

Описание записывается отдельным запросом со своей content revision; поля и описание сериализуются через общий content revision, а метаданные используют независимую metadata revision. Редактирование метаданных создаёт локальный dirty draft; blur не сохраняет. Сохранение метаданных отправляется только явной командой и использует текущую metadata revision. При конфликте или неизвестном результате выполняется GET для обновления baseline, черновик остаётся на месте, а запись автоматически не повторяется.

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

Unit/component-тестами покрывается только функциональность: наблюдаемое поведение, пользовательские действия и их результат, работа с данными/API, валидация, права и обработка ошибок. Не тестируйте DOM-структуру и вложенность элементов, CSS-классы, стили, цвета, размеры, отступы, расположение элементов и другие детали оформления; не закрепляйте их DOM-снимками. DOM допустимо использовать для выполнения пользовательских действий и проверки функционального результата, но не как контракт устройства разметки. Изменение разметки или оформления без изменения поведения не должно требовать написания или переписывания тестов. Unit/component-тесты не подтверждают визуальный вид; визуальный просмотр выполняется отдельно. Руководство описывает публичные правила разработки Web и не заменяет визуальную проверку.

`apps/web/.dockerignore` исключает unit/spec-файлы и setup tests из build context для Web-образов. Это ограничение контекста контейнерной сборки; unit-тесты и typecheck запускаются из checkout перечисленными командами.
