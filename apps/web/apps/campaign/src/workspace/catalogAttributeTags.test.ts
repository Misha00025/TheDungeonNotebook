import { describe, expect, it } from 'vitest';
import { LosslessNumber } from 'lossless-json';
import { catalogAttributeTags } from './catalogAttributeTags';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';

const definition = (id: string, title: string, typeKey: CatalogAttributeDefinition['typeKey'], options: CatalogAttributeDefinition['options'] = [], isActive = true): CatalogAttributeDefinition => ({
  id,
  title,
  typeKey,
  typeRevision: 1,
  options,
  isActive,
});

const occurrence = (id: string, attributeId: string, typeKey: CatalogAttributeOccurrence['typeKey'], value: CatalogAttributeOccurrence['value'], typeRevision = 1): CatalogAttributeOccurrence => ({
  id,
  attributeId,
  typeKey,
  typeRevision,
  value,
  editLevel: 'Definition',
});

describe('catalog attribute tags', () => {
  it('groups repeated values in order and preserves typed and lossless display values', () => {
    const definitions = [
      definition('attribute-type', 'Тип', 'string'),
      definition('attribute-flag', 'Флаг', 'boolean'),
      definition('attribute-zero', 'Ноль', 'integer'),
      definition('attribute-large', 'Большое число', 'integer'),
      definition('attribute-choice', 'Выбор', 'multiChoice', [
        { optionKey: 'option-weapon', title: 'Оружие' },
        { optionKey: 'option-ranged', title: 'Дальнобойное' },
      ]),
      definition('attribute-empty', 'Пустое', 'string'),
      definition('attribute-empty-choice', 'Пустой выбор', 'multiChoice', []),
    ];
    const tags = catalogAttributeTags(definitions, [
      occurrence('occurrence-type-1', 'attribute-type', 'string', 'Оружие'),
      occurrence('occurrence-type-2', 'attribute-type', 'string', 'Одноручное'),
      occurrence('occurrence-type-3', 'attribute-type', 'string', 'Древковое'),
      occurrence('occurrence-flag', 'attribute-flag', 'boolean', false),
      occurrence('occurrence-zero', 'attribute-zero', 'integer', 0),
      occurrence('occurrence-large', 'attribute-large', 'integer', new LosslessNumber('9007199254740993')),
      occurrence('occurrence-choice', 'attribute-choice', 'multiChoice', ['option-weapon', 'option-ranged']),
      occurrence('occurrence-empty', 'attribute-empty', 'string', ''),
      occurrence('occurrence-empty-choice', 'attribute-empty-choice', 'multiChoice', []),
    ]);

    expect(tags).toEqual([
      { attributeId: 'attribute-type', title: 'Тип', values: ['Оружие', 'Одноручное', 'Древковое'] },
      { attributeId: 'attribute-flag', title: 'Флаг', values: ['Нет'] },
      { attributeId: 'attribute-zero', title: 'Ноль', values: ['0'] },
      { attributeId: 'attribute-large', title: 'Большое число', values: ['9007199254740993'] },
      { attributeId: 'attribute-choice', title: 'Выбор', values: ['Оружие', 'Дальнобойное'] },
      { attributeId: 'attribute-empty', title: 'Пустое', values: ['Не задано'] },
      { attributeId: 'attribute-empty-choice', title: 'Пустой выбор', values: ['Не выбрано'] },
    ]);
  });

  it('uses safe labels for unknown and stale choices and keeps equal-title attributes separate', () => {
    const definitions = [
      definition('attribute-one', 'Общее имя', 'singleChoice', [{ optionKey: 'known-option', title: 'Известно' }]),
      definition('attribute-two', 'Общее имя', 'string'),
      definition('attribute-stale', 'Устаревший выбор', 'singleChoice', [{ optionKey: 'current-option', title: 'Текущий вариант' }]),
      definition('attribute-inactive', 'Неактивный', 'string', [], false),
    ];
    const tags = catalogAttributeTags(definitions, [
      occurrence('private-occurrence-id', 'unknown-attribute-id', 'singleChoice', 'private-option-key'),
      occurrence('stale-occurrence-id', 'attribute-stale', 'singleChoice', 'private-stale-option', 2),
      occurrence('one-occurrence', 'attribute-one', 'singleChoice', 'known-option'),
      occurrence('two-occurrence', 'attribute-two', 'string', 'Сохранено'),
      occurrence('inactive-occurrence', 'attribute-inactive', 'string', 'Сохранённое значение'),
    ]);

    expect(tags).toEqual([
      { attributeId: 'unknown-attribute-id', title: 'Неизвестный атрибут', values: ['Неизвестный вариант'] },
      { attributeId: 'attribute-stale', title: 'Устаревший выбор', values: ['Неизвестный вариант'] },
      { attributeId: 'attribute-one', title: 'Общее имя', values: ['Известно'] },
      { attributeId: 'attribute-two', title: 'Общее имя', values: ['Сохранено'] },
      { attributeId: 'attribute-inactive', title: 'Неактивный', values: ['Сохранённое значение'] },
    ]);
    expect(JSON.stringify(tags)).not.toContain('private-');
  });
});
