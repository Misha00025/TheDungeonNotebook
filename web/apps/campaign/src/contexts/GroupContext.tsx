import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Group } from '../types/group';
import { groupAPI } from '../services/api';
import { storage } from '@tdn/shared/utils/storage';
import { useAuth } from '@tdn/shared/auth/AuthContext';

interface GroupContextType {
  selectedGroup: Group | null;
  setSelectedGroup: (group: Group | null) => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const { accessToken } = useAuth();

  // Восстанавливаем выбранную группу из localStorage при загрузке
  useEffect(() => {
    if (!accessToken) return;

    const savedGroupId = storage.getSelectedGroupId();
    if (savedGroupId) {
      const fetchGroup = async () => {
        try {
          const group = await groupAPI.getGroup(parseInt(savedGroupId));
          setSelectedGroup(group);
        } catch (error) {
          console.error('Failed to restore group from storage:', error);
          storage.clearSelectedGroupId();
        }
      };
      
      fetchGroup();
    }
  }, [accessToken]);

  // Сохраняем ID группы в localStorage при изменении
  useEffect(() => {
    if (selectedGroup) {
      storage.setSelectedGroupId(selectedGroup.id.toString());
    } else {
      storage.clearSelectedGroupId();
    }
  }, [selectedGroup]);

  return (
    <GroupContext.Provider value={{ selectedGroup, setSelectedGroup }}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
};