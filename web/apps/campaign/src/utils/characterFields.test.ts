import { categorizeCharacterFields, convertToTemplateCategory, CategoryData } from './characterFields';
import { Character } from '../types/characters';
import { TemplateSchema } from '../types/groupSchemas';

const baseCharacter: Character = {
  id: 1,
  name: 'Grog',
  description: '',
  fields: {
    strength: { name: 'Сила', value: 10, description: '' },
    dexterity: { name: 'Ловкость', value: 12, description: '' },
    hp: { name: 'HP', value: 100, maxValue: 100, description: '' },
  },
  group: { id: 1, name: 'G', icon: null },
  templateId: 1,
};

describe('categorizeCharacterFields', () => {
  it('categorizes fields according to schema categories', () => {
    const schema: TemplateSchema = {
      categories: [
        { name: 'Характеристики', fields: ['strength', 'dexterity'], categories: [] },
        { name: 'Боевые', fields: ['hp'], categories: [] },
      ],
    };
    const result = categorizeCharacterFields(baseCharacter, schema);

    expect(result).toHaveProperty('Характеристики');
    expect(result).toHaveProperty('Боевые');
    expect(result).not.toHaveProperty('other');

    expect(result['Характеристики'].fields).toHaveLength(2);
    expect(result['Боевые'].fields).toHaveLength(1);
  });

  it('puts uncategorized fields into "other" category', () => {
    const char: Character = {
      ...baseCharacter,
      fields: {
        ...baseCharacter.fields,
        note: { name: 'Заметка', value: 0, description: 'просто текст' },
      },
    };
    const schema: TemplateSchema = {
      categories: [{ name: 'Stats', fields: ['strength'], categories: [] }],
    };
    const result = categorizeCharacterFields(char, schema);

    expect(result.other).toBeDefined();
    expect(result.other.fields.some(([key]) => key === 'note')).toBe(true);
    expect(result.other.fields.some(([key]) => key === 'hp')).toBe(true);
  });

  it('returns only "other" when schema is null', () => {
    const result = categorizeCharacterFields(baseCharacter, null);

    expect(result.other).toBeDefined();
    expect(result.other.fields).toHaveLength(3);
  });

  it('removes "other" category when it is empty', () => {
    const schema: TemplateSchema = {
      categories: [{ name: 'All', fields: ['strength', 'dexterity', 'hp'], categories: [] }],
    };
    const result = categorizeCharacterFields(baseCharacter, schema);

    expect(result).not.toHaveProperty('other');
  });

  it('handles empty character fields', () => {
    const char: Character = {
      ...baseCharacter,
      fields: {},
    };
    const schema: TemplateSchema = {
      categories: [{ name: 'Stats', fields: ['strength'], categories: [] }],
    };
    const result = categorizeCharacterFields(char, schema);

    expect(result.Stats.fields).toHaveLength(0);
    expect(result).not.toHaveProperty('other');
  });
});

describe('convertToTemplateCategory', () => {
  it('converts CategoryData without subcategories', () => {
    const categoryData: CategoryData = {
      key: 'stats',
      name: 'Stats',
      fields: [['strength', { name: 'Сила', value: 10, description: '' }, true]],
    };
    const result = convertToTemplateCategory(categoryData);

    expect(result.name).toBe('Stats');
    expect(result.fields).toEqual(['strength']);
    expect(result.categories).toEqual([]);
  });

  it('converts CategoryData with subcategories recursively', () => {
    const categoryData: CategoryData = {
      key: 'root',
      name: 'Root',
      fields: [],
      subcategories: [
        {
          key: 'child',
          name: 'Child',
          fields: [['hp', { name: 'HP', value: 100, description: '' }, true]],
        },
      ],
    };
    const result = convertToTemplateCategory(categoryData);

    expect(result.name).toBe('Root');
    expect(result.fields).toEqual([]);
    expect(result.categories).toHaveLength(1);
    expect(result.categories![0].name).toBe('Child');
    expect(result.categories![0].fields).toEqual(['hp']);
  });
});
