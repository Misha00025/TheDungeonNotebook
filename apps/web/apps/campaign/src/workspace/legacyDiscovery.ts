import { isLosslessNumber } from 'lossless-json';
import { parseJson } from './json';
import type { JsonValue } from './types';

export interface LegacyField { key: string; name: string; data: Record<string, JsonValue> }
export interface LegacyProperty { name: string; value: JsonValue }
export interface LegacyObject { name: string; sourceId?: string; data: Record<string, JsonValue>; fields: LegacyField[]; properties: LegacyProperty[] }
export type LegacySectionKey = 'characters' | 'charlists' | 'items' | 'skills' | 'characterItems' | 'characterSkills' | 'skillAttributes' | 'templateSchema';
export interface LegacySection { key: LegacySectionKey; label: string; present: boolean; total: number; objects: LegacyObject[] }
export interface LegacyDiscovery { version: 1; exportedAt?: string; sections: LegacySection[]; diagnostics: string[]; unknownSections: string[] }

type RecordValue = Record<string, JsonValue>;
type SectionConfig = { key: LegacySectionKey; label: string; source: string };

const sectionConfig: SectionConfig[] = [
  { key: 'characters', label: 'Персонажи', source: 'characters' },
  { key: 'charlists', label: 'Шаблоны', source: 'charlists' },
  { key: 'items', label: 'Предметы', source: 'items' },
  { key: 'skills', label: 'Навыки', source: 'skills' },
  { key: 'characterItems', label: 'Предметы персонажей', source: 'characterItems' },
  { key: 'characterSkills', label: 'Навыки персонажей', source: 'characterSkills' },
  { key: 'skillAttributes', label: 'Атрибуты навыков', source: 'skillAttributes' },
  { key: 'templateSchema', label: 'Схема полей', source: 'templateSchema' },
];

const isRecord = (value: JsonValue | undefined): value is RecordValue => value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value) && !isLosslessNumber(value);
const human = (record: RecordValue, fallback: string): string => typeof record.name === 'string' && record.name.length > 0 ? record.name : fallback;
const idString = (value: JsonValue | undefined): string | undefined => {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? String(value) : undefined;
  return isLosslessNumber(value) && /^-?\d+$/.test(String(value)) ? String(value) : undefined;
};
const isVersionOne = (value: JsonValue | undefined): boolean => value === 1 || isLosslessNumber(value) && String(value) === '1';
const descriptionProperty = (record: RecordValue): LegacyProperty[] => typeof record.description === 'string' ? [{ name: 'Описание', value: record.description }] : [];

export function discoverLegacyExport(text: string): LegacyDiscovery {
  let parsed: JsonValue;
  try { parsed = parseJson(text.startsWith('\uFEFF') ? text.slice(1) : text); }
  catch { throw new Error('Файл не содержит корректный JSON.'); }
  if (!isRecord(parsed)) throw new Error('Корень файла должен быть JSON-объектом.');
  if (!isVersionOne(parsed.version)) throw new Error('Формат или версия файла не поддерживается.');

  const diagnostics: string[] = [];
  const unknownSections = Object.keys(parsed).filter(key => !new Set(['version', 'exportedAt', 'groupId', ...sectionConfig.map(section => section.source)]).has(key));
  const sections = sectionConfig.map(({ key, label, source }): LegacySection => ({ key, label, present: Object.prototype.hasOwnProperty.call(parsed, source), total: 0, objects: [] }));
  const sectionFor = (key: LegacySectionKey) => sections.find(section => section.key === key)!;
  const arrays = new Map<string, JsonValue[]>();
  for (const config of sectionConfig) {
    const value = parsed[config.source];
    if (config.key === 'templateSchema') {
      const schema = isRecord(value) ? value.categories : undefined;
      if (value === undefined) continue;
      if (!isRecord(value) || !Array.isArray(schema)) { diagnostics.push('Схема полей имеет некорректный формат.'); continue; }
      arrays.set(config.source, schema);
      continue;
    }
    if (config.key === 'skillAttributes') {
      if (value === undefined) continue;
      if (!isRecord(value) || !Array.isArray(value.attributes)) { diagnostics.push('Атрибуты навыков имеют некорректный формат.'); continue; }
      arrays.set(config.source, value.attributes);
      sectionFor(config.key).total = value.attributes.length;
      continue;
    }
    if (value === undefined) continue;
    if (!Array.isArray(value)) { diagnostics.push(`Раздел «${config.label}» имеет некорректный формат.`); continue; }
    arrays.set(config.source, value);
    sectionFor(config.key).total = value.length;
  }

  const definitions = new Map<'characters' | 'charlists' | 'items' | 'skills', Map<string, string[]>>();
  for (const key of ['characters', 'charlists', 'items', 'skills'] as const) definitions.set(key, new Map());
  const entityFallback: Record<'characters' | 'charlists' | 'items' | 'skills', string> = { characters: 'Персонаж без названия', charlists: 'Шаблон без названия', items: 'Предмет без названия', skills: 'Навык без названия' };
  const knownEntity = (key: 'characters' | 'charlists' | 'items' | 'skills') => new Set(key === 'characters' ? ['oldId', 'templateOldId', 'ownerId', 'name', 'description', 'fields'] : key === 'charlists' ? ['oldId', 'name', 'description', 'fields'] : key === 'items' ? ['oldId', 'name', 'description', 'price', 'imageLink', 'isSecret', 'attributes'] : ['oldId', 'name', 'description', 'isSecret', 'attributes']);

  for (const key of ['characters', 'charlists', 'items', 'skills'] as const) {
    const records = arrays.get(key) ?? [];
    const objects: LegacyObject[] = [];
    records.forEach((entry, index) => {
      if (!isRecord(entry)) { diagnostics.push(`Раздел «${sectionFor(key).label}», запись ${index + 1}: некорректная запись.`); return; }
      const name = human(entry, entityFallback[key]);
      const sourceId = idString(entry.oldId);
      if (typeof entry.name !== 'string') diagnostics.push(`Раздел «${sectionFor(key).label}», запись «${name}»: некорректное или отсутствующее имя.`);
      if (sourceId === undefined) diagnostics.push(`Раздел «${sectionFor(key).label}», запись «${name}»: некорректный или отсутствующий идентификатор.`);
      const fields: LegacyField[] = [];
      if (key === 'characters' || key === 'charlists') {
        if (!isRecord(entry.fields)) diagnostics.push(`Запись «${name}»: отсутствуют или некорректны поля.`);
        else for (const [fieldKey, fieldValue] of Object.entries(entry.fields)) {
          if (!isRecord(fieldValue)) { diagnostics.push(`Запись «${name}»: поле «${fieldKey}» имеет некорректный формат.`); continue; }
          fields.push({ key: fieldKey, name: human(fieldValue, fieldKey), data: fieldValue });
          for (const property of Object.keys(fieldValue)) if (!new Set(['name', 'description', 'value', 'formula', 'modifierFormula', 'maxValue']).has(property)) diagnostics.push(`Поле «${fieldKey}» записи «${name}» содержит неизвестное свойство «${property}».`);
        }
      }
      const properties = descriptionProperty(entry);
      if (key === 'items') for (const [field, label] of [['price', 'Цена'], ['isSecret', 'Скрытый'], ['imageLink', 'Изображение']] as const) if (Object.prototype.hasOwnProperty.call(entry, field)) properties.push({ name: label, value: entry[field] });
      if (key === 'skills' && Object.prototype.hasOwnProperty.call(entry, 'isSecret')) properties.push({ name: 'Скрытый', value: entry.isSecret });
      if (key === 'items' || key === 'skills') {
        if (entry.attributes !== undefined) {
          if (!Array.isArray(entry.attributes)) diagnostics.push(`Запись «${name}»: атрибуты имеют некорректный формат.`);
          else entry.attributes.forEach(attribute => {
            if (!isRecord(attribute) || typeof attribute.key !== 'string' || !Object.prototype.hasOwnProperty.call(attribute, 'value')) diagnostics.push(`Запись «${name}»: некорректный атрибут.`);
            else {
              properties.push({ name: attribute.key, value: attribute.value });
              for (const property of Object.keys(attribute)) if (property !== 'key' && property !== 'value') diagnostics.push(`Атрибут «${attribute.key}» записи «${name}» содержит неизвестное свойство «${property}».`);
            }
          });
        }
      }
      for (const property of Object.keys(entry)) if (!knownEntity(key).has(property)) diagnostics.push(`Запись «${name}» содержит неизвестное свойство «${property}».`);
      objects.push({ name, ...(sourceId === undefined ? {} : { sourceId }), data: entry, fields, properties });
      if (sourceId !== undefined) definitions.get(key)!.set(sourceId, [...(definitions.get(key)!.get(sourceId) ?? []), name]);
    });
    sectionFor(key).objects = objects;
  }
  for (const [key, index] of definitions) for (const names of index.values()) if (names.length > 1) diagnostics.push(`В разделе «${sectionFor(key).label}» обнаружены повторяющиеся идентификаторы.`);

  const schemaFieldKeys = new Set<string>();
  const schemaObjects: LegacyObject[] = [];
  const walkCategories = (nodes: JsonValue[], parent: string) => nodes.forEach((node, index) => {
    if (!isRecord(node)) { diagnostics.push(`Схема полей: некорректная категория ${index + 1}.`); return; }
    const categoryName = human(node, `Категория ${index + 1}`);
    const path = parent ? `${parent} / ${categoryName}` : categoryName;
    if (typeof node.key !== 'string' || typeof node.name !== 'string') diagnostics.push(`Схема «${path}»: некорректный или отсутствующий ключ/имя категории.`);
    const properties: LegacyProperty[] = [];
    if (!Array.isArray(node.fields)) diagnostics.push(`Схема «${path}»: отсутствует или некорректен список полей.`);
    else {
      const keys: string[] = [];
      node.fields.forEach(field => { if (typeof field !== 'string') diagnostics.push(`Схема «${path}»: некорректная ссылка на поле.`); else { keys.push(field); schemaFieldKeys.add(field); } });
      properties.push({ name: 'Поля', value: keys });
    }
    for (const property of Object.keys(node)) if (!new Set(['key', 'name', 'fields', 'categories']).has(property)) diagnostics.push(`Категория «${path}» содержит неизвестное свойство «${property}».`);
    schemaObjects.push({ name: path, data: node, fields: [], properties });
    if (node.categories !== undefined) {
      if (Array.isArray(node.categories)) walkCategories(node.categories, path);
      else diagnostics.push(`Схема «${path}»: вложенные категории имеют некорректный формат.`);
    }
  });
  const schemaInput = arrays.get('templateSchema');
  if (schemaInput) walkCategories(schemaInput, '');
  sectionFor('templateSchema').total = schemaObjects.length;
  sectionFor('templateSchema').objects = schemaObjects;
  const templateFieldKeys = new Set(sectionFor('charlists').objects.flatMap(template => template.fields.map(field => field.key)));
  for (const key of schemaFieldKeys) if (!templateFieldKeys.has(key)) diagnostics.push(`Схема полей: ключ «${key}» отсутствует среди полей шаблонов.`);
  for (const character of sectionFor('characters').objects) {
    const templateId = idString(character.data.templateOldId);
    const matches = templateId === undefined ? [] : definitions.get('charlists')!.get(templateId) ?? [];
    if (matches.length !== 1) diagnostics.push(`Персонаж «${character.name}»: шаблон не указан, отсутствует или неоднозначен.`);
    else {
      const template = sectionFor('charlists').objects.find(item => item.sourceId === templateId)!;
      character.properties.push({ name: 'Шаблон', value: template.name });
      const templateKeys = new Set(template.fields.map(field => field.key));
      for (const field of character.fields) if (!templateKeys.has(field.key)) diagnostics.push(`Персонаж «${character.name}»: поле «${field.key}» отсутствует в шаблоне «${template.name}».`);
    }
  }

  const skillAttributes = sectionFor('skillAttributes');
  for (const [index, value] of (arrays.get('skillAttributes') ?? []).entries()) {
    if (!isRecord(value) || typeof value.name !== 'string' || typeof value.key !== 'string') { diagnostics.push(`Атрибут навыков ${index + 1}: некорректная запись.`); continue; }
    const properties: LegacyProperty[] = [{ name: 'Ключ', value: value.key }];
    if (typeof value.description === 'string') properties.push({ name: 'Описание', value: value.description });
    if (Object.prototype.hasOwnProperty.call(value, 'isFiltered')) properties.push({ name: 'Фильтрация', value: value.isFiltered });
    if (Object.prototype.hasOwnProperty.call(value, 'knownValues')) properties.push({ name: 'Известные значения', value: value.knownValues });
    for (const property of Object.keys(value)) if (!new Set(['name', 'key', 'description', 'isFiltered', 'knownValues']).has(property)) diagnostics.push(`Атрибут навыка «${value.name}» содержит неизвестное свойство «${property}».`);
    skillAttributes.objects.push({ name: human(value, value.key), data: value, fields: [], properties });
  }

  const resolve = (type: 'characters' | 'items' | 'skills', idValue: JsonValue | undefined, label: string): string => {
    const id = idString(idValue);
    const names = id === undefined ? [] : definitions.get(type)!.get(id) ?? [];
    if (names.length === 1) return names[0];
    diagnostics.push(`${label}: ссылка ${names.length > 1 ? 'неоднозначна' : 'не разрешается'}.`);
    return names.length > 1 ? `Неоднозначная ссылка на ${type === 'characters' ? 'персонажа' : type === 'items' ? 'предмет' : 'навык'}` : type === 'characters' ? 'Персонаж отсутствует в файле' : type === 'items' ? 'Предмет отсутствует в файле' : 'Навык отсутствует в файле';
  };
  for (const entry of arrays.get('characterItems') ?? []) {
    if (!isRecord(entry)) { diagnostics.push('Назначение предмета имеет некорректный формат.'); continue; }
    const character = resolve('characters', entry.characterOldId, 'Назначение предмета');
    const item = resolve('items', entry.itemOldId, 'Назначение предмета');
    for (const property of Object.keys(entry)) if (!new Set(['characterOldId', 'itemOldId', 'amount']).has(property)) diagnostics.push(`Назначение предмета содержит неизвестное свойство «${property}».`);
    const objects = sectionFor('characterItems').objects;
    const characterId = idString(entry.characterOldId);
    const itemId = idString(entry.itemOldId);
    const duplicate = characterId !== undefined && itemId !== undefined && objects.some(object => {
      const previousCharacterId = idString(object.data.characterOldId);
      const previousItemId = idString(object.data.itemOldId);
      return previousCharacterId !== undefined && itemId !== undefined && previousItemId !== undefined && previousCharacterId === characterId && previousItemId === itemId;
    });
    if (duplicate) diagnostics.push('Повторяется назначение предмета персонажу.');
    objects.push({ name: `${character} — ${item}`, data: entry, fields: [], properties: Object.prototype.hasOwnProperty.call(entry, 'amount') ? [{ name: 'Количество', value: entry.amount }] : [] });
  }
  for (const entry of arrays.get('characterSkills') ?? []) {
    if (!isRecord(entry)) { diagnostics.push('Назначение навыка имеет некорректный формат.'); continue; }
    const character = resolve('characters', entry.characterOldId, 'Назначение навыка');
    const skill = resolve('skills', entry.skillOldId, 'Назначение навыка');
    for (const property of Object.keys(entry)) if (!new Set(['characterOldId', 'skillOldId']).has(property)) diagnostics.push(`Назначение навыка содержит неизвестное свойство «${property}».`);
    const objects = sectionFor('characterSkills').objects;
    const characterId = idString(entry.characterOldId);
    const skillId = idString(entry.skillOldId);
    const duplicate = characterId !== undefined && skillId !== undefined && objects.some(object => {
      const previousCharacterId = idString(object.data.characterOldId);
      const previousSkillId = idString(object.data.skillOldId);
      return previousCharacterId !== undefined && skillId !== undefined && previousSkillId !== undefined && previousCharacterId === characterId && previousSkillId === skillId;
    });
    if (duplicate) diagnostics.push('Повторяется назначение навыка персонажу.');
    objects.push({ name: `${character} — ${skill}`, data: entry, fields: [], properties: [] });
  }
  return { version: 1, ...(typeof parsed.exportedAt === 'string' ? { exportedAt: parsed.exportedAt } : {}), sections, diagnostics, unknownSections };
}
