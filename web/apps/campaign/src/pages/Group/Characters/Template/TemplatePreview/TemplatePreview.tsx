// components/Preview/TemplatePreview.tsx
import React, { useContext } from 'react';
import { CharacterTemplate } from '../../../../../types/characterTemplates';
import { templateToCharacter } from '../../../../../utils/templateUtils';
import CharacterTableView from '../../CharacterTableView/CharacterTableView';
import { TemplateSchema } from '../../../../../types/groupSchemas';
import { TemplateEditContext } from '../../../../../contexts/TemplateEditContext';
import { CategoryData } from '../../../../../utils/characterFields';
import { MenuItem } from '@tdn/shared/ui/DropdownMenu/DropdownMenu';

interface TemplatePreviewProps {
  template: CharacterTemplate;
  schema: TemplateSchema;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ 
  template, 
  schema,
}) => {
  const templateEditContext = useContext(TemplateEditContext);
  const editMode = templateEditContext?.editMode || false;
  const character = templateToCharacter(template);

  // Функция для создания меню категорий в режиме редактирования шаблона
  const getCategoryMenuItems = (category: CategoryData): MenuItem[] => {
    if (!editMode || category.key === 'other') return [];
    
    const items: MenuItem[] = [];
    
    if (templateEditContext?.onAddCategory) {
      items.push({
        label: 'Добавить категорию',
        onClick: () => templateEditContext.onAddCategory?.(category.key),
      });
    }
    
    if (templateEditContext?.onAddField) {
      items.push({
        label: 'Добавить поле',
        onClick: () => templateEditContext.onAddField?.(category.key),
      });
    }
    
    if (templateEditContext?.onEditCategory) {
      items.push({
        label: 'Редактировать категорию',
        onClick: () => templateEditContext.onEditCategory?.(category.key),
      });
    }
    
    if (templateEditContext?.onDeleteCategory) {
      items.push({
        label: 'Удалить категорию',
        onClick: () => templateEditContext.onDeleteCategory?.(category.key),
        variant: 'danger'
      });
    }
    
    return items;
  };

  return (
    <div>
      <CharacterTableView
        character={character}
        template={template}
        schema={schema}
        canEdit={false}
        onUpdateFieldValue={() => {}}
        getCategoryMenuItems={getCategoryMenuItems}
      />
    </div>
  );
};

export default TemplatePreview;