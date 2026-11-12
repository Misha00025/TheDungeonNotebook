import React, { createContext, useContext } from 'react';
import { DashboardSettings } from '../types/dashboardSettings';

export interface DashboardSettingsContextType {
  settings: DashboardSettings;
  baseResourceFields: string[];
  toggleField: (fieldKey: string) => void;
  toggleItem: (itemId: number) => void;
  toggleEquipped: (itemId: number) => Promise<void>;
  togglePinnedSkill: (skillId: number) => void;
  saveEquippedOrder: (itemIds: number[]) => Promise<void>;
  isFieldOnDashboard: (fieldKey: string) => boolean;
  isItemResource: (itemId: number) => boolean;
  isItemEquipped: (itemId: number) => boolean;
  isSkillPinned: (skillId: number) => boolean;
}

export const DashboardSettingsContext = createContext<DashboardSettingsContextType | null>(null);

export const useDashboardSettingsContext = () => {
  const ctx = useContext(DashboardSettingsContext);
  if (!ctx) {
    throw new Error('useDashboardSettingsContext must be used within DashboardSettingsProvider');
  }
  return ctx;
};

interface DashboardSettingsProviderProps {
  children: React.ReactNode;
  value: DashboardSettingsContextType;
}

export const DashboardSettingsProvider: React.FC<DashboardSettingsProviderProps> = ({ children, value }) => {
  return (
    <DashboardSettingsContext.Provider value={value}>
      {children}
    </DashboardSettingsContext.Provider>
  );
};
