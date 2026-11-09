// components/Views/CharacterTableView/CharacterTableView.tsx
import React, { useState } from 'react';
import { Character } from '../../../../types/characters';
import { CharacterTemplate } from '../../../../types/characterTemplates';
import { categorizeCharacterFields, CategoryData } from '../../../../utils/characterFields';
import CategoryTable from '../Cards/CategoryCard/CategoryTable';
import styles from './CharacterTableView.module.css';
import { TemplateSchema } from '../../../../types/groupSchemas';
import { MenuItem } from '@tdn/shared/ui/DropdownMenu/DropdownMenu';

interface CharacterTableViewProps {
  character: Character;
  template: CharacterTemplate | null;
  schema: TemplateSchema | null;
  canEdit: boolean;
  onUpdateFieldValue: (fieldKey: string, newValue: string) => void;
  getCategoryMenuItems?: (category: CategoryData) => MenuItem[];
  canEditCategories?: boolean;
  hideZero?: boolean;

}

const CharacterTableView: React.FC<CharacterTableViewProps> = ({
  character,
  schema,
  canEdit,
  onUpdateFieldValue,
  getCategoryMenuItems,
  canEditCategories,
  hideZero,
}) => {
  const [isOtherDragOver, setIsOtherDragOver] = useState(false);
  const categorizedFields = categorizeCharacterFields(character, schema);

  // Если нет категорий, не отображаем таблицу
  if (Object.keys(categorizedFields).length === 0) {
    return null;
  }

  if (canEditCategories === undefined){
    canEditCategories = canEdit
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Останавливаем всплытие
    setIsOtherDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation(); // Останавливаем всплытие
    setIsOtherDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Останавливаем всплытие
    
    setIsOtherDragOver(false);
    
    const fieldKey = e.dataTransfer.getData('text/plain');
    if (fieldKey && categorizedFields.other) {
      console.log(`Перемещаем поле ${fieldKey} в "Другое"`);
    }
  };

  return (
    <div className={styles.tableView}>
      {Object.values(categorizedFields).map(category => (
        <CategoryTable
          key={category.key}
          category={category}
          canEdit={canEdit}
          onUpdateFieldValue={onUpdateFieldValue}
          getSubcategoryMenuItems={getCategoryMenuItems}
          categoryMenuItems={getCategoryMenuItems ? getCategoryMenuItems(category) : undefined}
          hideZero={hideZero}
        />
      ))}
      
      {/* Специальная зона для "Другого", если её нет в categorizedFields */}
      {!categorizedFields.other && canEdit && canEditCategories && (
        <div 
          className={`${styles.otherDropZone} ${isOtherDragOver ? styles.dragOver : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <h3 className={styles.otherTitle}>
            Перетащите поле сюда, чтобы переместить в "Другое"
          </h3>
        </div>
      )}
    </div>
  );
};

export default CharacterTableView;