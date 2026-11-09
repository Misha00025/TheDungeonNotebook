import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { useAuth } from '@tdn/shared/auth/AuthContext';
import { useLocation } from 'react-router-dom';
import { getGroupAndCharacterIds } from '../utils/getGroupAndCharacterIds';
import { groupUsersAPI, characterUsersAPI } from '../services/api';
import { GroupUser } from '../types/groupUsers';
import { CharacterUser } from '../types/characterUsers';

const USERS_TTL_MS = 300_000;

interface GroupUsersContextType {
  groupUsers: GroupUser[];
  groupUsersLoading: boolean;
  characterUsers: Record<number, CharacterUser[]>;
  error: string | null;
  ensureGroupUsers(): void;
  ensureCharacterUsers(characterId: number): void;
  refreshGroupUsers(): Promise<void>;
  refreshCharacterUsers(characterId: number): Promise<void>;
  invalidateGroupUsers(): void;
  invalidateCharacterUsers(characterId: number): void;
}

const GroupUsersContext = createContext<GroupUsersContextType | null>(null);

const GroupUsersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { accessToken } = useAuth();
  const location = useLocation();
  const { groupId } = getGroupAndCharacterIds(location.pathname);

  const [groupUsers, setGroupUsers] = useState<GroupUser[]>([]);
  const [groupUsersLoading, setGroupUsersLoading] = useState(false);
  const [characterUsers, setCharacterUsers] = useState<
    Record<number, CharacterUser[]>
  >({});
  const [groupUsersLoadedAt, setGroupUsersLoadedAt] = useState<number | null>(
    null,
  );
  const prevGroupIdRef = useRef<number | undefined>(undefined);

  const [characterUsersLoadedAt, setCharacterUsersLoadedAt] = useState<
    Record<number, number>
  >({});
  const [error, setError] = useState<string | null>(null);

  const isStale = (loadedAt: number | null): boolean => {
    if (!loadedAt) return true;
    return Date.now() - loadedAt > USERS_TTL_MS;
  };

  const loadGroupUsers = useCallback(async () => {
    if (!accessToken || !groupId) return;
    setGroupUsersLoading(true);
    try {
      const data = await groupUsersAPI.getGroupUsers(groupId);
      setGroupUsers(data);
      setGroupUsersLoadedAt(Date.now());
      setError(null);
    } catch (err) {
      console.error('Failed to load group users:', err);
    } finally {
      setGroupUsersLoading(false);
    }
  }, [accessToken, groupId]);

  const loadCharacterUsers = useCallback(
    async (characterId: number) => {
      if (!accessToken || !groupId) return;
      try {
        const data = await characterUsersAPI.getCharacterUsers(
          groupId,
          characterId,
        );
        setCharacterUsers((prev) => ({ ...prev, [characterId]: data }));
        setCharacterUsersLoadedAt((prev) => ({
          ...prev,
          [characterId]: Date.now(),
        }));
        setError(null);
      } catch (err) {
        console.error('Failed to load character users:', err);
      }
    },
    [accessToken, groupId],
  );

  const ensureGroupUsers = useCallback(() => {
    if (groupId && isStale(groupUsersLoadedAt)) {
      loadGroupUsers();
    }
  }, [groupId, groupUsersLoadedAt, loadGroupUsers]);

  const ensureCharacterUsers = useCallback(
    (characterId: number) => {
      if (isStale(characterUsersLoadedAt[characterId])) {
        loadCharacterUsers(characterId);
      }
    },
    [characterUsersLoadedAt, loadCharacterUsers],
  );

  const refreshGroupUsers = useCallback(async () => {
    await loadGroupUsers();
  }, [loadGroupUsers]);

  const refreshCharacterUsers = useCallback(
    async (characterId: number) => {
      await loadCharacterUsers(characterId);
    },
    [loadCharacterUsers],
  );

  const invalidateGroupUsers = useCallback(() => {
    setGroupUsersLoadedAt(null);
  }, []);

  const invalidateCharacterUsers = useCallback((characterId: number) => {
    setCharacterUsersLoadedAt((prev) => {
      const next = { ...prev };
      delete next[characterId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    if (prevGroupIdRef.current !== groupId) {
      // Группа сменилась (или первый вход) — сбрасываем кэш и грузим заново
      prevGroupIdRef.current = groupId;
      setGroupUsers([]);
      setGroupUsersLoadedAt(null);
      setCharacterUsers({});
      setCharacterUsersLoadedAt({});
      if (groupId) {
        loadGroupUsers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, accessToken]);

  const value = useMemo(
    () => ({
      groupUsers,
      groupUsersLoading,
      characterUsers,
      error,
      ensureGroupUsers,
      ensureCharacterUsers,
      refreshGroupUsers,
      refreshCharacterUsers,
      invalidateGroupUsers,
      invalidateCharacterUsers,
    }),
    [
      groupUsers,
      groupUsersLoading,
      characterUsers,
      error,
      ensureGroupUsers,
      ensureCharacterUsers,
      refreshGroupUsers,
      refreshCharacterUsers,
      invalidateGroupUsers,
      invalidateCharacterUsers,
    ],
  );

  return (
    <GroupUsersContext.Provider value={value}>
      {children}
    </GroupUsersContext.Provider>
  );
};

const useGroupUsers = (): GroupUsersContextType => {
  const ctx = useContext(GroupUsersContext);
  if (!ctx) {
    throw new Error(
      'useGroupUsers must be used within a GroupUsersProvider',
    );
  }
  return ctx;
};

export { GroupUsersProvider };
export { useGroupUsers };
