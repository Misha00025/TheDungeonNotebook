import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@uiw/react-md-editor', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('@tdn/shared/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RemoteAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    accessToken: 'mock-token',
    userId: 1,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@tdn/shared/auth/useProfile', () => ({
  useProfile: () => ({
    profile: null,
    loading: false,
    error: null,
    profileNotFound: false,
    fetchProfile: vi.fn(),
  }),
}));

vi.mock('./contexts/GroupContext', () => ({
  GroupProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroup: () => ({ selectedGroup: null, setSelectedGroup: vi.fn() }),
}));

vi.mock('./contexts/VisitedContext', () => ({
  VisitedProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useVisited: () => ({
    lastVisitedGroupId: null,
    lastVisitedCharacters: [],
    visitGroup: vi.fn(),
    visitCharacter: vi.fn(),
    clearVisited: vi.fn(),
  }),
}));

vi.mock('./contexts/PermissionsContext', () => ({
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermissions: () => ({
    isGroupAdmin: false,
    canEditCharacter: false,
    canDeleteCharacter: false,
    loading: false,
  }),
}));

vi.mock('./contexts/GroupUsersContext', () => ({
  GroupUsersProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupUsers: () => ({
    groupUsers: [],
    groupUsersLoading: false,
    characterUsers: {},
    error: null,
    ensureGroupUsers: vi.fn(),
    ensureCharacterUsers: vi.fn(),
    refreshGroupUsers: vi.fn(),
    refreshCharacterUsers: vi.fn(),
    invalidateGroupUsers: vi.fn(),
    invalidateCharacterUsers: vi.fn(),
  }),
}));

vi.mock('./contexts/DashboardSettingsContext', () => ({
  DashboardSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/TemplateEditContext', () => ({
  TemplateEditProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./pages/Groups', () => ({
  default: () => <div>Groups</div>,
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
