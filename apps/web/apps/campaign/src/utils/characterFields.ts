// utils/characterFields.ts
import { Character, CharacterField } from '../types/characters';
import { TemplateCategory, TemplateSchema } from '../types/groupSchemas';

export interface CategoryData {
  key: string;
  name: string;
  fields: [string, CharacterField, boolean][];
  subcategories?: CategoryData[];
}

export const convertToTemplateCategory = (categoryData: CategoryData): TemplateCategory => {
  return {
    name: categoryData.name,
    fields: categoryData.fields.map(([fieldKey]) => fieldKey),
    categories: categoryData.subcategories ? categoryData.subcategories.map(convertToTemplateCategory) : []
  };
};

// utils/characterFields.ts
// Исправленная функция getFieldsByCategory
export const getFieldsByCategory = (template: TemplateCategory, character: Character, parentKey?: string): CategoryData => {
  const categoryKey = parentKey ? `${parentKey}.${template.name}` : template.name;
  const fieldsInCategory: [string, CharacterField, boolean][] = [];
  
  // Проверяем каждое поле в схеме категории
  template.fields.forEach(fieldKey => {
    if (character.fields[fieldKey]) {
      fieldsInCategory.push([fieldKey, character.fields[fieldKey], true]);
    }
  });
  
  let subcategories: CategoryData[] = [];
  if (template.categories) {
    subcategories = template.categories.map(subCategory => 
      getFieldsByCategory(subCategory, character, categoryKey)
    );
  }
  
  return {
    key: categoryKey,
    name: template.name,
    fields: fieldsInCategory,
    subcategories: subcategories.length > 0 ? subcategories : undefined
  };
};

// Исправленная функция categorizeCharacterFields без поля category
export const categorizeCharacterFields = (character: Character, schema: TemplateSchema | null): Record<string, CategoryData> => {
  const categorizedFields: Record<string, CategoryData> = {};
  
  // Сначала создаем категории из схемы
  if (schema) {
    schema.categories.forEach(category => {
      categorizedFields[category.name] = getFieldsByCategory(category, character);
    });
  }
  
  // Создаем категорию "Другое" для полей, не вошедших в схему
  categorizedFields.other = {
    key: 'other',
    name: 'Другое',
    fields: []
  };
  
  // Распределяем все поля персонажа
  Object.entries(character.fields).forEach(([key, field]) => {
    let alreadyAdded = false;
    
    // Функция для рекурсивного поиска поля в категориях схемы
    const checkInCategory = (category: CategoryData): boolean => {
      // Проверяем поля в текущей категории
      if (category.fields.some(([fieldKey]) => fieldKey === key)) {
        return true;
      }
      
      // Рекурсивно проверяем подкатегории
      if (category.subcategories) {
        for (const subcategory of category.subcategories) {
          if (checkInCategory(subcategory)) return true;
        }
      }
      
      return false;
    };
    
    // Проверяем все категории из схемы
    for (const category of Object.values(categorizedFields)) {
      if (checkInCategory(category)) {
        alreadyAdded = true;
        break;
      }
    }
    
    // Если поле не найдено в категориях схемы, добавляем в "Другое"
    if (!alreadyAdded) {
      categorizedFields.other.fields.push([key, field, false]);
    }
  });
  
  // Удаляем категорию "Другое", если она пустая
  if (categorizedFields.other.fields.length === 0) {
    delete categorizedFields.other;
  }
  
  return categorizedFields;
};