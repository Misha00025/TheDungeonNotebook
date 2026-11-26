import { isLosslessNumber } from 'lossless-json';
import type { JsonValue } from './types';
import type { CatalogAttributeInput, CatalogAttributeOccurrence, CatalogAttributeType, CatalogKind, CatalogMetadata } from './catalogTypes';
import type { LegacyObject } from './legacyDiscovery';
import { parseJson, stringifyJson } from './json';

export type LegacyCatalogAttribute = { key: string; title: string; typeKey: CatalogAttributeType; price: boolean };
export type LegacyCatalogSelections = Record<CatalogKind, Set<number>>;
export type LegacyCatalogAttributeChoices = Record<CatalogKind, Record<string, { included: boolean; typeKey: CatalogAttributeType }>>;
export type LegacyCatalogChoiceOptions = Record<string, { optionKey: string; title: string }[]>;

const record = (value: JsonValue): value is Record<string, JsonValue> => value !== null && typeof value === 'object' && !Array.isArray(value) && !isLosslessNumber(value);
const minInt64 = -9223372036854775808n;
const maxInt64 = 9223372036854775807n;

function exactInteger(value: JsonValue): boolean {
  if (typeof value !== 'number' && !isLosslessNumber(value)) return false;
  const raw = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) return false;
  let digits = `${match[2]}${match[3] ?? ''}`.replace(/^0+/, '') || '0';
  if (digits === '0') return true;
  const exponent = BigInt(match[4] ?? '0');
  const shift = exponent - BigInt(match[3]?.length ?? 0);
  if (shift < 0n) {
    const removeBig = -shift;
    if (removeBig >= BigInt(digits.length)) return false;
    const remove = Number(removeBig);
    if (!digits.endsWith('0'.repeat(remove))) return false;
    digits = digits.slice(0, -remove) || '0';
  } else if (shift > 0n) {
    if (digits.length + Number(shift) > 19) return false;
    digits += '0'.repeat(Number(shift));
  }
  const integer = BigInt(`${match[1]}${digits}`);
  return integer >= minInt64 && integer <= maxInt64;
}

function isJsonNumber(value: JsonValue): boolean {
  return (typeof value === 'number' && Number.isFinite(value))
    || isLosslessNumber(value) && Number.isFinite(Number(String(value)));
}

function parseNumericString(value: string): JsonValue | undefined {
  const trimmed = value.trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(trimmed);
  if (!match) return undefined;
  const integer = (match[2] ?? '0').replace(/^0+(?=\d)/, '');
  const fraction = match[3] ?? match[4];
  const normalized = `${match[1] === '-' ? '-' : ''}${integer}${fraction !== undefined ? `.${fraction || '0'}` : ''}${match[5] === undefined ? '' : `e${match[5]}`}`;
  try {
    return parseJson(normalized);
  } catch {
    return undefined;
  }
}

export function discoverCatalogAttributes(kind: CatalogKind, sources: LegacyObject[], skillAttributes: LegacyObject[]): LegacyCatalogAttribute[] {
  const keys = new Set<string>();
  for (const source of sources) {
    if (!Array.isArray(source.data.attributes)) continue;
    for (const attribute of source.data.attributes) if (record(attribute) && typeof attribute.key === 'string') keys.add(attribute.key);
  }
  if (kind === 'Item' && sources.some(source => Object.prototype.hasOwnProperty.call(source.data, 'price'))) keys.add('price');
  const names = new Map(skillAttributes.flatMap(item => typeof item.data.key === 'string' && typeof item.data.name === 'string' ? [[item.data.key, item.data.name] as const] : []));
  return [...keys].map(key => ({ key, title: kind === 'Item' && key === 'price' ? 'Цена' : kind === 'Skill' ? names.get(key) ?? key : key, typeKey: kind === 'Item' && key === 'price' ? 'integer' : 'string', price: kind === 'Item' && key === 'price' }));
}

const choiceValue = (value: JsonValue) => typeof value === 'string' ? value : stringifyJson(value);

export function discoverCatalogChoiceOptions(sources: LegacyObject[], choices: Record<string, { included: boolean; typeKey: CatalogAttributeType }>): LegacyCatalogChoiceOptions {
  const values = new Map<string, Set<string>>();
  for (const source of sources) {
    if (!Array.isArray(source.data.attributes)) continue;
    for (const attribute of source.data.attributes) {
      if (!record(attribute) || typeof attribute.key !== 'string' || !Object.prototype.hasOwnProperty.call(attribute, 'value')) continue;
      const found = values.get(attribute.key) ?? new Set<string>();
      const typeKey = choices[attribute.key]?.typeKey;
      const options = typeKey === 'multiChoice' && Array.isArray(attribute.value) ? attribute.value : [attribute.value];
      options.forEach(value => found.add(choiceValue(value)));
      values.set(attribute.key, found);
    }
  }
  return Object.fromEntries([...values].map(([key, options]) => [key, [...options].map((title, index) => ({ optionKey: `legacy-option-${index + 1}`, title }))]));
}

export function catalogImportOccurrences(kind: CatalogKind, source: LegacyObject, choices: Record<string, { included: boolean; typeKey: CatalogAttributeType }>, attributeIds: Map<string, string>, choiceOptions: LegacyCatalogChoiceOptions): { attributes: CatalogAttributeOccurrence[]; issues: string[] } {
  const attributes: CatalogAttributeOccurrence[] = [];
  const issues: string[] = [];
  const add = (key: string, value: JsonValue) => {
    const choice = choices[key];
    if (!choice?.included) return;
    const attributeId = attributeIds.get(key);
    if (!attributeId) { issues.push(`«${key}»: схема не вернула созданный атрибут.`); return; }
    let converted: JsonValue = value;
    const typeKey = kind === 'Item' && key === 'price' ? 'integer' : choice.typeKey;
    if (typeKey === 'singleChoice' || typeKey === 'multiChoice') {
      const options = choiceOptions[key] ?? [];
      const keys = new Map(options.map(option => [option.title, option.optionKey]));
      const values = typeKey === 'multiChoice' && Array.isArray(value) ? value : [value];
      const mapped = values.map(item => keys.get(choiceValue(item)));
      if (mapped.some(item => item === undefined)) {
        issues.push(`«${key}»: значение пропущено — вариант отсутствует в схеме.`);
        return;
      }
      converted = typeKey === 'singleChoice' ? mapped[0]! : [...new Set(mapped.filter((item): item is string => item !== undefined))];
    }
    if (typeKey === 'integer') {
      if (typeof value === 'string') {
        const parsed = parseNumericString(value);
        if (parsed === undefined || !exactInteger(parsed)) {
          issues.push(`«${key}»: значение пропущено — требуется целое число в диапазоне Int64.`);
          return;
        }
        converted = parsed;
      } else if (!exactInteger(value)) {
        issues.push(`«${key}»: значение пропущено — требуется целое число в диапазоне Int64.`);
        return;
      }
    }
    if (typeKey === 'number') {
      if (typeof value === 'string') {
        const parsed = parseNumericString(value);
        if (parsed === undefined || !isJsonNumber(parsed)) {
          issues.push(`«${key}»: значение пропущено — требуется конечное число.`);
          return;
        }
        converted = parsed;
      } else if (!isJsonNumber(value)) {
        issues.push(`«${key}»: значение пропущено — требуется конечное число.`);
        return;
      }
    }
    if (typeKey === 'boolean') {
      if (typeof value === 'boolean') converted = value;
      else if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) converted = value.trim().toLowerCase() === 'true';
      else {
        issues.push(`«${key}»: значение пропущено — требуется логическое значение true или false.`);
        return;
      }
    }
    if (typeKey === 'string') converted = typeof value === 'string' ? value : stringifyJson(value);
    else if (typeKey !== 'integer' && typeKey !== 'number' && typeKey !== 'boolean' && typeKey !== 'singleChoice' && typeKey !== 'multiChoice') {
      issues.push(`«${key}»: значение пропущено — выбранный тип атрибута не поддерживается при импорте.`);
      return;
    }
    attributes.push({ id: crypto.randomUUID(), attributeId, value: converted, editLevel: 'Definition' });
  };
  if (kind === 'Item' && Object.prototype.hasOwnProperty.call(source.data, 'price')) add('price', source.data.price);
  if (Array.isArray(source.data.attributes)) {
    for (const attribute of source.data.attributes) {
      if (!record(attribute) || typeof attribute.key !== 'string' || !Object.prototype.hasOwnProperty.call(attribute, 'value')) {
        issues.push('Обнаружена некорректная запись атрибута; она пропущена.');
        continue;
      }
      if (kind === 'Item' && attribute.key === 'price' && Object.prototype.hasOwnProperty.call(source.data, 'price')) {
        issues.push('«price»: вложенное значение пропущено — используется цена из основного поля.');
        continue;
      }
      add(attribute.key, attribute.value);
    }
  } else if (source.data.attributes !== undefined) issues.push('Список атрибутов имеет некорректный формат.');
  return { attributes, issues };
}

export function schemaInputs(existing: CatalogAttributeInput[], proposals: LegacyCatalogAttribute[], choices: Record<string, { included: boolean; typeKey: CatalogAttributeType }>, choiceOptions: LegacyCatalogChoiceOptions): CatalogAttributeInput[] {
  return [...existing, ...proposals.filter(item => choices[item.key]?.included).map(item => {
    const typeKey = item.price ? 'integer' : choices[item.key]?.typeKey ?? 'string';
    return { title: item.title, typeKey, options: typeKey === 'singleChoice' || typeKey === 'multiChoice' ? choiceOptions[item.key] ?? [] : [] };
  })];
}

export function metadataForLegacy(kind: CatalogKind, source: LegacyObject): Pick<CatalogMetadata, 'name' | 'isHidden' | 'quantityUnit' | 'allowNegative'> {
  return { name: source.name, isHidden: source.data.isSecret === true, quantityUnit: kind === 'Item' ? 'Whole' : null, allowNegative: false };
}
