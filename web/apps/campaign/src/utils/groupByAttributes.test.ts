import { groupByAttributes } from './groupByAttributes';

interface TestItem {
  name: string;
  attributes?: Array<{ name: string; value: string }>;
}

describe('groupByAttributes', () => {
  it('returns a single group for empty items', () => {
    const result = groupByAttributes<TestItem>([], ['type']);
    expect(result).toEqual([{ id: 'all', name: 'Все элементы', items: [], children: [] }]);
  });

  it('returns a single group for empty attribute names', () => {
    const items: TestItem[] = [{ name: 'item1' }];
    const result = groupByAttributes(items, []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Все элементы');
    expect(result[0].items).toEqual(items);
  });

  it('groups items by a single attribute', () => {
    const items: TestItem[] = [
      { name: 'sword', attributes: [{ name: 'type', value: 'weapon' }] },
      { name: 'shield', attributes: [{ name: 'type', value: 'armor' }] },
    ];
    const result = groupByAttributes(items, ['type']);
    expect(result).toHaveLength(2);
    // Should be sorted alphabetically: "armor" before "weapon"
    expect(result[0].name).toContain('armor');
    expect(result[1].name).toContain('weapon');
  });

  it('creates nested groups for multiple attributes', () => {
    const items: TestItem[] = [
      { name: 'sword', attributes: [{ name: 'type', value: 'weapon' }, { name: 'rarity', value: 'rare' }] },
    ];
    const result = groupByAttributes(items, ['type', 'rarity']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('weapon');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].name).toContain('rare');
    expect(result[0].children[0].items).toHaveLength(1);
  });

  it('places items without attribute in "Не задано" group', () => {
    const items: TestItem[] = [
      { name: 'unknown', attributes: [] },
    ];
    const result = groupByAttributes(items, ['type']);
    expect(result[0].name).toContain('Не задано');
  });

  it('handles items with undefined attributes', () => {
    const items: TestItem[] = [
      { name: 'no-attributes' },
    ];
    const result = groupByAttributes(items, ['type']);
    expect(result[0].name).toContain('Не задано');
  });

  it('sorts integer values numerically, not lexicographically', () => {
    const items: TestItem[] = [
      { name: 'a', attributes: [{ name: 'level', value: '10' }] },
      { name: 'b', attributes: [{ name: 'level', value: '2' }] },
      { name: 'c', attributes: [{ name: 'level', value: '1' }] },
    ];
    const result = groupByAttributes(items, ['level']);
    expect(result[0].name).toContain('1');
    expect(result[1].name).toContain('2');
    expect(result[2].name).toContain('10');
  });

  it('puts "Не задано" groups at the end', () => {
    const items: TestItem[] = [
      { name: 'known', attributes: [{ name: 'type', value: 'weapon' }] },
      { name: 'unknown', attributes: [] },
    ];
    const result = groupByAttributes(items, ['type']);
    expect(result[result.length - 1].name).toContain('Не задано');
  });
});
