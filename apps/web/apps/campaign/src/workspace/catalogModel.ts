import type { JsonValue, ValueType } from './types';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogAttributeType, CatalogEditLevel, CatalogGroupCondition } from './catalogTypes';
import { displayValue } from './json';
import { validateFieldValue } from './ValueInput';

const valueTypeMap: Record<CatalogAttributeType, ValueType> = {
  integer: 'Integer',
  number: 'Number',
  string: 'String',
  boolean: 'Boolean',
  singleChoice: 'SingleChoice',
  multiChoice: 'MultiChoice',
};

export function catalogValueType(typeKey: string): ValueType | undefined {
  return Object.prototype.hasOwnProperty.call(valueTypeMap, typeKey)
    ? valueTypeMap[typeKey as CatalogAttributeType]
    : undefined;
}

export function defaultTypedValue(typeKey: string, options: CatalogAttributeDefinition['options']): JsonValue | undefined {
  switch (typeKey) {
    case 'integer':
    case 'number': return 0;
    case 'string': return '';
    case 'boolean': return false;
    case 'singleChoice': return options[0]?.optionKey ?? '';
    case 'multiChoice': return [];
    default: return undefined;
  }
}

export function catalogAttributeField(definition?: CatalogAttributeDefinition): { valueType: ValueType; options: CatalogAttributeDefinition['options'] } | undefined {
  if (!definition) return undefined;
  const valueType = catalogValueType(definition.typeKey);
  return valueType ? { valueType, options: definition.options } : undefined;
}

export function catalogAttributeIssue(definition: CatalogAttributeDefinition | undefined, occurrence: CatalogAttributeOccurrence): string | undefined {
  if (!definition) return 'Характеристика удалена или недоступна.';
  const field = catalogAttributeField(definition);
  return field ? validateFieldValue(field, occurrence.value) : 'Характеристика удалена или недоступна.';
}

export function catalogValueLabel(value: JsonValue, definition?: CatalogAttributeDefinition): string {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (definition?.typeKey === 'singleChoice' && typeof value === 'string') {
    return definition.options.find(option => option.optionKey === value)?.title ?? 'Неизвестный вариант';
  }
  if (definition?.typeKey === 'multiChoice' && Array.isArray(value)) {
    return value.map(item => typeof item === 'string'
      ? definition.options.find(option => option.optionKey === item)?.title ?? 'Неизвестный вариант'
      : displayValue(item)).join(', ');
  }
  return displayValue(value);
}

export function createCatalogOccurrence(
  definition: CatalogAttributeDefinition,
  editLevel: CatalogEditLevel,
  value = defaultTypedValue(definition.typeKey, definition.options),
): CatalogAttributeOccurrence | undefined {
  if (value === undefined) return undefined;
  return {
    id: crypto.randomUUID(),
    attributeId: definition.id,
    value,
    editLevel,
  };
}

export function createConditionLeaf(
  operator: 'exists' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte',
  definition?: CatalogAttributeDefinition,
): CatalogGroupCondition {
  if (operator === 'exists') return { operator, ...(definition ? { attributeId: definition.id } : {}) };
  const value = definition && defaultTypedValue(definition.typeKey, definition.options);
  return {
    operator,
    ...(definition ? { attributeId: definition.id } : {}),
    ...(value !== undefined ? { value } : {}),
  };
}
