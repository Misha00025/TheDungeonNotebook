import { isLosslessNumber } from 'lossless-json';
import type { JsonValue } from './types';
import type { CatalogAttributeInput, CatalogAttributeOccurrence, CatalogAttributeType, CatalogKind, CatalogMetadata } from './catalogTypes';
import type { LegacyObject } from './legacyDiscovery';
import { stringifyJson } from './json';

export type LegacyCatalogAttribute = { key: string; title: string; typeKey: CatalogAttributeType; price: boolean };
export type LegacyCatalogSelections = Record<CatalogKind, Set<number>>;
export type LegacyCatalogAttributeChoices = Record<CatalogKind, Record<string, { included: boolean; typeKey: CatalogAttributeType }>>;

const record = (value: JsonValue): value is Record<string, JsonValue> => value !== null && typeof value === 'object' && !Array.isArray(value) && !isLosslessNumber(value);
const minInt64 = -9223372036854775808n;
const maxInt64 = 9223372036854775807n;

function exactInteger(value: JsonValue): boolean {
  if (typeof value !== 'number' && !isLosslessNumber(value)) return false;
  const raw = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) return false;
  const exponent = Number(match[4] ?? '0');
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) return false;
  let digits = `${match[2]}${match[3] ?? ''}`.replace(/^0+/, '') || '0';
  if (digits === '0') return true;
  const shift = exponent - (match[3]?.length ?? 0);
  if (shift < 0) {
    const remove = -shift;
    if (remove >= digits.length || !digits.endsWith('0'.repeat(remove))) return false;
    digits = digits.slice(0, -remove) || '0';
  } else if (shift > 0) {
    if (digits !== '0' && digits.length + shift > 19) return false;
    digits += '0'.repeat(shift);
  }
  const integer = BigInt(`${match[1]}${digits}`);
  return integer >= minInt64 && integer <= maxInt64;
}

function isJsonNumber(value: JsonValue): boolean {
  return (typeof value === 'number' && Number.isFinite(value))
    || isLosslessNumber(value) && Number.isFinite(Number(String(value)));
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

export function catalogImportOccurrences(kind: CatalogKind, source: LegacyObject, choices: Record<string, { included: boolean; typeKey: CatalogAttributeType }>, attributeIds: Map<string, string>): { attributes: CatalogAttributeOccurrence[]; issues: string[] } {
  const attributes: CatalogAttributeOccurrence[] = [];
  const issues: string[] = [];
  const add = (key: string, value: JsonValue) => {
    const choice = choices[key];
    if (!choice?.included) return;
    const attributeId = attributeIds.get(key);
    if (!attributeId) { issues.push(`«${key}»: схема не вернула созданный атрибут.`); return; }
    let converted: JsonValue = value;
    const typeKey = kind === 'Item' && key === 'price' ? 'integer' : choice.typeKey;
    if (typeKey === 'integer' && !exactInteger(value)) {
      issues.push(`«${key}»: значение пропущено — требуется целое JSON-число в диапазоне Int64.`);
      return;
    }
    if (typeKey === 'number' && !isJsonNumber(value)) {
      issues.push(`«${key}»: значение пропущено — требуется конечное JSON-число.`);
      return;
    }
    if (typeKey === 'boolean' && typeof value !== 'boolean') {
      issues.push(`«${key}»: значение пропущено — требуется JSON-логическое значение.`);
      return;
    }
    if (typeKey === 'string') converted = typeof value === 'string' ? value : stringifyJson(value);
    else if (typeKey !== 'integer' && typeKey !== 'number' && typeKey !== 'boolean') {
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

export function schemaInputs(existing: CatalogAttributeInput[], proposals: LegacyCatalogAttribute[], choices: Record<string, { included: boolean; typeKey: CatalogAttributeType }>): CatalogAttributeInput[] {
  return [...existing, ...proposals.filter(item => choices[item.key]?.included).map(item => ({ title: item.title, typeKey: item.price ? 'integer' : choices[item.key]?.typeKey ?? 'string', options: [] }))];
}

export function metadataForLegacy(kind: CatalogKind, source: LegacyObject): Pick<CatalogMetadata, 'name' | 'isHidden' | 'quantityUnit' | 'allowNegative'> {
  return { name: source.name, isHidden: source.data.isSecret === true, quantityUnit: kind === 'Item' ? 'Whole' : null, allowNegative: false };
}
