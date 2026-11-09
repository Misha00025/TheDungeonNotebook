// components/Views/CharacterTableView/CategoryTable.tsx
import React, { useContext, useState } from 'react';
import { CategoryData } from '../../../../../utils/characterFields';
import styles from './CategoryTable.module.css';
import { TemplateEditContext } from '../../../../../contexts/TemplateEditContext';
import { DashboardSettingsContext } from '../../../../../contexts/DashboardSettingsContext';
import DropdownMenu, { MenuItem } from '@tdn/shared/ui/DropdownMenu/DropdownMenu';
import FieldRow from '../FieldCard/FieldRow';

interface CategoryTableProps {
  category: CategoryData;
  canEdit: boolean;
  onUpdateFieldValue: (fieldKey: string, newValue: string) => void;
  getSubcategoryMenuItems?: (category: CategoryData) => MenuItem[];
  level?: number;
  categoryMenuItems?: MenuItem[];
  hideZero?: boolean;
}

const CategoryTable: React.FC<CategoryTableProps> = ({
  category,
  canEdit,
  onUpdateFieldValue,
  getSubcategoryMenuItems,
  level = 0,
  categoryMenuItems,
  hideZero = false,
}) => {
  const templateEditContext = useContext(TemplateEditContext);
  const editMode = templateEditContext?.editMode || false;
  const dashboardCtx = useContext(DashboardSettingsContext);
  const isFieldOnDashboard = dashboardCtx?.isFieldOnDashboard ?? (() => false);
  const toggleField = dashboardCtx?.toggleField ?? (() => {});
  const [isDragOver, setIsDragOver] = useState(false);
  const draggableFields = templateEditContext?.onMoveFieldToCategory !== undefined && editMode

  const getFieldMenuItems = (fieldKey: string): MenuItem[] => {
    if (!editMode) return [];
    
    const items: MenuItem[] = [];
    
    if (templateEditContext?.onEditField) {
      items.push({
        label: 'Редактировать поле',
        onClick: () => templateEditContext.onEditField?.(fieldKey),
      });
    }
    
    if (templateEditContext?.onChangeFieldType) {
      items.push({
        label: 'Изменить тип',
        onClick: () => templateEditContext.onChangeFieldType?.(fieldKey),
      });
    }
    
    const isOnDashboard = isFieldOnDashboard(fieldKey);
    items.push({
      label: isOnDashboard ? '📌 Убрать с главной' : '📌 На главную',
      onClick: () => toggleField(fieldKey),
    });
    
    if (templateEditContext?.onDeleteField) {
      items.push({
        label: 'Удалить поле',
        onClick: () => templateEditContext.onDeleteField?.(fieldKey),
        variant: 'danger'
      });
    }
    
    return items;
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (editMode && category.key !== 'other') {
      e.preventDefault();
      e.stopPropagation(); // Останавливаем всплытие
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation(); // Останавливаем всплытие
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Останавливаем всплытие
    
    setIsDragOver(false);
    
    const fieldKey = e.dataTransfer.getData('text/plain');
    if (fieldKey && templateEditContext?.onMoveFieldToCategory) {
      console.log(`Перемещаем поле ${fieldKey} в категорию ${category.key}`);
      templateEditContext.onMoveFieldToCategory(fieldKey, category.key);
    }
  };

  const handleDragStart = (e: React.DragEvent, fieldKey: string) => {
    e.dataTransfer.setData('text/plain', fieldKey);
    e.dataTransfer.effectAllowed = 'move';
    
    // Добавляем визуальную обратную связь
    const element = e.currentTarget as HTMLElement;
    element.classList.add(styles.dragging);
  };


  const renderCategoryActions = () => {
    const menuItems = categoryMenuItems || [];
    if (menuItems.length === 0) return null;

    return (
      <div className={styles.addButtonContainer}>
        <DropdownMenu
          items={menuItems}
          buttonTitle="Действия с категорией"
        />
      </div>
    );
  };

  return (
    <div 
      className={`${styles.categorySection} ${level > 0 ? styles.subcategory : ''} ${isDragOver ? styles.dragOver : ''}`}
      style={{ margin: level > 0 ? `${level * 4}px` : '0' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h3 className={styles.categoryTitle}>
        <span className={styles.titleCenter}>
          {category.name}
          {isDragOver && <span style={{ marginLeft: '0.5rem' }}>← Перетащите сюда</span>}
        </span>
        {renderCategoryActions()}
      </h3>
      
      {category.fields.length > 0 && (
        <table className={styles.table}>
          <tbody>
            {category.fields.map(([fieldKey, field]) => (
              !(hideZero && (field.value === 0 && field.maxValue === undefined)) && 
              <FieldRow
                key={fieldKey}
                field={field}
                fieldKey={fieldKey}
                showMenu={editMode}
                menuItems={getFieldMenuItems(fieldKey)}
                onValueChange={(newValue) => onUpdateFieldValue(fieldKey, newValue)}
                editable={canEdit}
                draggable={draggableFields}
                onDragStart={handleDragStart}
              />
            ))}
          </tbody>
        </table>
      )}
      {category.subcategories && category.subcategories.map(subcategory => (
        <CategoryTable
          key={subcategory.key}
          category={subcategory}
          canEdit={canEdit}
          onUpdateFieldValue={onUpdateFieldValue}
          getSubcategoryMenuItems={getSubcategoryMenuItems}
          level={level + 1}
          categoryMenuItems={getSubcategoryMenuItems ? getSubcategoryMenuItems(subcategory) : []}
          hideZero={hideZero}
        />
      ))}
    </div>
  );
};

export default CategoryTable;