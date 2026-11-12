// CharacterTemplates.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CharacterTemplate, TemplateField, UpdateTemplateRequest } from '../../../../types/characterTemplates';
import { characterTemplatesAPI, groupAPI } from '../../../../services/api';
import commonStyles from '@tdn/shared/styles/common.module.css';
import modalStyles from '@tdn/shared/styles/modal.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css'; // Добавляем импорт стилей для input
import uiStyles from '@tdn/shared/styles/ui.module.css';
import { useActionPermissions } from '../../../../hooks/useActionPermissions';
import { TemplateCategory, TemplateSchema } from '../../../../types/groupSchemas';
import { useGroupSchemas } from '../../../../contexts/GroupSchemasContext';
import IconButton from '@tdn/shared/ui/Buttons/IconButton/IconButton';
import { TemplateEditProvider } from '../../../../contexts/TemplateEditContext';
import TemplatePreview from './TemplatePreview/TemplatePreview';
import CategoryModal from '../Modals/CharacterModal/CategoryModal';
import TemplateFieldModal from '../Modals/CharacterFieldModal/TemplateFieldModal';

const CharacterTemplates: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [originalTemplate, setOriginalTemplate] = useState<CharacterTemplate | null>(null);
  const [originalSchema, setOriginalSchema] = useState<TemplateSchema | null>(null);
  
  // Локальные копии для редактирования
  const [editingTemplate, setEditingTemplate] = useState<CharacterTemplate | null>(null);
  const [editingSchema, setEditingSchema] = useState<TemplateSchema | null>(null);
  
  const { template, templateSchema, loading, refreshSchemas } = useGroupSchemas();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const { canEditTemplates } = useActionPermissions();

  // Состояния для модальных окон
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [currentEditingCategory, setCurrentEditingCategory] = useState<{
    category: TemplateCategory | null; 
    parentKey?: string;
    isRoot?: boolean;
  }>({ category: null });
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<{ field: TemplateField | null; fieldKey: string }>({ field: null, fieldKey: '' });
  const [currentCategoryKey, setCurrentCategoryKey]= useState<string|null>(null)

  useEffect(() => {
    if (groupId) {
      // Синхронизируем "сохранённую" ссылку всегда.
      setOriginalTemplate(template);
      setOriginalSchema(templateSchema || { categories: [] });
      // Редактируемые копии заполняем из контекста только вне режима
      // редактирования, чтобы не затирать незавершённые правки пользователя.
      if (!editMode) {
        setEditingTemplate(template);
        setEditingSchema(templateSchema || { categories: [] });
      }
      setCurrentCategoryKey(null);
    }
  }, [groupId, editMode, template, templateSchema]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateTemplate = async () => {
    try {
      const newTemplate = await characterTemplatesAPI.createTemplate(parseInt(groupId!), {
        name: 'Новый шаблон',
        description: '',
        fields: {}
      });
      setOriginalTemplate(newTemplate);
      setEditingTemplate(newTemplate);
      setEditMode(true);
      await refreshSchemas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  // Вход в режим редактирования
  const handleEnterEditMode = () => {
    if (!editingTemplate || !editingSchema) return;
    
    setEditMode(true);
  };

  // Выход из режима редактирования без сохранения
  const handleCancelEdit = () => {
    
    setEditMode(false);
  };

  // Сохранение всех изменений
  const handleSaveAllChanges = async () => {
    if (!editingTemplate || !editingSchema) return;

    try {
      setSaving(true);
      setError(null);

      // 1. Сохраняем шаблон (все поля)
      const templateUpdateData: UpdateTemplateRequest = {
        name: editingTemplate.name,
        description: editingTemplate.description,
        fields: editingTemplate.fields
      };

      await characterTemplatesAPI.updateTemplate(
        parseInt(groupId!), 
        editingTemplate.id, 
        templateUpdateData
      );

      // 2. Сохраняем схему
      await groupAPI.updateTemplateSchema(
        Number(groupId), 
        editingSchema
      );

      await refreshSchemas();

      // Обновляем оригинальные данные
      setOriginalTemplate(editingTemplate);
      setOriginalSchema(editingSchema);
      setEditMode(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Обработчики для категорий
  const handleAddCategory = (parentCategoryKey?: string) => {
    setCurrentEditingCategory({ 
      category: null, 
      parentKey: parentCategoryKey,
      isRoot: !parentCategoryKey
    });
    setIsCategoryModalOpen(true);
  };

  const handleAddRootCategory = () => {
    handleAddCategory(undefined); // undefined означает корневую категорию
  };

  const handleEditCategory = (categoryKey: string) => {
    if (!editingSchema) return;
    
    const findCategoryInSchema = (categories: TemplateCategory[], key: string): {
      category: TemplateCategory | null; 
      parentKey?: string;
    } => {
      for (const category of categories) {
        if (category.name === key) {
          return { category };
        }
        if (category.categories) {
          const found = findCategoryInSchema(category.categories, key);
          if (found.category) {
            return { category: found.category, parentKey: category.name };
          }
        }
      }
      return { category: null };
    };

    const result = findCategoryInSchema(editingSchema.categories, categoryKey);
    if (result.category) {
      setCurrentEditingCategory(result);
      setIsCategoryModalOpen(true);
    }
  };

  const handleDeleteCategory = (categoryKey: string) => {
    if (!editingSchema || !window.confirm(`Удалить категорию "${categoryKey}"? Все поля в этой категории будут перемещены в "Другое".`)) {
      return;
    }

    const removeCategoryFromSchema = (categories: TemplateCategory[], categoryName: string): TemplateCategory[] => {
      return categories
        .filter(category => category.name !== categoryName)
        .map(category => ({
          ...category,
          categories: category.categories ? removeCategoryFromSchema(category.categories, categoryName) : []
        }));
    };

    const updatedCategories = removeCategoryFromSchema(editingSchema.categories, categoryKey);
    setEditingSchema({
      ...editingSchema,
      categories: updatedCategories
    });
  };

  const handleSaveCategory = (category: TemplateCategory) => {
    if (!editingSchema) return;
    
    console.log('Сохранение категории:', {
      category,
      currentEditingCategory,
      parentKey: currentEditingCategory.parentKey,
      isNew: !currentEditingCategory.category
    });

    const addOrUpdateCategory = (
      categories: TemplateCategory[], 
      newCategory: TemplateCategory,
      parentKey?: string
    ): TemplateCategory[] => {
      if (!parentKey) {
        // Добавление/обновление корневой категории
        const existingIndex = categories.findIndex(c => c.name === newCategory.name);
        if (existingIndex >= 0) {
          // Обновление существующей категории
          const updated = [...categories];
          updated[existingIndex] = newCategory;
          return updated;
        } else {
          // Добавление новой категории
          return [...categories, newCategory];
        }
      }
      
      // Добавление/обновление подкатегории
      return categories.map(cat => {
        if (cat.name === parentKey) {
          // Нашли родительскую категорию
          const existingIndex = (cat.categories || []).findIndex(c => c.name === newCategory.name);
          if (existingIndex >= 0) {
            // Обновление существующей подкатегории
            const updatedCategories = [...(cat.categories || [])];
            updatedCategories[existingIndex] = newCategory;
            return {
              ...cat,
              categories: updatedCategories
            };
          } else {
            // Добавление новой подкатегории
            return {
              ...cat,
              categories: [...(cat.categories || []), newCategory]
            };
          }
        }
        
        // Рекурсивно ищем родительскую категорию в подкатегориях
        if (cat.categories) {
          return {
            ...cat,
            categories: addOrUpdateCategory(cat.categories, newCategory, parentKey)
          };
        }
        
        return cat;
      });
    };
    
    const updatedCategories = addOrUpdateCategory(
      editingSchema.categories,
      category,
      currentEditingCategory.parentKey
    );
  
    setEditingSchema({
      ...editingSchema,
      categories: updatedCategories
    });
    
    setIsCategoryModalOpen(false);
    setCurrentEditingCategory({ category: null });
  };

  // Обработчики для полей
  const handleAddField = (categoryKey?:string) => {
    setEditingField({ field: null, fieldKey: '' });
    setCurrentCategoryKey(categoryKey !== undefined ? categoryKey : null)
    setIsFieldModalOpen(true);
  };

  const handleEditField = (fieldKey: string) => {
    if (!editingTemplate) return;
    
    const field = editingTemplate.fields[fieldKey];
    if (field) {
      setEditingField({ field, fieldKey });
      setIsFieldModalOpen(true);
    }
  };

  const handleDeleteField = (fieldKey: string) => {
    if (!editingTemplate || !window.confirm(`Удалить поле "${editingTemplate.fields[fieldKey]?.name}"?`)) {
      return;
    }

    const updatedFields = { ...editingTemplate.fields };
    delete updatedFields[fieldKey];
    
    setEditingTemplate({
      ...editingTemplate,
      fields: updatedFields
    });
  };

  const handleSaveField = (field: TemplateField, fieldKey: string) => {
    if (!editingTemplate) return;
    
    let updatedFields = { ...editingTemplate.fields };
    
    if (editingField.field && editingField.fieldKey !== fieldKey) {
      // Если изменился ключ поля, удаляем старый и добавляем новый
      delete updatedFields[editingField.fieldKey];
    }
    updatedFields[fieldKey] = field;
    setEditingTemplate({
      ...editingTemplate,
      fields: updatedFields
    });
    console.log("Шаблон изменён")
    setIsFieldModalOpen(false);
    setEditingField({ field: null, fieldKey: '' });

    if (currentCategoryKey !== null){
      handleMoveFieldToCategory(fieldKey, currentCategoryKey);
    }
    setCurrentCategoryKey(null);
  };

  // Обновление названия и описания шаблона
  const handleUpdateTemplateInfo = (updates: { name?: string; description?: string }) => {
    if (!editingTemplate) return;
    
    setEditingTemplate({
      ...editingTemplate,
      ...updates
    });
  };

  if (loading) return <div className={commonStyles.container}>Загрузка...</div>;

  const handleMoveFieldToCategory = (fieldKey: string, targetCategoryKey: string) => {
    if (!editingTemplate || !editingSchema) return;
  
    console.log(`Перемещаем поле ${fieldKey} в категорию ${targetCategoryKey}`);
  
    // Находим поле
    const field = editingTemplate.fields[fieldKey];
    if (!field && !currentCategoryKey) {
      console.log(`Поле ${fieldKey} не найдено`);
      return;
    }
  
    // Определяем, является ли целевая категория "Другим"
    const isTargetOther = targetCategoryKey === 'other';
  
    // Функция для удаления поля из всех категорий
    const removeFieldFromAllCategories = (categories: TemplateCategory[]): TemplateCategory[] => {
      return categories.map(category => ({
        ...category,
        fields: category.fields.filter(f => f !== fieldKey),
        categories: category.categories ? removeFieldFromAllCategories(category.categories) : []
      }));
    };
  
    // Функция для добавления поля в конкретную категорию по ключу
    const addFieldToCategory = (categories: TemplateCategory[], targetKey: string): TemplateCategory[] => {
      return categories.map(category => {
        // Проверяем, совпадает ли ключ категории (для корневых категорий)
        if (category.name === targetKey) {
          // Проверяем, нет ли уже такого поля в категории
          if (!category.fields.includes(fieldKey)) {
            return {
              ...category,
              fields: [...category.fields, fieldKey]
            };
          }
          return category;
        }
        
        if (category.categories) {
          if (targetKey.startsWith(`${category.name}.`)) {
            const remainingKey = targetKey.substring(category.name.length + 1);
            return {
              ...category,
              categories: addFieldToCategory(category.categories, remainingKey)
            };
          }
          return {
            ...category,
            categories: addFieldToCategory(category.categories, targetKey)
          };
        }
        
        return category;
      });
    };
  
    // Функция для поиска категории по ключу
    const findCategoryByKey = (categories: TemplateCategory[], targetKey: string): boolean => {
      for (const category of categories) {
        if (category.name === targetKey) {
          return true;
        }
        
        if (category.categories) {
          // Проверяем вложенные категории
          const remainingKey = targetKey.startsWith(`${category.name}.`) 
            ? targetKey.substring(category.name.length + 1)
            : targetKey;
          
          if (findCategoryByKey(category.categories, remainingKey)) {
            return true;
          }
        }
      }
      return false;
    };
  
    const categoryExists = findCategoryByKey(editingSchema.categories, targetCategoryKey);
    
    if (!categoryExists && !isTargetOther) {
      console.error(`Категория ${targetCategoryKey} не найдена`);
      return;
    }
  
    let updatedCategories = removeFieldFromAllCategories(editingSchema.categories);
    
    if (!isTargetOther) {
      console.log(`Помещаем поле ${fieldKey} в категорию ${targetCategoryKey}`);
      updatedCategories = addFieldToCategory(updatedCategories, targetCategoryKey);
    }
  
    setEditingSchema({
      ...editingSchema,
      categories: updatedCategories
    });
    
    console.log('Поле успешно перемещено');
  };
  
  // Обновляем templateEditContextValue:
  const templateEditContextValue = {
    editMode,
    onAddField: handleAddField,
    onAddCategory: handleAddCategory,
    onDeleteField: handleDeleteField,
    onDeleteCategory: handleDeleteCategory,
    onEditField: handleEditField,
    onEditCategory: handleEditCategory,
    onMoveFieldToCategory: handleMoveFieldToCategory,
  };

  return (
    <div className={commonStyles.container}>
      <div className={uiStyles.actions} style={{ marginBottom: '1.5rem' }}>
        {editMode ? (
          <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>
            <input
              type="text"
              value={editingTemplate?.name || ''}
              onChange={(e) => handleUpdateTemplateInfo({ name: e.target.value })}
              className={inputStyles.input}
              style={{ 
                flex: 1, 
                fontSize: '1.5rem', 
                fontWeight: 'bold',
                padding: '0.75rem'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className={buttonStyles.button}
                onClick={handleSaveAllChanges}
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <IconButton 
                title="Отменить редактирование"
                icon="close"
                onClick={handleCancelEdit}
              />
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ margin: 0, marginRight: 'auto' }}>
              {originalTemplate?.name || 'Шаблон персонажей'}
            </h1>
            {canEditTemplates && originalTemplate && (
              <IconButton 
                title="Редактировать шаблон"
                icon="edit"
                onClick={handleEnterEditMode}
              />
            )}
          </>
        )}
      </div>

      {editMode && editingTemplate && (
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            value={editingTemplate.description}
            onChange={(e) => handleUpdateTemplateInfo({ description: e.target.value })}
            className={`${inputStyles.input}`}
            style={{ 
              width: '100%', 
              minHeight: '120px', 
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            placeholder="Описание шаблона..."
          />
        </div>
      )}

      {error && <div className={modalStyles.error}>{error}</div>}

      {/* Кнопка добавления корневой категории */}
      {editMode && (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            className={buttonStyles.button}
            onClick={handleAddRootCategory}
          >
            + Добавить корневую категорию
          </button>
          <button 
            className={buttonStyles.button}
            onClick={() => handleAddField()}
          >
            + Добавить поле (без категории)
          </button>
        </div>
      )}

      {originalTemplate ? (
        <TemplateEditProvider value={templateEditContextValue}>
          <TemplatePreview 
            template={editMode && editingTemplate ? editingTemplate : originalTemplate} 
            schema={editMode && editingSchema ? editingSchema : (originalSchema || {categories: []})} 
          />
        </TemplateEditProvider>
      ) : (
        <div className={commonStyles.card}>
          <p>Шаблон ещё не создан</p>
          {canEditTemplates && (
            <button 
              className={buttonStyles.button}
              onClick={handleCreateTemplate}
            >
              Создать шаблон
            </button>
          )}
        </div>
      )}

      {/* Модальные окна */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setCurrentEditingCategory({ category: null });
        }}
        onSave={handleSaveCategory}
        category={currentEditingCategory.category}
        title={currentEditingCategory.category ? 'Редактирование категории' : 
               currentEditingCategory.isRoot ? 'Создание корневой категории' : 'Создание подкатегории'}
      />

      <TemplateFieldModal
        isOpen={isFieldModalOpen}
        onClose={() => {
          setIsFieldModalOpen(false);
          setEditingField({ field: null, fieldKey: '' });
        }}
        onSave={handleSaveField}
        field={editingField.field}
        fieldKey={editingField.fieldKey}
        title={editingField.field ? 'Редактирование поля' : 'Создание поля'}
      />
    </div>
  );
};

export default CharacterTemplates;