# План тестирования

## Запуск тестов

```bash
npm test            # watch mode
npm test -- --watchAll=false   # single run
```

Файлы тестов класть рядом с тестируемым модулем: `<name>.test.ts` или `<name>.test.tsx`.

---

## 1. `src/utils/evaluateExpression.ts`

**Тип:** Pure function — парсинг и вычисление математических выражений.

### Тест-кейсы

| # | Вход | Ожидаемый результат | Комментарий |
|---|------|---------------------|-------------|
| 1 | `''` | `NaN` | Пустая строка |
| 2 | `null` / `undefined` | `NaN` | Null/undefined |
| 3 | `'   '` | `NaN` | Пробелы |
| 4 | `'abc'` | `NaN` | Недопустимые символы |
| 5 | `'2+3'` | `5` | Базовая сумма |
| 6 | `'10 - 4'` | `6` | Вычитание |
| 7 | `'3 * 7'` | `21` | Умножение |
| 8 | `'10 / 2'` | `5` | Деление |
| 9 | `'10 % 3'` | `1` | Остаток |
| 10 | `'2 ^ 3'` | `8` | Степень |
| 11 | `'2 + 3 * 4'` | `14` | Приоритет операторов |
| 12 | `'(2 + 3) * 4'` | `20` | Скобки |
| 13 | `'42'` | `42` | Просто число |
| 14 | `'3.5 + 2.5'` | `6` | Дробные числа |
| 15 | `'1 / 0'` | `Infinity` | Деление на ноль |

### Код

```ts
// src/utils/evaluateExpression.test.ts
import { evaluateExpression } from './evaluateExpression';

describe('evaluateExpression', () => {
  it('returns NaN for empty string', () => {
    expect(evaluateExpression('')).toBeNaN();
  });

  it('returns NaN for invalid characters', () => {
    expect(evaluateExpression('abc')).toBeNaN();
  });

  it('evaluates simple addition', () => {
    expect(evaluateExpression('2 + 3')).toBe(5);
  });

  it('respects operator precedence', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
  });

  it('handles parentheses', () => {
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20);
  });

  it('handles power operator', () => {
    expect(evaluateExpression('2 ^ 3')).toBe(8);
  });

  it('handles decimal numbers', () => {
    expect(evaluateExpression('3.5 + 2.5')).toBe(6);
  });

  it('returns pure number as-is', () => {
    expect(evaluateExpression('42')).toBe(42);
  });
});
```

---

## 2. `src/utils/generateKey.ts`

**Тип:** Pure function — конвертация названия поля в snake_case key.

### Тест-кейсы

| # | Вход | Ожидаемый результат |
|---|------|---------------------|
| 1 | `'My Field'` | `'my_field'` |
| 2 | `'Hello World'` | `'hello_world'` |
| 3 | `'Name'` | `'name'` |
| 4 | `'field with   multiple  spaces'` | `'field_with___multiple__spaces'` |
| 5 | `''` | `''` |
| 6 | `'123'` | `'123'` |
| 7 | `'UPPERCASE'` | `'uppercase'` |
| 8 | `'special!@#$chars'` | `'specialchars'` |
| 9 | `'Привет Мир'` | `'привет_мир'` |

### Код

```ts
// src/utils/generateKey.test.ts
import { generateKey } from './generateKey';

describe('generateKey', () => {
  it('converts spaces to underscores', () => {
    expect(generateKey('My Field')).toBe('my_field');
  });

  it('lowercases the string', () => {
    expect(generateKey('HELLO')).toBe('hello');
  });

  it('removes special characters', () => {
    expect(generateKey('hello!@#world')).toBe('helloworld');
  });

  it('handles Russian text', () => {
    expect(generateKey('Привет Мир')).toBe('привет_мир');
  });

  it('handles empty string', () => {
    expect(generateKey('')).toBe('');
  });

  it('preserves digits', () => {
    expect(generateKey('Field 123')).toBe('field_123');
  });
});
```

---

## 3. `src/utils/groupByAttributes.ts`

**Тип:** Pure function — иерархическая группировка элементов по атрибутам.

### Тест-кейсы

**Базовые случаи:**
- Пустой массив элементов → `[{ id: 'all', name: 'Все элементы', items: [], children: [] }]`
- Пустой список атрибутов → одна корневая группа со всеми элементами
- Один атрибут → группы по значениям этого атрибута
- Два атрибута → вложенные группы

**Сортировка:**
- Целочисленные значения сортируются по возрастанию чисел (1, 2, 10, а не 1, 10, 2)
- Строковые значения — лексикографически
- `Не задано` всегда в конце
- Смешанные типы (числа + строки)

**Граничные случаи:**
- Все элементы без указанного атрибута
- Элемент без `attributes` (undefined)
- Один элемент в каждой группе

### Код

```ts
// src/utils/groupByAttributes.test.ts
import { groupByAttributes, Group } from './groupByAttributes';

interface TestItem {
  name: string;
  attributes?: Array<{ name: string; value: string }>;
}

describe('groupByAttributes', () => {
  it('returns a single group for empty items', () => {
    const result = groupByAttributes<TestItem>([], ['type']);
    expect(result).toEqual([{ id: 'all', name: 'Все элементы', items: [], children: [] }]);
  });

  it('returns a single group for empty attribute names', () => {
    const items = [{ name: 'item1' }];
    const result = groupByAttributes(items, []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Все элементы');
    expect(result[0].items).toEqual(items);
  });

  it('groups items by a single attribute', () => {
    const items: TestItem[] = [
      { name: 'sword', attributes: [{ name: 'type', value: 'weapon' }] },
      { name: 'shield', attributes: [{ name: 'type', value: 'armor' }] },
    ];
    const result = groupByAttributes(items, ['type']);
    expect(result).toHaveLength(2);
    expect(result[0].name).toContain('armor');
    expect(result[1].name).toContain('weapon');
  });

  it('creates nested groups for multiple attributes', () => {
    const items: TestItem[] = [
      { name: 'sword', attributes: [{ name: 'type', value: 'weapon' }, { name: 'rarity', value: 'rare' }] },
    ];
    const result = groupByAttributes(items, ['type', 'rarity']);
    expect(result[0].children).toHaveLength(1);
  });

  it('places items without attribute in "Не задано" group', () => {
    const items: TestItem[] = [
      { name: 'unknown', attributes: [] },
    ];
    const result = groupByAttributes(items, ['type']);
    expect(result[0].name).toContain('Не задано');
  });

  it('sorts integer values numerically, not lexicographically', () => {
    const items: TestItem[] = [
      { name: 'a', attributes: [{ name: 'level', value: '10' }] },
      { name: 'b', attributes: [{ name: 'level', value: '2' }] },
      { name: 'c', attributes: [{ name: 'level', value: '1' }] },
    ];
    const result = groupByAttributes(items, ['level']);
    expect(result[0].name).toContain('1');
    expect(result[1].name).toContain('2');
    expect(result[2].name).toContain('10');
  });

  it('puts "Не задано" groups at the end', () => {
    const items: TestItem[] = [
      { name: 'known', attributes: [{ name: 'type', value: 'weapon' }] },
      { name: 'unknown', attributes: [] },
    ];
    const result = groupByAttributes(items, ['type']);
    expect(result[result.length - 1].name).toContain('Не задано');
  });
});
```

---

## 4. `src/utils/characterFields.ts`

**Тип:** Pure functions — категоризация полей персонажа по схеме шаблона.

### Структура для тестов

```ts
const mockCharacter: Character = {
  id: 1,
  name: 'Test',
  description: '',
  fields: {
    strength: { name: 'Сила', value: 10, description: '' },
    dexterity: { name: 'Ловкость', value: 12, description: '' },
    hp: { name: 'HP', value: 100, maxValue: 100, description: '' },
    notes: { name: 'Заметки', value: 0, description: 'просто текст' },
  },
  group: { id: 1, name: 'G', icon: null },
  templateId: 1,
};

const mockSchema: TemplateSchema = {
  categories: [
    {
      name: 'Характеристики',
      fields: ['strength', 'dexterity'],
      categories: [],
    },
    {
      name: 'Боевые',
      fields: ['hp'],
      categories: [],
    },
  ],
};
```

### Тест-кейсы для `categorizeCharacterFields`

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Схема есть, все поля в категориях | 2 категории, `other` отсутствует |
| 2 | Схема есть, часть полей вне категорий | Категории + `other` с непривязанными полями |
| 3 | Схема null | Только `other` со всеми полями |
| 4 | Схема с вложенными категориями | Правильная вложенная структура |
| 5 | Пустой объект fields | Пустые категории, `other` удалён |

### Тест-кейсы для `convertToTemplateCategory`

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | CategoryData с subcategories | Рекурсивная конвертация |
| 2 | CategoryData без subcategories | Простая конвертация |

### Код

```ts
// src/utils/characterFields.test.ts
import { categorizeCharacterFields, getFieldsByCategory, CategoryData } from './characterFields';
import { Character } from '../types/characters';
import { TemplateSchema } from '../types/groupSchemas';

const baseCharacter: Character = {
  id: 1,
  name: 'Grog',
  description: '',
  fields: {
    strength: { name: 'Сила', value: 10, description: '' },
    dexterity: { name: 'Ловкость', value: 12, description: '' },
    hp: { name: 'HP', value: 100, maxValue: 100, description: '' },
  },
  group: { id: 1, name: 'G', icon: null },
  templateId: 1,
};

describe('categorizeCharacterFields', () => {
  it('categorizes fields according to schema', () => {
    const schema: TemplateSchema = {
      categories: [
        { name: 'Stats', fields: ['strength', 'dexterity'], categories: [] },
        { name: 'Combat', fields: ['hp'], categories: [] },
      ],
    };
    const result = categorizeCharacterFields(baseCharacter, schema);
    expect(result).toHaveProperty('Stats');
    expect(result).toHaveProperty('Combat');
    expect(result).not.toHaveProperty('other');
  });

  it('puts uncategorized fields into "other"', () => {
    const char: Character = {
      ...baseCharacter,
      fields: { ...baseCharacter.fields, note: { name: 'Note', value: 0, description: '' } },
    };
    const schema: TemplateSchema = {
      categories: [{ name: 'Stats', fields: ['strength'], categories: [] }],
    };
    const result = categorizeCharacterFields(char, schema);
    expect(result.other).toBeDefined();
    expect(result.other.fields.some(([key]) => key === 'note')).toBe(true);
  });

  it('returns only "other" when schema is null', () => {
    const result = categorizeCharacterFields(baseCharacter, null);
    expect(result.other).toBeDefined();
    expect(result.other.fields.length).toBe(3);
  });

  it('removes "other" when it is empty', () => {
    const schema: TemplateSchema = {
      categories: [{ name: 'All', fields: ['strength', 'dexterity', 'hp'], categories: [] }],
    };
    const result = categorizeCharacterFields(baseCharacter, schema);
    expect(result).not.toHaveProperty('other');
  });
});
```

---

## 5. `src/hooks/usePlatform.ts`

**Тип:** Hook — определяет мобильное устройство по ширине окна.

### Что тестировать

| # | Сценарий | Подход |
|---|----------|--------|
| 1 | Начальная ширина меньше breakpoint | `isMobile === true` |
| 2 | Начальная ширина больше breakpoint | `isMobile === false` |
| 3 | Изменение размера с большого на маленький | Переключение с `false` на `true` |
| 4 | Изменение размера с маленького на большой | Переключение с `true` на `false` |
| 5 | Кастомный breakpoint | Передать `1024` |
| 6 | Очистка listener при unmount | Проверить через `cleanup` |

### Инструменты

Нужен мок `window.innerWidth` и симуляция `resize` события. Использовать `renderHook` из `@testing-library/react`.

### Код

```ts
// src/hooks/usePlatform.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePlatform } from './usePlatform';

describe('usePlatform', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
  });

  it('returns true when window width is less than breakpoint', () => {
    window.innerWidth = 500;
    const { result } = renderHook(() => usePlatform());
    expect(result.current).toBe(true);
  });

  it('returns false when window width is greater than breakpoint', () => {
    window.innerWidth = 1024;
    const { result } = renderHook(() => usePlatform());
    expect(result.current).toBe(false);
  });

  it('updates on resize', () => {
    window.innerWidth = 1024;
    const { result } = renderHook(() => usePlatform());

    act(() => {
      window.innerWidth = 500;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);
  });

  it('uses custom breakpoint', () => {
    window.innerWidth = 900;
    const { result } = renderHook(() => usePlatform(1024));
    expect(result.current).toBe(true);
  });
});
```

---

## 6. `src/hooks/useUserManagement.ts`

**Тип:** Hook — управление состоянием асинхронных операций (`loading`, `error`, `success`).

### Что тестировать

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Успешная операция | `loading: false`, `error: null`, `success: сообщение` |
| 2 | Ошибка с `Error` объектом | `loading: false`, `error: err.message`, `success: null` |
| 3 | Ошибка с plain string | `error: string` |
| 4 | Сброс error через `setError(null)` | `error: null` |
| 5 | Сброс success через `setSuccess(null)` | `success: null` |

### Код

```ts
// src/hooks/useUserManagement.test.ts
import { renderHook, act } from '@testing-library/react';
import { useUserManagement } from './useUserManagement';

describe('useUserManagement', () => {
  it('starts with default state', () => {
    const { result } = renderHook(() => useUserManagement());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.success).toBeNull();
  });

  it('sets success on successful operation', async () => {
    const { result } = renderHook(() => useUserManagement());
    const operation = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.executeOperation(operation, 'Success!');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.success).toBe('Success!');
    expect(result.current.error).toBeNull();
  });

  it('sets error on failed operation with Error', async () => {
    const { result } = renderHook(() => useUserManagement());

    await act(async () => {
      await result.current.executeOperation(
        () => Promise.reject(new Error('Something went wrong')),
        'msg'
      );
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Something went wrong');
    expect(result.current.success).toBeNull();
  });

  it('sets loading during operation', async () => {
    const { result } = renderHook(() => useUserManagement());
    let resolvePromise!: () => void;
    const operation = () => new Promise<void>(resolve => { resolvePromise = resolve; });

    act(() => {
      result.current.executeOperation(operation, 'ok');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePromise();
    });

    expect(result.current.loading).toBe(false);
  });

  it('allows manually resetting error', () => {
    const { result } = renderHook(() => useUserManagement());
    act(() => result.current.setError('test'));
    expect(result.current.error).toBe('test');
    act(() => result.current.setError(null));
    expect(result.current.error).toBeNull();
  });

  it('allows manually resetting success', () => {
    const { result } = renderHook(() => useUserManagement());
    act(() => result.current.setSuccess('test'));
    expect(result.current.success).toBe('test');
    act(() => result.current.setSuccess(null));
    expect(result.current.success).toBeNull();
  });
});
```

> **Примечание:** Если в проекте `vitest`, замени `vi.fn()` на `jest.fn()`. В CRA — `jest.fn()`.

---

## 7. `src/components/commons/EvaluatedInput/EvaluatedInput.tsx`

**Тип:** React компонент — поле ввода с вычислением выражений.

### Что тестировать

| # | Действие | Ожидание |
|---|----------|----------|
| 1 | Рендер с `initialValue` | Поле отображает `initialValue` |
| 2 | Изменение `initialValue` через props | Поле обновляется |
| 3 | Ввод текста + Enter | `onCommit` вызван с вычисленным значением |
| 4 | Ввод текста + blur | `onCommit` вызван |
| 5 | Escape | `onCancel` вызван, значение сброшено |
| 6 | Некорректное выражение + Enter | `onCommit` вызван с исходным текстом |
| 7 | Ввод числа + Enter | `onCommit` вызван с числом |

### Код

```tsx
// src/components/commons/EvaluatedInput/EvaluatedInput.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvaluatedInput from './EvaluatedInput';

describe('EvaluatedInput', () => {
  it('renders with initial value', () => {
    render(<EvaluatedInput initialValue="42" onCommit={() => {}} />);
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

  it('updates when initialValue prop changes', () => {
    const { rerender } = render(<EvaluatedInput initialValue="1" onCommit={() => {}} />);
    rerender(<EvaluatedInput initialValue="2" onCommit={() => {}} />);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('calls onCommit with computed expression on Enter', async () => {
    const onCommit = jest.fn();
    render(<EvaluatedInput initialValue="" onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, '2 + 3{Enter}');

    expect(onCommit).toHaveBeenCalledWith('5');
  });

  it('calls onCommit with raw text on Enter if expression is invalid', async () => {
    const onCommit = jest.fn();
    render(<EvaluatedInput initialValue="" onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, 'hello{Enter}');

    expect(onCommit).toHaveBeenCalledWith('hello');
  });

  it('calls onCommit on blur', () => {
    const onCommit = jest.fn();
    render(<EvaluatedInput initialValue="10" onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith('10');
  });

  it('calls onCancel and resets value on Escape', async () => {
    const onCancel = jest.fn();
    render(<EvaluatedInput initialValue="initial" onCommit={() => {}} onCancel={onCancel} />);
    const input = screen.getByRole('textbox');

    await userEvent.clear(input);
    await userEvent.type(input, 'changed{Escape}');

    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByDisplayValue('initial')).toBeInTheDocument();
  });
});
```

---

## Общие рекомендации

1. **Заглушки API:** Для тестов компонентов, которые вызывают API, используй моки:
   ```ts
   jest.mock('../../services/api');
   ```

2. **Provider wrapper:** Для тестов компонентов, использующих контексты, создавай хелпер:
   ```tsx
   const renderWithProviders = (ui: React.ReactElement) => {
     return render(
       <ThemeProvider>
         <BrowserRouter>{ui}</BrowserRouter>
       </ThemeProvider>
     );
   };
   ```

3. **Рендер хуков:** Используй `renderHook` из `@testing-library/react`.

4. **`data-testid`:** Если нужно найти элемент по тесту — добавь `data-testid` в компонент.
