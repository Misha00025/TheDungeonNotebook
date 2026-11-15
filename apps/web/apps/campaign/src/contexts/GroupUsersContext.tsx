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
  const { authenticated, userId } = useAuth();
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
  const sessionKey = `${authenticated ? 'yes' : 'no'}:${userId ?? 'none'}:${groupId ?? 'none'}`;
  const activeSessionKey = useRef(sessionKey);
  activeSessionKey.current = sessionKey;
  const previousSessionKey = useRef<string | null>(null);

  const [characterUsersLoadedAt, setCharacterUsersLoadedAt] = useState<
    Record<number, number>
  >({});
  const [error, setError] = useState<string | null>(null);

  const isStale = (loadedAt: number | null): boolean => {
    if (!loadedAt) return true;
    return Date.now() - loadedAt > USERS_TTL_MS;
  };

  const loadGroupUsers = useCallback(async () => {
    if (!authenticated || userId === null || !groupId) return;
    const requestKey = sessionKey;
    setGroupUsersLoading(true);
    try {
      const data = await groupUsersAPI.getGroupUsers(groupId);
      if (requestKey !== activeSessionKey.current) return;
      setGroupUsers(data);
      setGroupUsersLoadedAt(Date.now());
      setError(null);
    } catch (err) {
      if (requestKey === activeSessionKey.current) console.error('Failed to load group users:', err);
    } finally {
      if (requestKey === activeSessionKey.current) setGroupUsersLoading(false);
    }
  }, [authenticated, userId, groupId, sessionKey]);

  const loadCharacterUsers = useCallback(
    async (characterId: number) => {
      if (!authenticated || userId === null || !groupId) return;
      const requestKey = sessionKey;
      try {
        const data = await characterUsersAPI.getCharacterUsers(
          groupId,
          characterId,
        );
        if (requestKey !== activeSessionKey.current) return;
        setCharacterUsers((prev) => ({ ...prev, [characterId]: data }));
        setCharacterUsersLoadedAt((prev) => ({
          ...prev,
          [characterId]: Date.now(),
        }));
        setError(null);
      } catch (err) {
        if (requestKey === activeSessionKey.current) console.error('Failed to load character users:', err);
      }
    },
    [authenticated, userId, groupId, sessionKey],
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
    if (previousSessionKey.current === sessionKey) return;
    previousSessionKey.current = sessionKey;
    setGroupUsers([]);
    setGroupUsersLoading(Boolean(authenticated && userId !== null && groupId));
    setGroupUsersLoadedAt(null);
    setCharacterUsers({});
    setCharacterUsersLoadedAt({});
    setError(null);
    if (authenticated && userId !== null && groupId) void loadGroupUsers();
  }, [sessionKey, groupId, authenticated, userId, loadGroupUsers]);

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
