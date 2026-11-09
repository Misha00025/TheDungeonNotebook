# План тестирования: модули с серверными вызовами

## Общий подход

### Моки

Для всех модулей используется `jest.mock()` и `jest.fn()`, встроенные в CRA.

```ts
jest.mock('../../services/api', () => ({
  groupAPI: {
    getCharacterResources: jest.fn(),
  },
}));
```

После мока импортируешь тот же модуль для настройки ответов:

```ts
import { groupAPI } from '../../services/api';
(groupAPI.getCharacterResources as jest.Mock).mockResolvedValue(['hp', 'mp']);
```

### Очистка

```ts
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});
```

### Асинхронные хуки

Для хуков с загрузкой на mount — `waitFor` или `act + flush`:

```ts
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(result.current.loading).toBe(false);
});
```

### Мок глобального fetch

Для `tokenManager` и `makeAuthenticatedRequest`:

```ts
global.fetch = jest.fn();
```

---

## 1. `src/services/tokenManager.ts`

**Зависимости:** `localStorage`, `global.fetch`

### Тест-кейсы

| # | Сценарий | Действие | Ожидание |
|---|----------|----------|----------|
| 1 | Начальное состояние | — | `getAccessToken()` === `null` |
| 2 | `setTokens` записывает access в память, refresh в localStorage | `setTokens('abc', 'refresh123')` | access в памяти, localStorage.getItem('refreshToken') === 'refresh123' |
| 3 | `ensureToken` возвращает access если он есть в памяти | после `setTokens` | `ensureToken()` резолвится в 'abc' |
| 4 | `ensureToken` пробует refresh если access пуст | `invalidateAccessToken()` + refreshToken в localStorage | Делает fetch на `/auth/token`, возвращает новый access |
| 5 | `ensureToken` возвращает null если refresh тоже пуст | `clear()` | `ensureToken()` === `null` |
| 6 | `ensureToken` deduplicates параллельные refresh | Два параллельных вызова `ensureToken()` | Один fetch |
| 7 | `invalidateAccessToken` сбрасывает только память | — | access === null, refreshToken в localStorage сохранён |
| 8 | `clear` сбрасывает всё | — | access === null, localStorage.removeItem |

### Пример кода

```ts
// src/services/tokenManager.test.ts
import tokenManager from './tokenManager';

describe('tokenManager', () => {
  const mockFetch = jest.fn();

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    tokenManager.clear();
  });

  afterAll(() => {
    delete (global as any).fetch;
  });

  it('starts with no access token', () => {
    expect(tokenManager.getAccessToken()).toBeNull();
  });

  it('setTokens stores access in memory and refresh in localStorage', () => {
    tokenManager.setTokens('abc', 'refresh123');
    expect(tokenManager.getAccessToken()).toBe('abc');
    expect(localStorage.getItem('refreshToken')).toBe('refresh123');
  });

  it('ensureToken returns existing access token from memory', async () => {
    tokenManager.setTokens('existing', 'r');
    const token = await tokenManager.ensureToken();
    expect(token).toBe('existing');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ensureToken refreshes token when access is null but refresh exists', async () => {
    localStorage.setItem('refreshToken', 'old-refresh');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh' }),
    });

    const token = await tokenManager.ensureToken();
    expect(token).toBe('new-access');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
  });

  it('ensureToken returns null when no refresh token exists', async () => {
    const token = await tokenManager.ensureToken();
    expect(token).toBeNull();
  });

  it('ensureToken deduplicates parallel refresh calls', async () => {
    localStorage.setItem('refreshToken', 'r');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'deduped', refresh_token: 'r2' }),
    });

    const [t1, t2] = await Promise.all([
      tokenManager.ensureToken(),
      tokenManager.ensureToken(),
    ]);

    expect(t1).toBe('deduped');
    expect(t2).toBe('deduped');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('invalidateAccessToken clears memory but keeps refresh token', () => {
    tokenManager.setTokens('abc', 'refresh123');
    tokenManager.invalidateAccessToken();
    expect(tokenManager.getAccessToken()).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBe('refresh123');
  });

  it('clear removes everything', () => {
    tokenManager.setTokens('abc', 'refresh123');
    tokenManager.clear();
    expect(tokenManager.getAccessToken()).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('ensureToken handles fetch failure gracefully', async () => {
    localStorage.setItem('refreshToken', 'bad-refresh');
    mockFetch.mockResolvedValueOnce({ ok: false });

    const token = await tokenManager.ensureToken();
    expect(token).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
```

---

## 2. `src/services/api.ts` — `makeAuthenticatedRequest`

**Зависимости:** `tokenManager`, `global.fetch`

### Что тестировать

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Успешный запрос | Возвращает Response |
| 2 | Запрос с 401 → успешный рефреш → retry | После первого 401 делает refresh, повторяет запрос |
| 3 | 401 + refresh не удался | Бросает 'Session expired' |
| 4 | Разные `contentType` | `null` — без Content-Type header |
| 5 | Передача дополнительных headers | Смерживаются с Authorization |

### Ключевая техника — мок модуля внутри

```ts
// Мокаем tokenManager на уровне модуля
jest.mock('./tokenManager', () => ({
  __esModule: true,
  default: {
    ensureToken: jest.fn(),
    invalidateAccessToken: jest.fn(),
    clear: jest.fn(),
  },
}));

import tokenManager from './tokenManager';
```

### Пример кода

```ts
// src/services/makeAuthenticatedRequest.test.ts
// Файл нужно создать рядом с api.ts

import { makeAuthenticatedRequest } from './api';

jest.mock('./tokenManager', () => ({
  __esModule: true,
  default: {
    ensureToken: jest.fn(),
    invalidateAccessToken: jest.fn(),
    clear: jest.fn(),
  },
}));

import tokenManager from './tokenManager';

describe('makeAuthenticatedRequest', () => {
  const mockFetch = jest.fn();
  let mockWindowLocation: Location;

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowLocation = window.location;
    delete (window as any).location;
    (window as any).location = { reload: jest.fn() };
  });

  afterAll(() => {
    delete (global as any).fetch;
    window.location = mockWindowLocation;
  });

  it('adds Bearer token to request', async () => {
    (tokenManager.ensureToken as jest.Mock).mockResolvedValue('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await makeAuthenticatedRequest('/test');
    const calledUrl = mockFetch.mock.calls[0][0];
    const calledHeaders = mockFetch.mock.calls[0][1].headers;

    expect(calledUrl).toContain('/test');
    expect(calledHeaders['Authorization']).toBe('Bearer my-token');
  });

  it('retries after refresh on 401', async () => {
    (tokenManager.ensureToken as jest.Mock)
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('new-token');

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    await makeAuthenticatedRequest('/test');
    expect(tokenManager.invalidateAccessToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws when refresh fails after 401', async () => {
    (tokenManager.ensureToken as jest.Mock)
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce(null);

    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(makeAuthenticatedRequest('/test')).rejects.toThrow('Session expired');
    expect(tokenManager.clear).toHaveBeenCalled();
  });

  it('throws when ensureToken returns null initially', async () => {
    (tokenManager.ensureToken as jest.Mock).mockResolvedValue(null);

    await expect(makeAuthenticatedRequest('/test')).rejects.toThrow('Session expired');
  });

  it('sends request without Content-Type when contentType is null', async () => {
    (tokenManager.ensureToken as jest.Mock).mockResolvedValue('token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await makeAuthenticatedRequest('/upload', { method: 'POST' }, null);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBeUndefined();
  });
});
```

---

## 3. `src/hooks/useDashboardSettings.ts`

**Зависимости:** `groupAPI.getCharacterResources`, `characterEquipmentAPI.getEquipment`, `localStorage`

### Тест-кейсы

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Загрузка: сервер возвращает ресурсы и экипировку | `baseResourceFields`, `settings.fields` мержатся, `settings.equipped` с сервера |
| 2 | Загрузка: есть сохранённые локальные настройки | Мерж серверных + локальных полей, локальные дубликаты отфильтрованы |
| 3 | Загрузка: ошибка API ресурсов | `baseResourceFields` === [], остальное работает |
| 4 | `toggleField` — добавляет/убирает поле | `settings.fields` обновляется, запись в localStorage |
| 5 | `toggleItem` — добавляет/убирает ID предмета | `settings.items` обновляется |
| 6 | `toggleEquipped` — вызывает patchEquipment, обновляет список | `settings.equipped` обновляется |
| 7 | `togglePinnedSkill` — добавляет/убирает ID скилла | `settings.pinnedSkills` обновляется |
| 8 | `saveEquippedOrder` — вызывает putEquipment, обновляет | `settings.equipped` с ответа сервера |
| 9 | Селекторы: `isFieldOnDashboard`, `isItemResource`, `isItemEquipped`, `isSkillPinned` | Возвращают boolean |
| 10 | Провал `toggleEquipped` / `saveEquippedOrder` | Ошибка логируется, состояние не меняется |

### Пример кода

```ts
// src/hooks/useDashboardSettings.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDashboardSettings } from './useDashboardSettings';

jest.mock('../services/api', () => ({
  groupAPI: {
    getCharacterResources: jest.fn(),
  },
  characterEquipmentAPI: {
    getEquipment: jest.fn(),
    patchEquipment: jest.fn(),
    putEquipment: jest.fn(),
  },
}));

import { groupAPI, characterEquipmentAPI } from '../services/api';

const mockGroupAPI = groupAPI as jest.Mocked<typeof groupAPI>;
const mockEquipmentAPI = characterEquipmentAPI as jest.Mocked<typeof characterEquipmentAPI>;

describe('useDashboardSettings', () => {
  const groupId = 1;
  const characterId = 42;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('загружает ресурсы с сервера и экипировку', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue(['hp', 'mp']);
    mockEquipmentAPI.getEquipment.mockResolvedValue([10, 20]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.baseResourceFields).toEqual(['hp', 'mp']);
    expect(result.current.settings.fields).toContain('hp');
    expect(result.current.settings.fields).toContain('mp');
    expect(result.current.settings.equipped).toEqual([10, 20]);
  });

  it('мержит серверные поля с локальными настройками из localStorage', async () => {
    localStorage.setItem(
      `character_dashboard_${groupId}_${characterId}`,
      JSON.stringify({ fields: ['luck'], items: [5], equipped: [], pinnedSkills: [] })
    );

    mockGroupAPI.getCharacterResources.mockResolvedValue(['hp']);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 'hp' с сервера + 'luck' из localStorage
    expect(result.current.settings.fields).toContain('hp');
    expect(result.current.settings.fields).toContain('luck');
  });

  it('toggleField добавляет и убирает поле', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleField('mana'));
    expect(result.current.settings.fields).toContain('mana');

    act(() => result.current.toggleField('mana'));
    expect(result.current.settings.fields).not.toContain('mana');
  });

  it('toggleEquipped вызывает patchEquipment и обновляет equipped', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);
    mockEquipmentAPI.patchEquipment.mockResolvedValue([1, 2, 3]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleEquipped(1);
    });

    expect(mockEquipmentAPI.patchEquipment).toHaveBeenCalledWith(groupId, characterId, 'add', 1);
    expect(result.current.settings.equipped).toEqual([1, 2, 3]);
  });

  it('togglePinnedSkill добавляет и убирает скилл', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue([]);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.togglePinnedSkill(99));
    expect(result.current.settings.pinnedSkills).toContain(99);

    act(() => result.current.togglePinnedSkill(99));
    expect(result.current.settings.pinnedSkills).not.toContain(99);
  });

  it('isFieldOnDashboard возвращает корректный boolean', async () => {
    mockGroupAPI.getCharacterResources.mockResolvedValue(['hp']);
    mockEquipmentAPI.getEquipment.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardSettings(groupId, characterId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFieldOnDashboard('hp')).toBe(true);
    expect(result.current.isFieldOnDashboard('mana')).toBe(false);
  });
});
```

---

## 4. `src/hooks/useProfile.ts`

**Зависимости:** `makeAuthenticatedRequest`

### Тест-кейсы

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Успешная загрузка: whoami + profile | `profile` заполнен, `loading: false`, `profileNotFound: false` |
| 2 | whoami 401 | `error: 'Session expired...'` |
| 3 | profile 404 | `profileNotFound: true`, `profile: null` |
| 4 | profile 401 | `error: 'Session expired...'` |
| 5 | Вызов `fetchProfile` вручную | Повторный запрос, стейт обновляется |
| 6 | `fetchOnMount: true` | fetchProfile вызывается на mount |
| 7 | `fetchOnMount: false` | fetchProfile НЕ вызывается на mount |

### Пример кода

```ts
// src/hooks/useProfile.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProfile } from './useProfile';

jest.mock('../services/api', () => ({
  makeAuthenticatedRequest: jest.fn(),
}));

import { makeAuthenticatedRequest } from '../services/api';

const createMockResponse = (status: number, body: Record<string, unknown>) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

describe('useProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('загружает профиль через whoami + /users/:id', async () => {
    (makeAuthenticatedRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(200, { id: 5 }))
      .mockResolvedValueOnce(createMockResponse(200, {
        id: 5, nickname: 'test', visibleName: 'Test', imageLink: null,
      }));

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.profileNotFound).toBe(false);
    expect(result.current.profile).toEqual(
      expect.objectContaining({ nickname: 'test', visibleName: 'Test' })
    );
  });

  it('устанавливает profileNotFound при 404 на /users/:id', async () => {
    (makeAuthenticatedRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(200, { id: 5 }))
      .mockResolvedValueOnce(createMockResponse(404, {}));

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.profileNotFound).toBe(true);
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('устанавливает ошибку при 401 от whoami', async () => {
    (makeAuthenticatedRequest as jest.Mock).mockResolvedValueOnce(
      createMockResponse(401, {})
    );

    const { result } = renderHook(() => useProfile());

    await act(async () => {
      await result.current.fetchProfile();
    });

    expect(result.current.error).toContain('Session expired');
    expect(result.current.profile).toBeNull();
  });

  it('вызывает fetchProfile на mount при fetchOnMount: true', async () => {
    (makeAuthenticatedRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(200, { id: 1 }))
      .mockResolvedValueOnce(createMockResponse(200, { id: 1, nickname: 'auto', visibleName: 'Auto', imageLink: null }));

    const { result } = renderHook(() => useProfile(true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(makeAuthenticatedRequest).toHaveBeenCalledTimes(2);
    expect(result.current.profile?.nickname).toBe('auto');
  });

  it('НЕ вызывает fetchProfile на mount при fetchOnMount: false', () => {
    renderHook(() => useProfile(false));
    expect(makeAuthenticatedRequest).not.toHaveBeenCalled();
  });
});
```

---

## 5. `src/contexts/AuthContext.tsx`

**Зависимости:** `authAPI`, `makeAuthenticatedRequest`, `tokenManager`, `localStorage`

### Тест-кейсы

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | init: нет токена → initializing=false, userId=null | Рендерит children |
| 2 | init: есть токен, whoami успешен → userId установлен | userId = whoami.id |
| 3 | init: есть токен, whoami ошибка → токен очищен | userId=null, tokenManager.clear вызван |
| 4 | `login` успешен → токены сохранены, userId установлен | userId = whoami.id |
| 5 | `login` ошибка → проброс ошибки | throw Error |
| 6 | `register` успешен → то же что login | — |
| 7 | `logout` → userId=null, tokenManager.clear | — |
| 8 | `accessToken` через context | tokenManager.getAccessToken() |

### Пример кода

```ts
// src/contexts/AuthContext.test.tsx
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../services/api', () => ({
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
  },
  makeAuthenticatedRequest: jest.fn(),
}));

jest.mock('../services/tokenManager', () => ({
  __esModule: true,
  default: {
    ensureToken: jest.fn(),
    setTokens: jest.fn(),
    getAccessToken: jest.fn(),
    clear: jest.fn(),
  },
}));

import { authAPI, makeAuthenticatedRequest } from '../services/api';
import tokenManager from '../services/tokenManager';

const createMockResponse = (status: number, body: Record<string, unknown>) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

const TestConsumer: React.FC = () => {
  const { accessToken, userId, login, register, logout } = useAuth();
  return (
    <div>
      <span data-testid="token">{accessToken ?? 'null'}</span>
      <span data-testid="userId">{userId ?? 'null'}</span>
      <button data-testid="login" onClick={() => login('u', 'p')}>login</button>
      <button data-testid="register" onClick={() => register('u', 'p')}>register</button>
      <button data-testid="logout" onClick={logout}>logout</button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('инициализируется без userId когда нет токена', async () => {
    (tokenManager.ensureToken as jest.Mock).mockResolvedValue(null);

    const { rerender } = renderProvider();
    // initializing — рендерит null, ждём пока пройдёт
    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });
  });

  it('инициализирует userId через whoami когда токен есть', async () => {
    (tokenManager.ensureToken as jest.Mock).mockResolvedValue('valid-token');
    (makeAuthenticatedRequest as jest.Mock).mockResolvedValueOnce(
      createMockResponse(200, { id: 7 })
    );
    (tokenManager.getAccessToken as jest.Mock).mockReturnValue('valid-token');

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('7');
    });
  });

  it('очищает токен при ошибке whoami', async () => {
    (tokenManager.ensureToken as jest.Mock).mockResolvedValue('bad-token');
    (makeAuthenticatedRequest as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    renderProvider();

    await waitFor(() => {
      expect(tokenManager.clear).toHaveBeenCalled();
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });
  });

  it('login вызывает authAPI.login и whoami', async () => {
    (tokenManager.ensureToken as jest.Mock).mockResolvedValue(null);
    (authAPI.login as jest.Mock).mockResolvedValue({
      access_token: 'login-token',
      refresh_token: 'login-refresh',
    });
    (makeAuthenticatedRequest as jest.Mock).mockResolvedValueOnce(
      createMockResponse(200, { id: 10 })
    );

    renderProvider();

    await act(async () => {
      screen.getByTestId('login').click();
    });

    expect(tokenManager.setTokens).toHaveBeenCalledWith('login-token', 'login-refresh');
    expect(screen.getByTestId('userId').textContent).toBe('10');
  });

  it('logout очищает userId и токены', async () => {
    (tokenManager.ensureToken as jest.Mock).mockResolvedValue(null);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });

    act(() => {
      screen.getByTestId('logout').click();
    });

    expect(tokenManager.clear).toHaveBeenCalled();
    expect(screen.getByTestId('userId').textContent).toBe('null');
  });
});
```

---

## 6. `src/contexts/PermissionsContext.tsx`

**Зависимости:** `useAuth`, `useLocation`, `groupUsersAPI`, `characterUsersAPI`, `localStorage`

### Тест-кейсы

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Нет accessToken → loading=false, все false | — |
| 2 | Путь без group → loading=false, все false | — |
| 3 | Пользователь — admin группы | `isGroupAdmin: true` |
| 4 | Пользователь — не admin | `isGroupAdmin: false` |
| 5 | Путь содержит characterId, пользователь canWrite | `canEditCharacter: true` |
| 6 | Путь содержит characterId, пользователь без canWrite | `canEditCharacter: false` |
| 7 | Ошибка API → loading=false, пермишены false | — |

### Ключевая техника — мок useParams + useLocation

Мокаем react-router-dom на уровне модуля:

```ts
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn(),
  useParams: jest.fn(),
}));
```

Мокаем `useAuth` через путь импорта (нужно смотреть как импортируется — через `../contexts/AuthContext` или напрямую).

Для PermissionsContext проще всего вынести проверку в хелпер и не мокать роутер, а использовать `MemoryRouter` с нужным path.

### Пример кода

```ts
// src/contexts/PermissionsContext.test.tsx
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PermissionsProvider, usePermissions } from './PermissionsContext';

jest.mock('./AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../services/api', () => ({
  groupUsersAPI: {
    getGroupUsers: jest.fn(),
  },
  characterUsersAPI: {
    getCharacterUsers: jest.fn(),
  },
}));

import { useAuth } from './AuthContext';
import { groupUsersAPI, characterUsersAPI } from '../services/api';

const TestConsumer: React.FC = () => {
  const { isGroupAdmin, canEditCharacter, canDeleteCharacter, loading } = usePermissions();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <span data-testid="isGroupAdmin">{String(isGroupAdmin)}</span>
      <span data-testid="canEditCharacter">{String(canEditCharacter)}</span>
      <span data-testid="canDeleteCharacter">{String(canDeleteCharacter)}</span>
    </div>
  );
};

const renderAtPath = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PermissionsProvider>
        <TestConsumer />
      </PermissionsProvider>
    </MemoryRouter>
  );

describe('PermissionsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (useAuth as jest.Mock).mockReturnValue({ accessToken: 'token' });
    localStorage.setItem('userId', '1');
  });

  it('устанавливает isGroupAdmin когда пользователь admin группы', async () => {
    (groupUsersAPI.getGroupUsers as jest.Mock).mockResolvedValue([
      { user: { id: 1, nickname: 'me' }, isAdmin: true },
    ]);

    renderAtPath('/group/5');

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('true');
    });
  });

  it('устанавливает canEditCharacter когда пользователь canWrite', async () => {
    (groupUsersAPI.getGroupUsers as jest.Mock).mockResolvedValue([
      { user: { id: 1, nickname: 'me' }, isAdmin: false },
    ]);
    (characterUsersAPI.getCharacterUsers as jest.Mock).mockResolvedValue([
      { user: { id: 1 }, canWrite: true },
    ]);

    renderAtPath('/group/5/character/10');

    await waitFor(() => {
      expect(screen.getByTestId('canEditCharacter').textContent).toBe('true');
    });
  });

  it('при отсутствии accessToken все права false', async () => {
    (useAuth as jest.Mock).mockReturnValue({ accessToken: null });

    renderAtPath('/group/5');

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('false');
      expect(screen.getByTestId('canEditCharacter').textContent).toBe('false');
    });
  });

  it('при ошибке API права сбрасываются в false', async () => {
    (groupUsersAPI.getGroupUsers as jest.Mock).mockRejectedValue(new Error('API error'));

    renderAtPath('/group/5');

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('false');
    });
  });

  it('обновляется при смене location', async () => {
    (groupUsersAPI.getGroupUsers as jest.Mock).mockResolvedValue([
      { user: { id: 1, nickname: 'me' }, isAdmin: true },
    ]);

    const { rerender } = render(
      <MemoryRouter initialEntries={['/group/5']}>
        <PermissionsProvider>
          <TestConsumer />
        </PermissionsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('true');
    });
  });
});
```

---

## 7. `src/hooks/useActionPermissions.ts`

**Зависимости:** `usePermissions` из `PermissionsContext`

Этот хук — чистая проекция полей `usePermissions` + `isGroupAdmin`. Тестируется просто через мок контекста, без роутера и API.

### Тест-кейсы

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | isGroupAdmin=true → canEdit=true, canDelete=true | Все права true |
| 2 | isGroupAdmin=false, canEditCharacter=false → canEditThisCharacter=false | canEditThisCharacter=false |
| 3 | isGroupAdmin=false, canEditCharacter=true → canEditThisCharacter=true | canEditThisCharacter=true |
| 4 | isGroupAdmin=true — всё перекрывает | canEditThisCharacter=true, canManageCharacterUsers=true |

### Пример кода

```ts
// src/hooks/useActionPermissions.test.ts
import { renderHook } from '@testing-library/react';
import { useActionPermissions } from './useActionPermissions';

jest.mock('../contexts/PermissionsContext', () => ({
  usePermissions: jest.fn(),
}));

import { usePermissions } from '../contexts/PermissionsContext';

describe('useActionPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('даёт все права когда isGroupAdmin=true', () => {
    (usePermissions as jest.Mock).mockReturnValue({
      isGroupAdmin: true,
      canEditCharacter: false,
      canDeleteCharacter: false,
      loading: false,
    });

    const { result } = renderHook(() => useActionPermissions());

    expect(result.current.canEditGroup).toBe(true);
    expect(result.current.canDeleteGroup).toBe(true);
    expect(result.current.canManageGroupUsers).toBe(true);
    expect(result.current.canCreateTemplates).toBe(true);
    expect(result.current.canEditTemplates).toBe(true);
    expect(result.current.canDeleteTemplates).toBe(true);
    expect(result.current.canCreateItems).toBe(true);
    expect(result.current.canEditItems).toBe(true);
    expect(result.current.canDeleteItems).toBe(true);
    expect(result.current.canEditThisCharacter).toBe(true);
    expect(result.current.canDeleteThisCharacter).toBe(true);
    expect(result.current.canManageCharacterUsers).toBe(true);
    expect(result.current.canEditCharacterFields).toBe(true);
    expect(result.current.canDeleteCharacterFields).toBe(true);
  });

  it('canEditThisCharacter=true когда canEditCharacter=true (но не admin)', () => {
    (usePermissions as jest.Mock).mockReturnValue({
      isGroupAdmin: false,
      canEditCharacter: true,
      canDeleteCharacter: false,
      loading: false,
    });

    const { result } = renderHook(() => useActionPermissions());

    expect(result.current.canEditGroup).toBe(false);
    expect(result.current.canEditThisCharacter).toBe(true);
    expect(result.current.canDeleteThisCharacter).toBe(false);
    expect(result.current.canManageCharacterUsers).toBe(false);
  });

  it('canEditThisCharacter=false когда canEditCharacter=false и не admin', () => {
    (usePermissions as jest.Mock).mockReturnValue({
      isGroupAdmin: false,
      canEditCharacter: false,
      canDeleteCharacter: false,
      loading: false,
    });

    const { result } = renderHook(() => useActionPermissions());

    expect(result.current.canEditThisCharacter).toBe(false);
    expect(result.current.canEditCharacterFields).toBe(false);
    expect(result.current.canDeleteCharacterFields).toBe(false);
  });
});
```

---

## 8. `src/services/api.ts` — `authAPI`

Если нужно протестировать конкретные методы API (login, register, groupAPI.getGroups и т.д.) — мокается `global.fetch` напрямую.

### Пример для authAPI.login

```ts
// src/services/authAPI.test.ts
import { authAPI } from './api';

describe('authAPI.login', () => {
  const mockFetch = jest.fn();

  beforeAll(() => { global.fetch = mockFetch; });
  afterAll(() => { delete (global as any).fetch; });
  beforeEach(() => { jest.clearAllMocks(); });

  it('успешный логин возвращает TokenResponse', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'a', refresh_token: 'b' }),
    });

    const result = await authAPI.login({ username: 'u', password: 'p' });
    expect(result.access_token).toBe('a');
  });

  it('ошибка логина пробрасывает Error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error_description: 'Invalid credentials' }),
    });

    await expect(authAPI.login({ username: 'u', password: 'p' })).rejects.toThrow('Invalid credentials');
  });
});
```

---

## Итоговая таблица

| Модуль | Моки | Тест-кейсов |
|--------|------|------------|
| `tokenManager` | `global.fetch` | 8 |
| `makeAuthenticatedRequest` | `tokenManager` + `global.fetch` | 5 |
| `useDashboardSettings` | `groupAPI`, `characterEquipmentAPI` | 10 |
| `useProfile` | `makeAuthenticatedRequest` | 7 |
| `AuthContext` | `authAPI`, `makeAuthenticatedRequest`, `tokenManager` | 8 |
| `PermissionsContext` | `useAuth`, `groupUsersAPI`, `characterUsersAPI` | 7 |
| `useActionPermissions` | `usePermissions` | 4 |
| `authAPI` (login/register) | `global.fetch` | по 2-3 на метод |
