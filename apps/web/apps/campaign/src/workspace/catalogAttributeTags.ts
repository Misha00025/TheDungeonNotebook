import { catalogValueLabel } from './catalogModel';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';

export type CatalogAttributeTag = { attributeId: string; title: string; values: string[] };

export function catalogAttributeTags(
  definitions: CatalogAttributeDefinition[],
  occurrences: CatalogAttributeOccurrence[],
): CatalogAttributeTag[] {
  const definitionsById = new Map(definitions.map(definition => [definition.id, definition]));
  const tags = new Map<string, CatalogAttributeTag>();

  for (const occurrence of occurrences) {
    const definition = definitionsById.get(occurrence.attributeId);
    if (!definition) continue;
    const tag = tags.get(occurrence.attributeId) ?? {
      attributeId: occurrence.attributeId,
      title: definition.title,
      values: [],
    };
    if (!tags.has(occurrence.attributeId)) tags.set(occurrence.attributeId, tag);

    if (definition.typeKey === 'multiChoice') {
      if (Array.isArray(occurrence.value)) {
        if (occurrence.value.length === 0) tag.values.push('Не выбрано');
        else tag.values.push(...occurrence.value.map(value => typeof value === 'string'
          ? catalogValueLabel([value], definition)
          : 'Неизвестный вариант'));
      } else {
        tag.values.push('Неизвестный вариант');
      }
    } else if (definition.typeKey === 'singleChoice') {
      tag.values.push(typeof occurrence.value === 'string'
        ? catalogValueLabel(occurrence.value, definition)
        : 'Неизвестный вариант');
    } else {
      const label = catalogValueLabel(occurrence.value, definition);
      tag.values.push(typeof occurrence.value === 'string' && occurrence.value === '' ? 'Не задано' : label);
    }
  }

  return [...tags.values()];
}
