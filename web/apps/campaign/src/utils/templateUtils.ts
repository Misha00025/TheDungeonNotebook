// utils/templateUtils.ts
import { CharacterTemplate } from '../types/characterTemplates';
import { Character, CharacterField } from '../types/characters';

export const templateToCharacter = (template: CharacterTemplate): Character => {
  const fields: Record<string, CharacterField> = {};
  
  // Преобразуем поля шаблона в поля персонажа
  Object.entries(template.fields).forEach(([key, field]) => {
    fields[key] = {
      name: field.name,
      value: field.value || 0, // Используем значение по умолчанию из шаблона
      description: field.description,
      formula: field.formula,
    };
  });

  return {
    id: -1, // Временный ID для превью
    name: template.name,
    description: template.description,
    templateId: template.id,
    fields: fields,
    group: template.group
  };
};