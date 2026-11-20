import { describe, expect, it } from 'vitest';
import { discoverLegacyExport } from './legacyDiscovery';
import { isLosslessNumber } from 'lossless-json';
import { stringifyJson } from './json';

describe('discoverLegacyExport', () => {
  it('discovers v1 records and preserves their original values without filling missing fields', () => {
    const report = discoverLegacyExport(`{
      "version":1,"exportedAt":"not parsed",
      "characters":[{"oldId":0,"templateOldId":10,"name":"Hero","description":"Plain text","fields":{"level":{"name":"Level","value":false},"empty":{"name":"Empty","value":""}}}],
      "charlists":[{"oldId":10,"name":"Template","fields":{"level":{"name":"Level","value":0},"omitted":{"name":"Omitted","value":5},"big":{"name":"Big","value":9223372036854775807},"precise":{"name":"Precise","value":0.1234567890123456789,"formula":"1 + 2","modifierFormula":"raw modifier","maxValue":999}}}],
      "items":[{"oldId":20,"name":"Item","price":0,"attributes":[{"key":"weight","value":false}]}],
      "skills":[{"oldId":30,"name":"Skill","attributes":[{"key":"rank","value":""}]}],
      "characterItems":[{"characterOldId":0,"itemOldId":20,"amount":0}],
      "characterSkills":[{"characterOldId":0,"skillOldId":30}],
      "skillAttributes":{"attributes":[{"name":"Rank","key":"rank","description":"Rank description","isFiltered":false,"knownValues":["A"]}]},
      "templateSchema":{"categories":[{"key":"root","name":"Root","fields":["level"],"categories":[{"key":"child","name":"Child","fields":["omitted"]}]}]}
    }`);
    const section = (key: string) => report.sections.find(item => item.key === key)!;
    const hero = section('characters').objects[0];
    const template = section('charlists').objects[0];
    const item = section('items').objects[0];
    const skill = section('skills').objects[0];
    expect(hero.name).toBe('Hero');
    expect(hero.properties).toContainEqual({ name: 'Шаблон', value: 'Template' });
    expect(hero.fields.map(field => field.key)).toEqual(['level', 'empty']);
    expect(hero.fields[0].data.value).toBe(false);
    expect(template.fields.find(field => field.key === 'level')?.data.value).toBe(0);
    expect(template.fields.some(field => field.key === 'omitted')).toBe(true);
    expect(hero.fields.some(field => field.key === 'omitted')).toBe(false);
    const big = template.fields.find(field => field.key === 'big')!.data.value;
    const precise = template.fields.find(field => field.key === 'precise')!.data;
    expect(isLosslessNumber(big)).toBe(true);
    expect(isLosslessNumber(precise.value)).toBe(true);
    expect(stringifyJson({ big, precise: precise.value })).toContain('9223372036854775807');
    expect(stringifyJson({ big, precise: precise.value })).toContain('0.1234567890123456789');
    expect(precise).toMatchObject({ formula: '1 + 2', modifierFormula: 'raw modifier', maxValue: 999 });
    expect(item.properties).toContainEqual({ name: 'weight', value: false });
    expect(skill.properties).toContainEqual({ name: 'rank', value: '' });
    expect(section('characterItems').objects[0].name).toBe('Hero — Item');
    expect(section('characterItems').objects[0].properties).toContainEqual({ name: 'Количество', value: 0 });
    expect(section('characterSkills').objects[0].name).toBe('Hero — Skill');
    expect(section('skillAttributes').objects[0].properties).toContainEqual({ name: 'Фильтрация', value: false });
    expect(section('templateSchema').objects.map(object => object.name)).toEqual(['Root', 'Root / Child']);
    expect(report.exportedAt).toBe('not parsed');
  });

  it('distinguishes absent and empty sections while retaining valid records and reporting unresolved references', () => {
    const report = discoverLegacyExport(`{
      "version":1,"extraCatalog":{"private":"not shown"},
      "characters":[{"oldId":2,"name":"First","fields":{}},{"oldId":2,"name":"Second","fields":{}},null],
      "charlists":[],"skills":false,
      "items":[{"oldId":4,"name":"Blade"}],
      "characterItems":[{"characterOldId":2,"itemOldId":4},{"characterOldId":2,"itemOldId":4},{"characterOldId":99,"itemOldId":4}],
      "characterSkills":[{"characterOldId":2,"skillOldId":7}]
    }`);
    const section = (key: string) => report.sections.find(item => item.key === key)!;
    expect(section('characters')).toMatchObject({ present: true, total: 3 });
    expect(section('characters').objects).toHaveLength(2);
    expect(section('charlists')).toMatchObject({ present: true, total: 0, objects: [] });
    expect(section('templateSchema')).toMatchObject({ present: false, total: 0 });
    expect(section('skills')).toMatchObject({ present: true, total: 0, objects: [] });
    expect(section('characterItems').objects).toHaveLength(3);
    expect(section('characterItems').objects[0].name).toContain('Неоднозначная ссылка на персонажа');
    expect(section('characterItems').objects[2].name).toContain('Персонаж отсутствует в файле');
    expect(report.unknownSections).toContain('extraCatalog');
    expect(report.diagnostics.some(message => message.includes('некорректная запись'))).toBe(true);
    expect(report.diagnostics.some(message => message.includes('Повторяется назначение предмета'))).toBe(true);
    expect(report.diagnostics.some(message => message.includes('неоднозначна'))).toBe(true);
    expect(report.diagnostics.some(message => message.includes('не разрешается'))).toBe(true);
    expect(report.diagnostics.some(message => message.includes('некорректный формат'))).toBe(true);
  });

  it('rejects malformed inputs and accepts a BOM-prefixed v1 export', () => {
    expect(() => discoverLegacyExport('{')).toThrow('Файл не содержит корректный JSON.');
    expect(() => discoverLegacyExport('[]')).toThrow('Корень файла должен быть JSON-объектом.');
    expect(() => discoverLegacyExport('{"version":2}')).toThrow('Формат или версия файла не поддерживается.');
    expect(discoverLegacyExport('\uFEFF{"version":1}').version).toBe(1);
  });
});
