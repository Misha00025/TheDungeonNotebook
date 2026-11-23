import { compareNumber, isLosslessNumber, splitNumber } from 'lossless-json';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogGroupCondition } from './catalogTypes';
import type { JsonNumber, JsonValue } from './types';
import { catalogAttributeField } from './catalogModel';
import { validateFieldValue } from './ValueInput';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) && !isLosslessNumber(value);

export function isCatalogCondition(value: unknown): value is CatalogGroupCondition {
  if (!isRecord(value)) return false;
  const operators = ['all', 'any', 'not', 'exists', 'eq', 'contains', 'gt', 'gte', 'lt', 'lte'];
  if (typeof value.operator !== 'string' || !operators.includes(value.operator)) return false;
  if ('attributeId' in value && typeof value.attributeId !== 'string') return false;
  return !('children' in value) || Array.isArray(value.children) && value.children.every(isCatalogCondition);
}

type CompiledNode = (attributes: CatalogAttributeOccurrence[]) => boolean;
type CompiledFilter = { error?: string; test: (attributes: CatalogAttributeOccurrence[]) => boolean | undefined };
const invalidFilter = (): CompiledFilter => ({ error: 'Условие каталога несовместимо с текущей схемой характеристик.', test: () => undefined });
const isNumberValue = (value: JsonValue): value is JsonNumber => typeof value === 'number' || isLosslessNumber(value);

function compareExact(left: JsonValue, right: JsonValue): number {
  if (!isNumberValue(left) || !isNumberValue(right)) return 0;
  const a = splitNumber(String(left));
  const b = splitNumber(String(right));
  if (a.digits === '0' && b.digits === '0') return 0;
  if (a.digits === '0') return b.sign === '-' ? 1 : -1;
  if (b.digits === '0') return a.sign === '-' ? -1 : 1;
  return compareNumber(String(left), String(right));
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  if (isNumberValue(left) && isNumberValue(right)) return compareExact(left, right) === 0;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => jsonEqual(item, right[index]));
  return typeof left === typeof right && left === right;
}

export function compileCatalogFilter(condition: CatalogGroupCondition | null, definitions: CatalogAttributeDefinition[]): CompiledFilter {
  if (condition === null) return { test: () => true };
  if (!isCatalogCondition(condition)) return invalidFilter();

  const definitionById = new Map(definitions.map(definition => [definition.id, definition]));
  const referencedTypedIds = new Set<string>();
  let invalid = false;

  const compileNode = (node: CatalogGroupCondition): CompiledNode => {
    if (node.operator === 'all' || node.operator === 'any' || node.operator === 'not') {
      if (node.attributeId !== undefined || node.value !== undefined || !Array.isArray(node.children)
        || node.children.length < 1 || node.operator === 'not' && node.children.length !== 1) {
        invalid = true;
        return () => false;
      }
      const children = node.children!.map(compileNode);
      if (node.operator === 'all') return attributes => children.every(child => child(attributes));
      if (node.operator === 'any') return attributes => children.some(child => child(attributes));
      return attributes => !children[0](attributes);
    }

    if (typeof node.attributeId !== 'string' || node.attributeId.length === 0 || node.children !== undefined
      || node.operator === 'exists' && node.value !== undefined
      || node.operator !== 'exists' && node.value === undefined) {
      invalid = true;
      return () => false;
    }

    const definition = definitionById.get(node.attributeId);
    if (!definition) { invalid = true; return () => false; }
    if (node.operator === 'exists') return attributes => attributes.some(attribute => attribute.attributeId === definition.id);

    let field = catalogAttributeField(definition);
    if (node.operator === 'contains') {
      if (definition.typeKey === 'multiChoice') field = { valueType: 'SingleChoice', options: definition.options };
      else if (definition.typeKey !== 'string') { invalid = true; return () => false; }
      if (typeof node.value !== 'string') { invalid = true; return () => false; }
    }
    if (node.operator === 'gt' || node.operator === 'gte' || node.operator === 'lt' || node.operator === 'lte') {
      if (definition.typeKey !== 'integer' && definition.typeKey !== 'number') { invalid = true; return () => false; }
    }
    if (!field || validateFieldValue(field, node.value!) !== undefined) { invalid = true; return () => false; }
    referencedTypedIds.add(definition.id);
    const expected = node.value!;
    if (node.operator === 'contains') {
      return attributes => attributes.some(attribute => attribute.attributeId === definition.id && (
        definition.typeKey === 'string'
          ? typeof attribute.value === 'string' && attribute.value.includes(expected as string)
          : Array.isArray(attribute.value) && attribute.value.some(value => value === expected)
      ));
    }
    if (node.operator === 'gt' || node.operator === 'gte' || node.operator === 'lt' || node.operator === 'lte') {
      return attributes => attributes.some(attribute => {
        if (attribute.attributeId !== definition.id || !isNumberValue(attribute.value)) return false;
        const comparison = compareExact(attribute.value, expected);
        return node.operator === 'gt' ? comparison > 0 : node.operator === 'gte' ? comparison >= 0 : node.operator === 'lt' ? comparison < 0 : comparison <= 0;
      });
    }
    return attributes => attributes.some(attribute => attribute.attributeId === definition.id && jsonEqual(attribute.value, expected));
  };

  const compiled = compileNode(condition);
  if (invalid) return invalidFilter();
  return {
    test: attributes => {
      for (const attribute of attributes) {
        if (!referencedTypedIds.has(attribute.attributeId)) continue;
        const definition = definitionById.get(attribute.attributeId);
        const field = catalogAttributeField(definition);
        if (!attribute.id || (attribute.editLevel !== 'Definition' && attribute.editLevel !== 'Character')
          || !field || validateFieldValue(field, attribute.value) !== undefined) return undefined;
      }
      return compiled(attributes);
    },
  };
}
