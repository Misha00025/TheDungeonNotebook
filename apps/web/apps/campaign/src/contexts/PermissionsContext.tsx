import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@tdn/shared/auth/AuthContext';
import { useLocation } from 'react-router-dom';
import { getGroupAndCharacterIds } from '../utils/getGroupAndCharacterIds';
import { useGroupUsers } from './GroupUsersContext';

interface PermissionsContextType {
  isGroupAdmin: boolean;
  canEditCharacter: boolean;
  canDeleteCharacter: boolean;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authenticated, userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const { groupId, characterId } = getGroupAndCharacterIds(location.pathname);
  const { groupUsers, characterUsers, groupUsersLoading, ensureGroupUsers, ensureCharacterUsers } = useGroupUsers();

  const currentUserId = userId ?? 0;
  const isGroupAdmin = authenticated && userId !== null && groupUsers.some(u => u.user.id === currentUserId && u.isAdmin);
  const charUsers = characterId ? characterUsers[characterId] : undefined;
  const currentCharUser = charUsers?.find(u => u.user.id === currentUserId);
  const canEditCharacter = authenticated && userId !== null && (currentCharUser?.canWrite ?? false);
  const canDeleteCharacter = isGroupAdmin;

  useEffect(() => {
    if (!authenticated || userId === null || !groupId) {
      setLoading(false);
    } else if (groupUsers.length > 0 || !groupUsersLoading) {
      setLoading(false);
    }
  }, [authenticated, userId, groupId, groupUsers, groupUsersLoading]);

  useEffect(() => {
    if (authenticated && userId !== null && groupId) {
      ensureGroupUsers();
    }
    if (authenticated && userId !== null && characterId) {
      ensureCharacterUsers(characterId);
    }
  }, [authenticated, userId, groupId, characterId]);

  return (
    <PermissionsContext.Provider value={{
      isGroupAdmin,
      canEditCharacter,
      canDeleteCharacter,
      loading
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
