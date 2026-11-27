import { LosslessNumber } from 'lossless-json';
import { CampaignApiError } from './api';
import type { HeroImportApi, HeroDraft, HeroImportContext, HeroImportRun, HeroImportStep } from './heroImport';
import { createHeroDraft, executeHeroImport, prepareHeroImport, recheckHeroImport } from './heroImport';
import type { BaseField, CharacterMetadata, CharacterSheetEnvelope, TemplateContentEnvelope } from './types';
import type { LegacyObject } from './legacyDiscovery';
import type { CatalogMetadata, CharacterCatalogEntryEnvelope } from './catalogTypes';
import { collectHeroCatalogSources } from './heroImport';

const baseField = (id: string, key: string, valueType: BaseField['valueType'], value: BaseField['value']): BaseField => ({ id, key, title: key, description: '', valueType, typeRevision: 1, value, options: [] });
const template: TemplateContentEnvelope = { campaignId: 4, contentRevision: 7, data: { description: 'unchanged', baseFields: [baseField('field-a', 'a', 'Integer', 0), baseField('field-a2', 'a2', 'Integer', 0), baseField('field-a3', 'a3', 'Integer', 0), baseField('field-b', 'b', 'Boolean', false), baseField('field-c', 'c', 'String', 'default')], virtualFields: [] } };
const metadata = (id = 'existing'): CharacterMetadata => ({ id, campaignId: 4, name: 'Existing', importance: 'Key', metadataRevision: 3 });
const sheet = (revision = 1, values: Record<string, unknown> = {}): CharacterSheetEnvelope => ({
  contentRevision: revision,
  templateContentRevision: 7,
  description: 'old description',
  baseFields: template.data.baseFields.map(field => ({ id: field.id, key: field.key, title: field.title, description: field.description, valueType: field.valueType, typeRevision: field.typeRevision, options: field.options, effectiveValue: (values[field.id] ?? field.value) as BaseField['value'], isExplicit: Object.prototype.hasOwnProperty.call(values, field.id) }))
});
const hero = (name: string, fields: LegacyObject['fields'] = [], extra: Record<string, unknown> = {}): LegacyObject => ({ name, sourceId: 'old-id-not-target', data: { name, ...extra } as LegacyObject['data'], fields, properties: [] });
const valueField = (key: string, value: LegacyObject['data'][string], extra: Record<string, LegacyObject['data'][string]> = {}) => ({ key, name: key.toUpperCase(), data: { value, ...extra } });
const apiFactory = () => ({
  characterPermissions: vi.fn().mockResolvedValue({ canRead: true, canWrite: true, canManageAccess: false }),
  getCharacter: vi.fn().mockResolvedValue(metadata()),
  getSheet: vi.fn().mockResolvedValue(sheet()),
  getTemplateContent: vi.fn().mockResolvedValue(template),
  createCharacter: vi.fn(async (_campaignId: number, body: { requestId: string }) => metadata(body.requestId)),
  putCharacter: vi.fn().mockResolvedValue(metadata()),
  putDescription: vi.fn().mockResolvedValue({ contentRevision: 2 }),
  putTemplateContent: vi.fn(),
  putBaseValue: vi.fn().mockImplementation(async (_campaignId: number, _id: string, fieldId: string, body: { expectedRevision: number }) => sheet(body.expectedRevision + 1, { [fieldId]: 9 }))
});
const context = (targets: HeroImportContext['targets'] = {}): HeroImportContext => ({ template, targets });
const selectField = (draft: HeroDraft, key: string, targetId: string, action: HeroDraft['fields'][string]['action'] = 'replace') => {
  draft.fields[key] = { selected: true, targetId, action };
};
const execute = (api: HeroImportApi, plan: NonNullable<ReturnType<typeof prepareHeroImport>['plan']>, previous?: HeroImportRun) => executeHeroImport(api, 4, plan, previous, () => undefined, () => true);

describe('hero import planning and execution', () => {
  it('plans only chosen data and preserves native values while excluding legacy formulas and identifiers', async () => {
    const big = new LosslessNumber('9007199254740993');
    const sources = [hero('Picked', [valueField('a', 0, { formula: 'roll()', modifierFormula: 'mod()', maxValue: 50 }), valueField('b', false), valueField('c', '')], { description: '' }), hero('Unselected', [valueField('a', 8)])];
    const draft = createHeroDraft(sources[0], 0);
    draft.selected = true; draft.targetMode = 'new'; draft.newName = 'New hero'; draft.importance = 'Key'; draft.selectDescription = true; draft.descriptionAction = 'replace';
    selectField(draft, 'a', 'field-a'); selectField(draft, 'b', 'field-b'); selectField(draft, 'c', 'field-c');
    const skippedDraft = createHeroDraft(sources[1], 1);
    skippedDraft.selected = false;
    const result = prepareHeroImport(sources, [draft, skippedDraft], context(), { 0: 'stable-uuid' });
    expect(result.errors).toEqual([]);
    expect(result.plan?.steps.map(step => step.kind)).toEqual(['create', 'description', 'value', 'value', 'value']);
    expect(result.plan?.steps[0]).toMatchObject({ targetKey: 'stable-uuid', kind: 'create', name: 'New hero', importance: 'Key' });
    const values = result.plan?.steps.filter((step): step is Extract<HeroImportStep, { kind: 'value' }> => step.kind === 'value');
    expect(values?.map(step => step.value)).toEqual([0, false, '']);
    expect(sources[0].fields[0].data).toEqual(expect.objectContaining({ formula: 'roll()', modifierFormula: 'mod()', maxValue: 50 }));
    const api = apiFactory();
    api.getSheet.mockResolvedValue(sheet(1));
    expect(api.createCharacter).not.toHaveBeenCalled();
    const plan = result.plan!;
    const run = await execute(api, plan);
    expect(api.createCharacter).toHaveBeenCalledWith(4, { requestId: 'stable-uuid', name: 'New hero', importance: 'Key' });
    expect(api.putDescription).toHaveBeenCalledWith(4, 'stable-uuid', { description: '', expectedRevision: 1 });
    expect(api.putBaseValue.mock.calls.map(call => call[3].value)).toEqual([0, false, '']);
    expect(api.putCharacter).not.toHaveBeenCalled();
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(run.targets['stable-uuid'].metadata.id).toBe('stable-uuid');

    const exact = hero('Exact', [valueField('exact', big)]);
    const exactDraft = createHeroDraft(exact, 0);
    exactDraft.selected = true; exactDraft.targetMode = 'new'; exactDraft.newName = 'Exact'; selectField(exactDraft, 'exact', 'field-a');
    const exactResult = prepareHeroImport([exact], [exactDraft], context(), { 0: 'id' });
    expect(exactResult.plan?.steps.at(-1)).toMatchObject({ kind: 'value', value: big });
  });

  it('rejects conflicting replacements and permits an unmapped field only when skipped', () => {
    const source = hero('One', [valueField('a', 1), valueField('another', 2)]);
    const draft = createHeroDraft(source, 0);
    draft.selected = true; draft.targetMode = 'existing'; draft.targetId = 'existing';
    selectField(draft, 'a', 'field-a'); selectField(draft, 'another', 'field-a');
    expect(prepareHeroImport([source], [draft], context({ existing: { metadata: metadata(), sheet: sheet() } }), {}).errors).toContain('Несколько выбранных изменений затрагивают одну цель: ANOTHER.');
    selectField(draft, 'another', '', 'skip');
    expect(prepareHeroImport([source], [draft], context({ existing: { metadata: metadata(), sheet: sheet() } }), {}).errors).toEqual([]);
    selectField(draft, 'another', '', 'replace');
    expect(prepareHeroImport([source], [draft], context({ existing: { metadata: metadata(), sheet: sheet() } }), {}).errors).toContain('Поле «ANOTHER» не совместимо с выбранным целевым полем.');
    const second = createHeroDraft(hero('Two'), 1);
    second.selected = true;
    const multiple = prepareHeroImport([source, hero('Two')], [draft, second], context(), {});
    expect(multiple.plan).toBeUndefined();
    expect(multiple.errors).toContain('Выберите одного персонажа для импорта');
  });

  it('creates a new target before description and values, advancing each content revision', async () => {
    const source = hero('New', [valueField('a', 11)], { description: 'new description' });
    const draft = createHeroDraft(source, 0);
    draft.selected = true; draft.targetMode = 'new'; draft.newName = 'New'; draft.selectDescription = true; draft.descriptionAction = 'replace'; selectField(draft, 'a', 'field-a');
    const plan = prepareHeroImport([source], [draft], context(), { 0: 'new-uuid' }).plan!;
    const api = apiFactory();
    api.getSheet.mockResolvedValue(sheet(1));
    api.putDescription.mockResolvedValue({ contentRevision: 2 });
    api.putBaseValue.mockResolvedValue(sheet(3, { 'field-a': 11 }));
    const run = await execute(api, plan);
    expect(api.characterPermissions).not.toHaveBeenCalled();
    expect(api.getCharacter).not.toHaveBeenCalled();
    expect(api.getSheet).toHaveBeenCalledWith(4, 'new-uuid');
    expect(api.putDescription).toHaveBeenCalledWith(4, 'new-uuid', { description: 'new description', expectedRevision: 1 });
    expect(api.putBaseValue).toHaveBeenCalledWith(4, 'new-uuid', 'field-a', { value: 11, expectedRevision: 2 });
    expect(run.statuses['0:create']).toBe('applied');
    expect(run.targets['new-uuid'].sheet.contentRevision).toBe(3);
  });

  it('preserves importance and serializes one hero’s selected fields against advancing revisions', async () => {
    const source = hero('One', [valueField('a', 10), valueField('a2', 20)], { name: 'Renamed' });
    const draft = createHeroDraft(source, 0);
    draft.selected = true; draft.targetMode = 'existing'; draft.targetId = 'existing'; selectField(draft, 'a', 'field-a'); selectField(draft, 'a2', 'field-a2');
    draft.selectName = true; draft.nameAction = 'replace';
    const plan = prepareHeroImport([source], [draft], context({ existing: { metadata: metadata(), sheet: sheet() } }), {}).plan!;
    const api = apiFactory();
    api.putCharacter.mockResolvedValue({ ...metadata(), name: 'Renamed', metadataRevision: 4 });
    api.getSheet.mockResolvedValue(sheet(1));
    api.putBaseValue
      .mockResolvedValueOnce(sheet(2, { 'field-a': 10 }))
      .mockResolvedValueOnce(sheet(3, { 'field-a': 10, 'field-a2': 20 }));
    const run = await execute(api, plan);
    expect(api.putCharacter).toHaveBeenCalledWith(4, 'existing', { name: 'Renamed', importance: 'Key', expectedRevision: 3 });
    expect(api.putBaseValue.mock.calls.map(call => [call[2], call[3].expectedRevision])).toEqual([['field-a', 1], ['field-a2', 2]]);
    expect(api.createCharacter).not.toHaveBeenCalled();
    expect(run.targets.existing.sheet.contentRevision).toBe(3);

    const skipped = createHeroDraft(source, 0);
    skipped.selected = true; skipped.targetMode = 'existing'; skipped.targetId = 'existing'; selectField(skipped, 'a', '', 'skip');
    const noop = prepareHeroImport([source], [skipped], context({ existing: { metadata: metadata(), sheet: sheet() } }), {});
    expect(noop.plan).toBeUndefined();
    expect(noop.errors).toContain('Выберите данные для импорта');
  });

  it('recovers unknown creation without reposting and keeps uncertain updates pending after reads', async () => {
    const source = hero('Unknown', [valueField('a', 12)]);
    const draft = createHeroDraft(source, 0);
    draft.selected = true; draft.targetMode = 'new'; draft.newName = 'Unknown'; selectField(draft, 'a', 'field-a');
    const plan = prepareHeroImport([source], [draft], context(), { 0: 'stable-id' }).plan!;
    const api = apiFactory();
    api.createCharacter.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'Unknown' }, true));
    api.getCharacter.mockRejectedValueOnce(new CampaignApiError(404, { code: 'not_found', title: 'Missing', detail: 'Missing' })).mockResolvedValue(metadata('stable-id'));
    api.getSheet.mockResolvedValue(sheet(1));
    const first = await execute(api, plan);
    expect(first.statuses['0:create']).toBe('unknown');
    const missing = await recheckHeroImport(api, 4, plan, first, () => true);
    expect(missing.needsCheck).toBe(true);
    expect(api.getCharacter).toHaveBeenNthCalledWith(1, 4, 'stable-id');
    const confirmed = await recheckHeroImport(api, 4, plan, missing, () => true);
    expect(confirmed.statuses['0:create']).toBe('verified');
    const resumedPlan = prepareHeroImport([source], [draft], { template, targets: confirmed.targets }, { 0: 'stable-id' }, confirmed).plan!;
    await execute(api, resumedPlan, confirmed);
    expect(api.createCharacter).toHaveBeenCalledTimes(1);
    expect(api.putBaseValue).toHaveBeenCalledWith(4, 'stable-id', 'field-a', { value: 12, expectedRevision: 1 });

    const failedSheetApi = apiFactory();
    failedSheetApi.createCharacter.mockResolvedValue(metadata('stable-id'));
    failedSheetApi.getSheet.mockRejectedValueOnce(new Error('read failed')).mockResolvedValue(sheet(1));
    failedSheetApi.getCharacter.mockResolvedValue(metadata('stable-id'));
    const successfulPost = await execute(failedSheetApi, { ...plan, steps: [plan.steps[0]] });
    expect(successfulPost.statuses['0:create']).toBe('applied');
    expect(successfulPost.createdMetadata?.['stable-id'].id).toBe('stable-id');
    const recovered = await recheckHeroImport(failedSheetApi, 4, { ...plan, steps: [plan.steps[0]] }, successfulPost, () => true);
    expect(recovered.statuses['0:create']).toBe('verified');
  });

  it('retains partial progress, rechecks without writes, and resumes from fresh revisions', async () => {
    const source = hero('Partial', [valueField('a', 10), valueField('a2', 20), valueField('a3', 30)]);
    const draft = createHeroDraft(source, 0);
    draft.selected = true; draft.targetMode = 'existing'; draft.targetId = 'existing';
    selectField(draft, 'a', 'field-a'); selectField(draft, 'a2', 'field-a2'); selectField(draft, 'a3', 'field-a3');
    const target = { metadata: metadata(), sheet: sheet(1) };
    const plan = prepareHeroImport([source], [draft], context({ existing: target }), {}).plan!;
    const api = apiFactory();
    api.getSheet.mockResolvedValueOnce(sheet(1)).mockResolvedValueOnce(sheet(2, { 'field-a': 10, 'field-a2': 20 }));
    api.putBaseValue.mockResolvedValueOnce(sheet(2, { 'field-a': 10 })).mockRejectedValueOnce(new CampaignApiError(503, { code: 'write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, true));
    const partial = await execute(api, plan);
    expect(partial.statuses['0:value:a']).toBe('applied');
    expect(partial.statuses['0:value:a2']).toBe('unknown');
    expect(partial.statuses['0:value:a3']).toBe('pending');
    expect(api.putBaseValue).toHaveBeenCalledTimes(2);
    const afterRead = await recheckHeroImport(api, 4, plan, partial, () => true);
    expect(api.putBaseValue).toHaveBeenCalledTimes(2);
    expect(afterRead.statuses['0:value:a']).toBe('applied');
    expect(afterRead.statuses['0:value:a2']).toBe('pending');
    expect(afterRead.targets.existing.sheet.contentRevision).toBe(2);
    const updatedPlan = prepareHeroImport([source], [draft], { template: afterRead.template, targets: afterRead.targets }, {}, afterRead).plan!;
    api.getSheet.mockResolvedValueOnce(sheet(2, { 'field-a': 10, 'field-a2': 20 }));
    api.putBaseValue.mockResolvedValueOnce(sheet(3, { 'field-a': 10, 'field-a2': 20 })).mockResolvedValueOnce(sheet(4, { 'field-a': 10, 'field-a2': 20, 'field-a3': 30 }));
    await execute(api, updatedPlan, afterRead);
    expect(api.putBaseValue).toHaveBeenCalledTimes(4);
    expect(api.putBaseValue.mock.calls.slice(2).map(call => [call[2], call[3].expectedRevision])).toEqual([['field-a2', 2], ['field-a3', 3]]);

    const conflicted = apiFactory();
    conflicted.getTemplateContent.mockResolvedValue({ ...template, contentRevision: 8 });
    const conflictRun = await execute(conflicted, plan);
    expect(conflictRun.needsCheck).toBe(true);
    expect(conflicted.putBaseValue).not.toHaveBeenCalled();
  });

  it('imports combined legacy amounts as additional single-item records without changing existing records', async () => {
    const picked = hero('Picked');
    const other = hero('Other');
    picked.sourceId = '1';
    other.sourceId = '2';
    const itemDefinition: CatalogMetadata = { id: 'catalog-item', campaignId: 4, kind: 'Item', name: 'Potion', creatorUserId: null, isHidden: false, quantityUnit: 'Single', allowNegative: false, metadataRevision: 1 };
    const skillDefinition: CatalogMetadata = { id: 'catalog-skill', campaignId: 4, kind: 'Skill', name: 'Stealth', creatorUserId: null, isHidden: false, quantityUnit: 'Single', allowNegative: false, metadataRevision: 1 };
    const row = (characterOldId: number, amount: number): LegacyObject => ({
      name: 'Potion assignment',
      sourceId: undefined,
      data: { characterOldId, itemOldId: 42, amount } as LegacyObject['data'],
      fields: [],
      properties: []
    });
    const item = hero('Potion');
    item.sourceId = '42';
    const skill = hero('Stealth');
    skill.sourceId = '43';
    const skillRow: LegacyObject = { name: 'Stealth assignment', sourceId: undefined, data: { characterOldId: 1, skillOldId: 43 }, fields: [], properties: [] };
    const catalogSources = collectHeroCatalogSources(picked, [picked, other], [item], [skill], [row(1, 1), row(1, 3), row(2, 7)], [skillRow]);
    const source = catalogSources[0];
    const draft = createHeroDraft(picked, 0, catalogSources);
    draft.selected = true;
    draft.targetMode = 'existing';
    draft.targetId = 'existing';
    draft.selectItems = true;
    expect(draft.selectSkills).toBe(false);
    draft.catalogMappings[source.key] = itemDefinition.id;
    draft.catalogRequestNamespaces[source.key] = '123e4567-e89b-42d3-a456-426614174000';
    const skillSource = catalogSources.find(catalogSource => catalogSource.kind === 'Skill')!;
    draft.catalogMappings[skillSource.key] = skillDefinition.id;
    const existingEntry = (id: string): CharacterCatalogEntryEnvelope => ({
      record: { id, campaignId: 4, characterId: 'existing', catalogEntryId: itemDefinition.id, quantity: null, metadataRevision: 1 },
      definition: itemDefinition,
      definitionDescription: '',
      effectiveAttributes: [],
      explicitAttributes: [],
      definitionContentRevision: 1,
      localContentRevision: 1
    });
    const existingRecords = [existingEntry('record-a'), existingEntry('record-b')];
    const result = prepareHeroImport([picked, other], [draft], {
      ...context({ existing: { metadata: metadata(), sheet: sheet(), itemEntries: existingRecords, skillEntries: [] } }),
      itemDefinitions: [itemDefinition],
      skillDefinitions: [skillDefinition]
    }, {}, undefined, { 0: catalogSources });
    expect(result.errors).toEqual([]);
    const plan = result.plan!;
    expect(plan.steps.map(step => step.kind === 'catalog' ? step.catalogKind : step.kind)).toEqual(['Item']);
    expect(plan.steps[0]).toMatchObject({ kind: 'catalog', quantityUnit: 'Single', desiredAdds: 2 });
    expect(plan.steps[0].kind === 'catalog' ? String(plan.steps[0].amount) : '').toBe('4');
    const api = apiFactory() as ReturnType<typeof apiFactory> & {
      listCharacterEntries: ReturnType<typeof vi.fn>;
      addCharacterEntry: ReturnType<typeof vi.fn>;
    };
    api.listCharacterEntries = vi.fn(async (_campaignId: number, kind: string) => kind === 'Item' ? existingRecords : []);
    api.addCharacterEntry = vi.fn(async (_campaignId: number, _kind: string, _characterId: string, body: { requestId: string; catalogEntryId: string; attributes: [] }) => ({ requestId: body.requestId, entry: existingRecords[0] }));

    const run = await execute(api, plan);

    expect(run.statuses['0:catalog:Item:catalog-item']).toBe('applied');
    expect(api.addCharacterEntry).toHaveBeenCalledTimes(2);
    const calls = api.addCharacterEntry.mock.calls;
    expect(calls.map(call => call[1])).toEqual(['Item', 'Item']);
    expect(calls.map(call => call[3])).toEqual(plan.steps[0].kind === 'catalog'
      ? plan.steps[0].requestIds.map(requestId => ({ requestId, catalogEntryId: itemDefinition.id, attributes: [] }))
      : []);
    expect(calls.every(call => !Object.prototype.hasOwnProperty.call(call[3], 'quantity'))).toBe(true);
    const requestIds = calls.map(call => call[3].requestId);
    expect(new Set(requestIds).size).toBe(2);
    expect(requestIds.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))).toBe(true);
    expect(api.addCharacterEntry.mock.calls.map(call => call[3].catalogEntryId)).toEqual([itemDefinition.id, itemDefinition.id]);
    expect(existingRecords.map(entry => entry.record)).toEqual([
      expect.objectContaining({ id: 'record-a', quantity: null }),
      expect.objectContaining({ id: 'record-b', quantity: null })
    ]);
  });

  it('imports a selected legacy skill onto an existing character', async () => {
    const picked = hero('Picked');
    picked.sourceId = '1';
    const skill = hero('Stealth');
    skill.sourceId = '43';
    const skillRow: LegacyObject = { name: 'Stealth assignment', sourceId: undefined, data: { characterOldId: 1, skillOldId: 43 }, fields: [], properties: [] };
    const catalogSources = collectHeroCatalogSources(picked, [picked], [], [skill], [], [skillRow]);
    const skillSource = catalogSources.find(catalogSource => catalogSource.kind === 'Skill')!;
    const skillDefinition: CatalogMetadata = { id: 'catalog-skill', campaignId: 4, kind: 'Skill', name: 'Stealth', creatorUserId: null, isHidden: false, quantityUnit: 'Single', allowNegative: false, metadataRevision: 1 };
    const draft = createHeroDraft(picked, 0, catalogSources);
    draft.selected = true;
    draft.targetMode = 'existing';
    draft.targetId = 'existing';
    draft.selectSkills = true;
    draft.catalogMappings[skillSource.key] = skillDefinition.id;
    const result = prepareHeroImport([picked], [draft], {
      ...context({ existing: { metadata: metadata(), sheet: sheet(), itemEntries: [], skillEntries: [] } }),
      itemDefinitions: [],
      skillDefinitions: [skillDefinition]
    }, {}, undefined, { 0: catalogSources });
    expect(result.errors).toEqual([]);
    const plan = result.plan!;
    const store: CharacterCatalogEntryEnvelope[] = [];
    const api = apiFactory() as ReturnType<typeof apiFactory> & {
      listCharacterEntries: ReturnType<typeof vi.fn>;
      addCharacterEntry: ReturnType<typeof vi.fn>;
    };
    api.listCharacterEntries = vi.fn(async () => store);
    api.addCharacterEntry = vi.fn(async (_campaignId: number, _kind: string, characterId: string, body: { requestId: string; catalogEntryId: string; attributes: [] }) => {
      const entry: CharacterCatalogEntryEnvelope = {
        record: { id: 'skill-record', campaignId: 4, characterId, catalogEntryId: body.catalogEntryId, quantity: null, metadataRevision: 1 },
        definition: skillDefinition,
        definitionDescription: '',
        effectiveAttributes: [],
        explicitAttributes: [],
        definitionContentRevision: 1,
        localContentRevision: 1
      };
      store.push(entry);
      return { requestId: body.requestId, entry };
    });

    const run = await execute(api, plan);

    expect(store).toHaveLength(1);
    expect(store[0].record).toMatchObject({ characterId: 'existing', catalogEntryId: skillDefinition.id });
    expect(run.statuses['0:catalog:Skill:catalog-skill']).toBe('applied');
    expect(api.addCharacterEntry.mock.calls[0][1]).toBe('Skill');
    expect(api.addCharacterEntry.mock.calls[0][3]).toMatchObject({ catalogEntryId: skillDefinition.id });
    expect(api.addCharacterEntry.mock.calls[0][3]).not.toHaveProperty('quantity');
  });
});
