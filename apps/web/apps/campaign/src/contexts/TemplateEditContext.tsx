// contexts/TemplateEditContext.tsx
import React, { createContext, ReactNode } from 'react';

export interface TemplateEditContextType {
  editMode: boolean;
  onAddField?: (parentCategoryKey?: string) => void;
  onAddCategory?: (parentCategoryKey?: string) => void;
  onDeleteField?: (fieldKey: string) => void;
  onDeleteCategory?: (categoryKey: string) => void;
  onEditField?: (fieldKey: string) => void;
  onChangeFieldType?: (fieldKey: string) => void;
  onEditCategory?: (categoryKey: string) => void;
  onMoveFieldToCategory?: (fieldKey: string, targetCategoryKey: string) => void;
}

export const TemplateEditContext = createContext<TemplateEditContextType | null>(null);

interface TemplateEditProviderProps {
  children: ReactNode;
  value: TemplateEditContextType;
}

export const TemplateEditProvider: React.FC<TemplateEditProviderProps> = ({ children, value }) => {
  return (
    <TemplateEditContext.Provider value={value}>
      {children}
    </TemplateEditContext.Provider>
  );
};