import React from 'react';
import type { Mock, Mocked } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PermissionsProvider, usePermissions } from './PermissionsContext';

vi.mock('@tdn/shared/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./GroupUsersContext', () => ({
  useGroupUsers: vi.fn(),
}));

import { useAuth } from '@tdn/shared/auth/AuthContext';
import { useGroupUsers } from './GroupUsersContext';

const defaultMock = {
  groupUsers: [],
  groupUsersLoading: false,
  characterUsers: {} as Record<number, any[]>,
  ensureGroupUsers: vi.fn(),
  ensureCharacterUsers: vi.fn(),
  refreshGroupUsers: vi.fn(),
  refreshCharacterUsers: vi.fn(),
  invalidateGroupUsers: vi.fn(),
  invalidateCharacterUsers: vi.fn(),
  error: null,
};

const TestConsumer: React.FC = () => {
  const { isGroupAdmin, canEditCharacter, canDeleteCharacter, loading } = usePermissions();
  if (loading) return <div data-testid="loading">loading</div>;
  return (
    <div>
      <span data-testid="isGroupAdmin">{String(isGroupAdmin)}</span>
      <span data-testid="canEditCharacter">{String(canEditCharacter)}</span>
      <span data-testid="canDeleteCharacter">{String(canDeleteCharacter)}</span>
    </div>
  );
};

const renderAtPath = (
  path: string,
  groupUsers: any[] = [],
  characterUsers: Record<number, any[]> = {}
) => {
  (useGroupUsers as Mock).mockReturnValue({
    ...defaultMock,
    groupUsers,
    characterUsers,
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PermissionsProvider>
        <TestConsumer />
      </PermissionsProvider>
    </MemoryRouter>
  );
};

describe('PermissionsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (useAuth as Mock).mockReturnValue({ accessToken: 'token' });
    localStorage.setItem('userId', '1');
    (useGroupUsers as Mock).mockReturnValue(defaultMock);
  });

  it('устанавливает isGroupAdmin когда пользователь admin группы', async () => {
    renderAtPath('/groups/5', [
      { user: { id: 1, nickname: 'me' }, isAdmin: true },
    ]);

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('true');
    });
  });

  it('isGroupAdmin=false когда пользователь не admin', async () => {
    renderAtPath('/groups/5', [
      { user: { id: 1, nickname: 'me' }, isAdmin: false },
    ]);

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('false');
    });
  });

  it('устанавливает canEditCharacter когда пользователь canWrite', async () => {
    renderAtPath(
      '/groups/5/character/10',
      [{ user: { id: 1, nickname: 'me' }, isAdmin: false }],
      { 10: [{ user: { id: 1 }, canWrite: true }] }
    );

    await waitFor(() => {
      expect(screen.getByTestId('canEditCharacter').textContent).toBe('true');
    });
  });

  it('canEditCharacter=false когда canWrite=false', async () => {
    renderAtPath(
      '/groups/5/character/10',
      [{ user: { id: 1, nickname: 'me' }, isAdmin: false }],
      { 10: [{ user: { id: 1 }, canWrite: false }] }
    );

    await waitFor(() => {
      expect(screen.getByTestId('canEditCharacter').textContent).toBe('false');
    });
  });

  it('canDeleteCharacter=true когда пользователь admin группы', async () => {
    renderAtPath(
      '/groups/5/character/10',
      [{ user: { id: 1, nickname: 'me' }, isAdmin: true }],
      { 10: [{ user: { id: 1 }, canWrite: true }] }
    );

    await waitFor(() => {
      expect(screen.getByTestId('canDeleteCharacter').textContent).toBe('true');
    });
  });

  it('при отсутствии accessToken все права false', async () => {
    (useAuth as Mock).mockReturnValue({ accessToken: null });

    renderAtPath('/groups/5');

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('false');
      expect(screen.getByTestId('canDeleteCharacter').textContent).toBe('false');
    });
  });

  it('при пути без group все права false', async () => {
    renderAtPath('/');

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('false');
    });
  });

  it('при пустых данных права false', async () => {
    renderAtPath('/groups/5', [], {});

    await waitFor(() => {
      expect(screen.getByTestId('isGroupAdmin').textContent).toBe('false');
    });
  });
});
