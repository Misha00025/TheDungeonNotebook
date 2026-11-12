import { renderHook } from '@testing-library/react';
import type { Mock, Mocked } from 'vitest';
import { useActionPermissions } from './useActionPermissions';

vi.mock('../contexts/PermissionsContext', () => ({
  usePermissions: vi.fn(),
}));

import { usePermissions } from '../contexts/PermissionsContext';

describe('useActionPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('даёт все права когда isGroupAdmin=true', () => {
    (usePermissions as Mock).mockReturnValue({
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
    (usePermissions as Mock).mockReturnValue({
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
    (usePermissions as Mock).mockReturnValue({
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

  it('admin перекрывает canEditCharacter — можно удалять персонажа', () => {
    (usePermissions as Mock).mockReturnValue({
      isGroupAdmin: true,
      canEditCharacter: false,
      canDeleteCharacter: false,
      loading: false,
    });

    const { result } = renderHook(() => useActionPermissions());

    expect(result.current.canDeleteThisCharacter).toBe(true);
    expect(result.current.canEditCharacterFields).toBe(true);
  });
});
