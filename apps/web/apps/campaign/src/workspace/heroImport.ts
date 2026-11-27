import { LosslessNumber, compareNumber, isLosslessNumber, isNumber, splitNumber } from 'lossless-json';
import type { createCampaignApi } from './api';
import { CampaignApiError as ApiError } from './api';
import { validateFieldValue } from './ValueInput';
import type { BaseField, CharacterMetadata, CharacterSheetEnvelope, EffectiveBaseField, Importance, JsonNumber, JsonValue, Revision, TemplateContentEnvelope, ValueType } from './types';
import type { LegacyField, LegacyObject } from './legacyDiscovery';
import type { CatalogKind, CatalogMetadata, CharacterCatalogAdditionDto, CharacterCatalogEntryEnvelope } from './catalogTypes';

export type HeroPartAction = '' | 'skip' | 'replace';
export interface HeroFieldChoice { selected: boolean; targetId: string; action: HeroPartAction }
export interface HeroCatalogSource { key: string; kind: CatalogKind; sourceId: string; name: string; quantity: JsonNumber; quantityIssue?: string }
export interface HeroDraft {
  sourceIndex: number;
  selected: boolean;
  selectName: boolean;
  selectDescription: boolean;
  selectItems: boolean;
  selectSkills: boolean;
  fields: Record<string, HeroFieldChoice>;
  catalogMappings: Record<string, string>;
  catalogRequestNamespaces: Record<string, string>;
  targetMode: '' | 'new' | 'existing';
  targetId: string;
  newName: string;
  importance: Importance | '';
  nameAction: HeroPartAction;
  descriptionAction: HeroPartAction;
  mappingTargetKey?: string;
}
export interface HeroTargetSnapshot { metadata: CharacterMetadata; sheet: CharacterSheetEnvelope; itemEntries?: CharacterCatalogEntryEnvelope[]; skillEntries?: CharacterCatalogEntryEnvelope[] }
export interface HeroImportContext { template: TemplateContentEnvelope; targets: Record<string, HeroTargetSnapshot>; itemDefinitions?: CatalogMetadata[]; skillDefinitions?: CatalogMetadata[] }
interface HeroStepBase { key: string; label: string; sourceIndex: number; targetKey: string }
export type HeroImportStep =
  | (HeroStepBase & { kind: 'create'; name: string; importance?: Importance })
  | (HeroStepBase & { kind: 'name'; name: string })
  | (HeroStepBase & { kind: 'description'; description: string })
  | (HeroStepBase & { kind: 'value'; fieldId: string; sourceKey: string; title: string; value: JsonValue; typeRevision: Revision; valueType: ValueType })
  | (HeroStepBase & { kind: 'catalog'; catalogKind: CatalogKind; sourceId: string; catalogEntryId: string; amount: JsonNumber; quantityUnit: string | null; records: CharacterCatalogEntryEnvelope[]; requestIds: string[]; operation: 'skill' | 'quantity' | 'single'; desiredAdds: number });
export interface HeroImportPlan { template: TemplateContentEnvelope; targets: Record<string, HeroTargetSnapshot>; steps: HeroImportStep[] }
export type HeroStepStatus = 'pending' | 'applied' | 'verified' | 'failed' | 'unknown';
export interface HeroImportRun {
  template: TemplateContentEnvelope;
  targets: Record<string, HeroTargetSnapshot>;
  statuses: Record<string, HeroStepStatus>;
  attempted: boolean;
  needsCheck: boolean;
  stopped: boolean;
  error?: unknown;
  createdMetadata?: Record<string, CharacterMetadata>;
}
export type HeroImportApi = Pick<ReturnType<typeof createCampaignApi>, 'characterPermissions' | 'getCharacter' | 'getSheet' | 'getTemplateContent' | 'createCharacter' | 'putCharacter' | 'putDescription' | 'putBaseValue'> & Partial<Pick<ReturnType<typeof createCampaignApi>, 'listCatalog' | 'listCharacterEntries' | 'addCharacterEntry' | 'putCharacterEntryQuantity' | 'getCharacterAddition' | 'getCharacterEntry'>>;

export function createHeroDraft(source: LegacyObject, sourceIndex: number, catalogSources: HeroCatalogSource[] = []): HeroDraft {
  return {
    sourceIndex,
    selected: false,
    selectName: false,
    selectDescription: false,
    selectItems: false,
    selectSkills: false,
    fields: Object.fromEntries(source.fields.map(field => [field.key, { selected: false, targetId: '', action: '' }])),
    catalogMappings: Object.fromEntries(catalogSources.map(item => [item.key, ''])),
    catalogRequestNamespaces: Object.fromEntries(catalogSources.map(item => [item.key, crypto.randomUUID()])),
    targetMode: '',
    targetId: '',
    newName: '',
    importance: '',
    nameAction: '',
    descriptionAction: ''
  };
}

export function compatibleHeroFields(sourceField: LegacyField, fields: readonly (BaseField | EffectiveBaseField)[]): (BaseField | EffectiveBaseField)[] {
  if (!Object.prototype.hasOwnProperty.call(sourceField.data, 'value')) return [];
  const value = sourceField.data.value;
  return fields.filter(field => validateFieldValue(field, value) === undefined);
}

export async function readHeroTarget(api: HeroImportApi, campaignId: number, characterId: string): Promise<HeroTargetSnapshot> {
  const permissions = await api.characterPermissions(campaignId, characterId);
  if (!permissions.canWrite) throw new ApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'Character is not writable.' });
  const [metadata, sheet, itemEntries, skillEntries] = await Promise.all([
    api.getCharacter(campaignId, characterId),
    api.getSheet(campaignId, characterId),
    api.listCharacterEntries?.(campaignId, 'Item', characterId) ?? Promise.resolve([]),
    api.listCharacterEntries?.(campaignId, 'Skill', characterId) ?? Promise.resolve([])
  ]);
  return { metadata, sheet, itemEntries, skillEntries };
}

const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const sourceString = (source: LegacyObject, property: string): string | undefined => own(source.data, property) && typeof source.data[property] === 'string' ? source.data[property] as string : undefined;
const equalRevision = (left: Revision, right: Revision) => String(left) === String(right);
const conflict = (code: string) => new ApiError(409, { code, title: 'Conflict', detail: code });

const idString = (value: JsonValue | undefined): string | undefined => {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? String(value) : undefined;
  return isLosslessNumber(value) && /^-?\d+$/.test(String(value)) ? String(value) : undefined;
};

const decimalParts = (value: JsonNumber) => {
  const raw = String(value);
  if (!isNumber(raw)) return undefined;
  const parts = splitNumber(raw);
  const signed = BigInt(parts.digits) * (parts.sign === '-' ? -1n : 1n);
  return { signed, exponent: parts.exponent };
};

const sumNumbers = (values: JsonNumber[]): JsonNumber | undefined => {
  if (values.length === 0) return undefined;
  const parts = values.map(decimalParts);
  if (parts.some(part => !part)) return undefined;
  const valid = parts as { signed: bigint; exponent: number }[];
  const exponent = Math.min(...valid.map(part => part.exponent));
  const scaled = valid.reduce((sum, part) => sum + part.signed * 10n ** BigInt(part.exponent - exponent), 0n);
  const digits = scaled.toString();
  const negative = digits.startsWith('-');
  let magnitude = negative ? digits.slice(1) : digits;
  let result: string;
  if (exponent >= 0) result = `${negative ? '-' : ''}${magnitude}${'0'.repeat(exponent)}`;
  else {
    const split = magnitude.length + exponent;
    result = split > 0 ? `${negative ? '-' : ''}${magnitude.slice(0, split)}.${magnitude.slice(split)}` : `${negative ? '-' : ''}0.${'0'.repeat(-split)}${magnitude}`;
    result = result.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  return new LosslessNumber(result || '0');
};

const assignmentRequestId = (namespace: string, ordinal: number): string | undefined => {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || BigInt(ordinal) > 0xffffffffffffn) return undefined;
  const hex = namespace.replaceAll('-', '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) return undefined;
  const value = `${hex.slice(0, 20)}${BigInt(ordinal).toString(16).padStart(12, '0')}`;
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

export function collectHeroCatalogSources(character: LegacyObject, characters: LegacyObject[], items: LegacyObject[], skills: LegacyObject[], itemRows: LegacyObject[], skillRows: LegacyObject[]): HeroCatalogSource[] {
  const sourceCharacterId = character.sourceId;
  if (!sourceCharacterId || characters.filter(candidate => candidate.sourceId === sourceCharacterId).length !== 1) return [];
  const result: HeroCatalogSource[] = [];
  const collect = (kind: CatalogKind, definitions: LegacyObject[], rows: LegacyObject[], idField: string) => {
    const quantities = new Map<string, JsonNumber[]>();
    for (const row of rows) {
      if (idString(row.data.characterOldId) !== sourceCharacterId) continue;
      const sourceId = idString(row.data[idField]);
      if (!sourceId) continue;
      const amount = kind === 'Skill' || !Object.prototype.hasOwnProperty.call(row.data, 'amount')
        ? 1
        : row.data.amount;
      const numeric = typeof amount === 'number' && Number.isFinite(amount) || isLosslessNumber(amount)
        ? amount as JsonNumber
        : undefined;
      const current = quantities.get(sourceId) ?? [];
      if (numeric !== undefined) current.push(numeric);
      quantities.set(sourceId, current);
      if (numeric === undefined) quantities.set(`${sourceId}\u0000invalid`, [new LosslessNumber('0')]);
    }
    for (const [sourceId, amounts] of quantities) {
      if (sourceId.includes('\u0000')) continue;
      const matches = definitions.filter(definition => definition.sourceId === sourceId);
      const amount = sumNumbers(amounts);
      const invalid = quantities.has(`${sourceId}\u0000invalid`);
      const item = matches.length === 1 ? matches[0] : undefined;
      const sourceName = item && typeof item.data.name === 'string' ? item.data.name : '';
      result.push({
        key: `${kind}:${sourceId}`,
        kind,
        sourceId,
        name: sourceName || (matches.length > 1 ? 'Неоднозначное исходное определение' : item ? 'Определение без названия' : 'Исходное определение не найдено'),
        quantity: amount ?? new LosslessNumber('0'),
        ...(!item ? { quantityIssue: matches.length > 1 ? 'Идентификатор определения неоднозначен.' : 'Исходное определение не найдено.' } : {}),
        ...(invalid || !amount ? { quantityIssue: 'Количество в исходных строках некорректно.' } : {})
      });
    }
  };
  collect('Item', items, itemRows, 'itemOldId');
  collect('Skill', skills, skillRows, 'skillOldId');
  return result.sort((a, b) => a.kind.localeCompare(b.kind) || a.sourceId.localeCompare(b.sourceId));
}

export function prepareHeroImport(sources: LegacyObject[], drafts: HeroDraft[], context: HeroImportContext, requestIds: Record<number, string>, previous?: HeroImportRun, catalogSources: Record<number, HeroCatalogSource[]> = {}): { plan?: HeroImportPlan; errors: string[] } {
  const errors: string[] = [];
  const selectedDrafts = drafts.filter(draft => draft.selected);
  if (selectedDrafts.length > 1) return { errors: ['Выберите одного персонажа для импорта'] };
  const targets = { ...context.targets, ...(previous?.targets ?? {}) };
  const template = previous?.template ?? context.template;
  const steps: HeroImportStep[] = [];
  const writes = new Map<string, string>();
  const add = (step: HeroImportStep) => {
    if (previous?.statuses[step.key] === 'applied' || previous?.statuses[step.key] === 'verified') {
      steps.push(step);
      return;
    }
    const domain = step.kind === 'value' ? `value:${step.fieldId}` : step.kind === 'catalog' ? `catalog:${step.catalogKind}:${step.catalogEntryId}` : step.kind;
    const conflictKey = `${step.targetKey}:${domain}`;
    const prior = writes.get(conflictKey);
    if (prior !== undefined) errors.push(`Несколько выбранных изменений затрагивают одну цель: ${step.label}.`);
    else writes.set(conflictKey, step.key);
    steps.push(step);
  };
  for (const draft of selectedDrafts) {
    const source = sources[draft.sourceIndex];
    if (!source) { errors.push(`Не найден исходный персонаж ${draft.sourceIndex + 1}.`); continue; }
    let targetKey: string;
    if (draft.targetMode === 'new') {
      targetKey = requestIds[draft.sourceIndex] ?? '';
      if (!targetKey) { errors.push(`Для персонажа «${source.name}» отсутствует UUID создания.`); continue; }
      const newName = draft.newName.trim();
      if (!newName) { errors.push(`Укажите имя нового персонажа «${source.name}».`); continue; }
      add({ key: `${draft.sourceIndex}:create`, label: source.name, sourceIndex: draft.sourceIndex, targetKey, kind: 'create', name: newName, ...(draft.importance ? { importance: draft.importance } : {}) });
    } else if (draft.targetMode === 'existing') {
      targetKey = draft.targetId;
      if (!targetKey) { errors.push(`Выберите целевого персонажа для «${source.name}».`); continue; }
      if (!targets[targetKey]) { errors.push(`Не загружены права и данные целевого персонажа «${source.name}».`); continue; }
    } else { errors.push(`Выберите способ импорта персонажа «${source.name}».`); continue; }

    if (draft.selectName && draft.targetMode === 'existing') {
      const name = sourceString(source, 'name');
      if (draft.nameAction === '') errors.push(`Выберите действие для имени «${source.name}».`);
      else if (draft.nameAction === 'replace') {
        if (!name) errors.push(`У «${source.name}» отсутствует корректное имя.`);
        else add({ key: `${draft.sourceIndex}:name`, label: source.name, sourceIndex: draft.sourceIndex, targetKey, kind: 'name', name });
      }
    }
    if (draft.selectDescription) {
      const description = sourceString(source, 'description');
      if (draft.descriptionAction === '') errors.push(`Выберите действие для описания «${source.name}».`);
      else if (draft.descriptionAction === 'replace') {
        if (description === undefined) errors.push(`У «${source.name}» отсутствует корректное описание.`);
        else add({ key: `${draft.sourceIndex}:description`, label: source.name, sourceIndex: draft.sourceIndex, targetKey, kind: 'description', description });
      }
    }
    for (const field of source.fields) {
      const choice = draft.fields[field.key];
      if (!choice?.selected) continue;
      if (choice.action === '') { errors.push(`Выберите действие для поля «${field.name}» персонажа «${source.name}».`); continue; }
      if (choice.action === 'skip') continue;
      if (!own(field.data, 'value')) { errors.push(`У поля «${field.name}» нет явного значения.`); continue; }
      const targetFieldId = choice.targetId;
      const target = targets[targetKey];
      const candidate = target
        ? target.sheet.baseFields.find(item => item.id === targetFieldId)
        : template.data.baseFields.find(item => item.id === targetFieldId);
      if (!candidate || validateFieldValue(candidate, field.data.value) !== undefined) { errors.push(`Поле «${field.name}» не совместимо с выбранным целевым полем.`); continue; }
      add({ key: `${draft.sourceIndex}:value:${field.key}`, label: field.name, sourceIndex: draft.sourceIndex, targetKey, kind: 'value', fieldId: candidate.id, sourceKey: field.key, title: candidate.title, value: field.data.value, typeRevision: candidate.typeRevision, valueType: candidate.valueType });
    }
    const selectedCatalog = (catalogSources[draft.sourceIndex] ?? []).filter(item => (item.kind === 'Item' ? draft.selectItems : draft.selectSkills) && Boolean(draft.catalogMappings[item.key]));
    const grouped = new Map<string, { sourceIds: string[]; amount: JsonNumber; definition: CatalogMetadata }>();
    for (const item of selectedCatalog) {
      if (item.quantityIssue) { errors.push(`${item.name}: ${item.quantityIssue}`); continue; }
      const definitions = item.kind === 'Item' ? context.itemDefinitions ?? [] : context.skillDefinitions ?? [];
      const definition = definitions.find(candidate => candidate.id === draft.catalogMappings[item.key]);
      if (!definition || definition.kind !== item.kind) { errors.push(`Не выбрано существующее определение каталога для «${item.name}».`); continue; }
      const groupKey = `${item.kind}:${definition.id}`;
      const current = grouped.get(groupKey);
      const amount = current ? sumNumbers([current.amount, item.quantity]) : item.quantity;
      if (!amount) { errors.push(`Количество «${definition.name}» не удалось сложить точно.`); continue; }
      grouped.set(groupKey, { sourceIds: [...(current?.sourceIds ?? []), item.sourceId], amount, definition });
    }
    for (const group of grouped.values()) {
      const { definition, amount } = group;
      const records = targets[targetKey]?.[definition.kind === 'Item' ? 'itemEntries' : 'skillEntries']?.filter(entry => entry.record.catalogEntryId === definition.id) ?? [];
      if (definition.kind === 'Item' && definition.quantityUnit !== 'Single' && definition.quantityUnit !== 'Whole' && definition.quantityUnit !== 'Fractional') {
        errors.push(`Для «${definition.name}» недоступна единица количества.`);
        continue;
      }
      if (definition.kind === 'Item' && definition.quantityUnit === 'Whole') {
        const parts = decimalParts(amount);
        if (!parts || parts.exponent < 0 && BigInt(parts.signed < 0n ? -parts.signed : parts.signed) % 10n ** BigInt(-parts.exponent) !== 0n) {
          errors.push(`Количество «${definition.name}» должно быть целым.`);
          continue;
        }
      }
      if (definition.kind === 'Item' && !definition.allowNegative && compareNumber(String(amount), '0') < 0) {
        errors.push(`Отрицательное количество «${definition.name}» запрещено его определением.`);
        continue;
      }
      if (definition.kind === 'Item' && definition.quantityUnit !== 'Single' && records.length > 1) {
        errors.push(`У целевого персонажа несколько записей для «${definition.name}»; однозначная замена количества невозможна.`);
        continue;
      }
      const single = definition.kind === 'Item' && definition.quantityUnit === 'Single';
      const desired = Number(String(amount));
      if (single && (!Number.isSafeInteger(desired) || desired < 0)) {
        errors.push(`Количество записей «${definition.name}» должно быть неотрицательным целым числом.`);
        continue;
      }
      if (definition.kind === 'Skill' && records.length > 0) {
        add({ key: `${draft.sourceIndex}:catalog:Skill:${definition.id}`, label: definition.name, sourceIndex: draft.sourceIndex, targetKey, kind: 'catalog', catalogKind: 'Skill', sourceId: group.sourceIds.join(','), catalogEntryId: definition.id, amount, quantityUnit: null, records, requestIds: [], operation: 'skill', desiredAdds: 0 });
        continue;
      }
      const desiredAdds = single ? Math.max(0, desired - records.length) : definition.kind === 'Skill' || records.length === 0 ? 1 : 0;
      const namespace = group.sourceIds.map(sourceId => draft.catalogRequestNamespaces[`${definition.kind}:${sourceId}`]).filter(Boolean).sort()[0] ?? requestIds[draft.sourceIndex];
      if (desiredAdds > 0 && !namespace) {
        errors.push(`Для назначения «${definition.name}» отсутствует стабильный идентификатор запроса.`);
        continue;
      }
      const stableRequestIds = Array.from({ length: desiredAdds }, (_, index) => namespace ? assignmentRequestId(namespace, records.length + index) : undefined);
      if (stableRequestIds.some(id => !id)) {
        errors.push(`Не удалось сформировать GUID запросов для назначения «${definition.name}».`);
        continue;
      }
      add({
        key: `${draft.sourceIndex}:catalog:${definition.kind}:${definition.id}`,
        label: definition.name,
        sourceIndex: draft.sourceIndex,
        targetKey,
        kind: 'catalog',
        catalogKind: definition.kind,
        sourceId: group.sourceIds.join(','),
        catalogEntryId: definition.id,
        amount,
        quantityUnit: definition.quantityUnit,
        records,
        requestIds: stableRequestIds as string[],
        operation: definition.kind === 'Skill' ? 'skill' : single ? 'single' : 'quantity',
        desiredAdds
      });
    }
  }
  if (!steps.length) errors.push('Выберите данные для импорта');
  if (errors.length) return { errors };
  return { plan: { template, targets, steps }, errors };
}

const cloneRun = (run: HeroImportRun): HeroImportRun => ({ ...run, targets: { ...run.targets }, statuses: { ...run.statuses }, ...(run.createdMetadata ? { createdMetadata: { ...run.createdMetadata } } : {}) });
const uncertain = (error: unknown) => !(error instanceof ApiError) || error.unknownOutcome || error.status >= 500 || ['creation_already_published', 'already_published', 'content_already_prepared'].includes(error.problem.code);

async function readCheckedTarget(api: HeroImportApi, campaignId: number, characterId: string, canContinue: () => boolean): Promise<HeroTargetSnapshot> {
  if (!canContinue()) throw new Error('Импорт остановлен до проверки прав.');
  const permissions = await api.characterPermissions(campaignId, characterId);
  if (!permissions.canWrite) throw new ApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'Character is not writable.' });
  if (!canContinue()) throw new Error('Импорт остановлен до чтения персонажа.');
  const metadata = await api.getCharacter(campaignId, characterId);
  if (!canContinue()) throw new Error('Импорт остановлен до чтения листа.');
  const [sheet, itemEntries, skillEntries] = await Promise.all([
    api.getSheet(campaignId, characterId),
    api.listCharacterEntries?.(campaignId, 'Item', characterId) ?? Promise.resolve([]),
    api.listCharacterEntries?.(campaignId, 'Skill', characterId) ?? Promise.resolve([])
  ]);
  return { metadata, sheet, itemEntries, skillEntries };
}

export async function executeHeroImport(api: HeroImportApi, campaignId: number, plan: HeroImportPlan, previous: HeroImportRun | undefined, onUpdate: (run: HeroImportRun) => void, canContinue: () => boolean): Promise<HeroImportRun> {
  const state: HeroImportRun = {
    template: previous?.template ?? plan.template,
    targets: { ...plan.targets, ...(previous?.targets ?? {}) },
    statuses: { ...Object.fromEntries(plan.steps.map(step => [step.key, 'pending' as HeroStepStatus])), ...(previous?.statuses ?? {}) },
    attempted: previous?.attempted ?? false,
    needsCheck: previous?.needsCheck ?? false,
    stopped: previous?.stopped ?? false,
    ...(previous?.createdMetadata ? { createdMetadata: { ...previous.createdMetadata } } : {}),
    ...(previous?.error === undefined ? {} : { error: previous.error })
  };
  const emit = () => onUpdate(cloneRun(state));
  const fail = (error: unknown, key?: string) => {
    if (key && state.statuses[key] !== 'applied' && state.statuses[key] !== 'verified') state.statuses[key] = uncertain(error) ? 'unknown' : 'failed';
    state.needsCheck = true;
    state.stopped = true;
    state.error = error;
    emit();
  };
  if (state.needsCheck) return state;
  const pending = plan.steps.filter(step => !['applied', 'verified'].includes(state.statuses[step.key]));
  try {
    if (pending.some(step => step.kind === 'value')) {
      if (!canContinue()) throw new Error('Импорт остановлен до проверки шаблона.');
      const currentTemplate = await api.getTemplateContent(campaignId);
      if (!equalRevision(currentTemplate.contentRevision, state.template.contentRevision)) throw conflict('import_template_changed');
      state.template = currentTemplate;
    }
    const existing = new Set(pending.filter(step => {
      if (step.kind === 'create') return false;
      const hasUncreatedTarget = plan.steps.some(candidate => candidate.kind === 'create' && candidate.targetKey === step.targetKey)
        && !['applied', 'verified'].includes(state.statuses[`${step.sourceIndex}:create`])
        && !state.targets[step.targetKey]
        && !state.createdMetadata?.[step.targetKey];
      return !hasUncreatedTarget;
    }).map(step => step.targetKey));
    for (const targetKey of existing) {
      const snapshot = await readCheckedTarget(api, campaignId, targetKey, canContinue);
      const prior = state.targets[targetKey];
      if (prior && pending.some(step => step.targetKey === targetKey && (step.kind === 'description' || step.kind === 'value')) && !equalRevision(snapshot.sheet.contentRevision, prior.sheet.contentRevision)) throw conflict('import_character_content_changed');
      if (prior && pending.some(step => step.targetKey === targetKey && step.kind === 'name') && !equalRevision(snapshot.metadata.metadataRevision, prior.metadata.metadataRevision)) throw conflict('import_character_metadata_changed');
      if (prior && pending.some(step => step.targetKey === targetKey && step.kind === 'catalog')) {
        const catalogSteps = pending.filter((step): step is Extract<HeroImportStep, { kind: 'catalog' }> => step.targetKey === targetKey && step.kind === 'catalog');
        for (const step of catalogSteps) {
          const before = (step.catalogKind === 'Item' ? prior.itemEntries : prior.skillEntries)?.filter(entry => entry.record.catalogEntryId === step.catalogEntryId) ?? step.records;
          const after = step.catalogKind === 'Item' ? snapshot.itemEntries ?? [] : snapshot.skillEntries ?? [];
          const priorRecords = before.map(entry => entry.record).sort((a, b) => a.id.localeCompare(b.id));
          const currentRecords = after.filter(entry => entry.record.catalogEntryId === step.catalogEntryId).map(entry => entry.record).sort((a, b) => a.id.localeCompare(b.id));
          if (priorRecords.length !== currentRecords.length || priorRecords.some((record, index) => record.id !== currentRecords[index]?.id || !equalRevision(record.metadataRevision, currentRecords[index].metadataRevision) || String(record.quantity) !== String(currentRecords[index].quantity))) throw conflict('import_character_catalog_changed');
        }
      }
      state.targets[targetKey] = snapshot;
    }
  } catch (error) { fail(error); return state; }

  for (const step of plan.steps) {
    if (state.statuses[step.key] === 'applied' || state.statuses[step.key] === 'verified') continue;
    if (!canContinue()) {
      state.needsCheck = true;
      state.stopped = true;
      state.error = new Error('Импорт остановлен пользователем.');
      emit();
      break;
    }
    try {
      state.attempted = true;
      emit();
      if (step.kind === 'create') {
        const metadata = await api.createCharacter(campaignId, { requestId: step.targetKey, name: step.name, ...(step.importance ? { importance: step.importance } : {}) });
        state.createdMetadata = { ...state.createdMetadata, [step.targetKey]: metadata };
        state.statuses[step.key] = 'applied';
        emit();
        if (!canContinue()) { state.needsCheck = true; state.stopped = true; state.error = new Error('Импорт остановлен после создания персонажа.'); emit(); break; }
         const sheet = await api.getSheet(campaignId, metadata.id);
         const [itemEntries, skillEntries] = await Promise.all([
           api.listCharacterEntries?.(campaignId, 'Item', metadata.id) ?? Promise.resolve([]),
           api.listCharacterEntries?.(campaignId, 'Skill', metadata.id) ?? Promise.resolve([])
         ]);
         state.targets[step.targetKey] = { metadata, sheet, itemEntries, skillEntries };
      } else {
        const target = state.targets[step.targetKey];
        if (!target) throw new Error('Не загружен целевой персонаж.');
        if (step.kind === 'name') {
          const metadata = await api.putCharacter(campaignId, step.targetKey, { name: step.name, importance: target.metadata.importance, expectedRevision: target.metadata.metadataRevision });
          state.targets[step.targetKey] = { ...target, metadata };
        } else if (step.kind === 'description') {
          const result = await api.putDescription(campaignId, step.targetKey, { description: step.description, expectedRevision: target.sheet.contentRevision });
          state.targets[step.targetKey] = { ...target, sheet: { ...target.sheet, description: step.description, contentRevision: result.contentRevision } };
        } else if (step.kind === 'value') {
          const current = target.sheet.baseFields.find(field => field.id === step.fieldId);
          if (!equalRevision(target.sheet.templateContentRevision, state.template.contentRevision) || !current || !equalRevision(current.typeRevision, step.typeRevision) || current.valueType !== step.valueType) throw conflict('import_field_definition_changed');
          const sheet = await api.putBaseValue(campaignId, step.targetKey, step.fieldId, { value: step.value, expectedRevision: target.sheet.contentRevision });
          state.targets[step.targetKey] = { ...target, sheet };
        } else {
          if (step.operation === 'skill' && step.records.length > 0) {
            state.statuses[step.key] = 'applied';
            emit();
            continue;
          }
          if (step.operation === 'quantity') {
            const record = step.records[0];
            if (record && String(record.record.quantity) !== String(step.amount)) {
              if (!api.putCharacterEntryQuantity) throw new Error('API не поддерживает замену количества предмета.');
              const updated = await api.putCharacterEntryQuantity(campaignId, target.metadata.id, record.record.id, { expectedRevision: record.record.metadataRevision, quantity: step.amount });
              const entries = [...(step.catalogKind === 'Item' ? target.itemEntries ?? [] : target.skillEntries ?? [])].map(entry => entry.record.id === record.record.id ? updated : entry);
              state.targets[step.targetKey] = { ...target, [step.catalogKind === 'Item' ? 'itemEntries' : 'skillEntries']: entries };
            } else if (!record) {
              if (!api.addCharacterEntry) throw new Error('API не поддерживает назначение определения.');
              await api.addCharacterEntry(campaignId, step.catalogKind, target.metadata.id, { requestId: step.requestIds[0], catalogEntryId: step.catalogEntryId, quantity: step.amount, attributes: [] });
            }
          } else {
            if (!api.addCharacterEntry) throw new Error('API не поддерживает назначение определения.');
            for (const requestId of step.requestIds) {
              if (!canContinue()) throw new Error('Импорт остановлен до назначения следующей записи.');
              await api.addCharacterEntry(campaignId, 'Item', target.metadata.id, { requestId, catalogEntryId: step.catalogEntryId, attributes: [] });
            }
          }
        }
        state.statuses[step.key] = 'applied';
        emit();
      }
    } catch (error) { fail(error, step.key); break; }
  }
  return state;
}

export async function recheckHeroImport(api: HeroImportApi, campaignId: number, plan: HeroImportPlan, run: HeroImportRun, canContinue: () => boolean): Promise<HeroImportRun> {
  const state = cloneRun(run);
  const request = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (!canContinue()) throw new Error('Проверка импорта остановлена.');
    return operation();
  };
  try {
    state.template = await request(() => api.getTemplateContent(campaignId));
    const relevant = new Set(plan.steps.filter(step => step.kind !== 'create').map(step => step.targetKey));
    for (const step of plan.steps) if (step.kind === 'create' && ['unknown', 'applied'].includes(state.statuses[step.key])) relevant.add(step.targetKey);
    for (const key of relevant) {
      const createStep = plan.steps.find((step): step is Extract<HeroImportStep, { kind: 'create' }> => step.kind === 'create' && step.targetKey === key);
      if (createStep && ['unknown', 'applied'].includes(state.statuses[createStep.key])) {
        const metadata = await request(() => api.getCharacter(campaignId, key));
        if (metadata.id !== key) throw new Error('Созданный персонаж не подтверждён тем же UUID.');
        const sheet = await request(() => api.getSheet(campaignId, metadata.id));
        const [itemEntries, skillEntries] = await Promise.all([
          request(() => api.listCharacterEntries ? api.listCharacterEntries(campaignId, 'Item', metadata.id) : Promise.resolve([])),
          request(() => api.listCharacterEntries ? api.listCharacterEntries(campaignId, 'Skill', metadata.id) : Promise.resolve([]))
        ]);
        state.createdMetadata = { ...state.createdMetadata, [key]: metadata };
        state.targets[key] = { metadata, sheet, itemEntries, skillEntries };
        state.statuses[createStep.key] = 'verified';
        continue;
      }
      const known = state.createdMetadata?.[key] ?? state.targets[key]?.metadata;
      if (known) {
        const snapshot = await readCheckedTarget(api, campaignId, known.id, canContinue);
        state.targets[key] = snapshot;
      } else {
        continue;
      }
    }
    const receiptExists = async (step: Extract<HeroImportStep, { kind: 'catalog' }>, requestId: string): Promise<boolean> => {
      if (!api.getCharacterAddition || !api.getCharacterEntry) throw new Error('API не поддерживает проверку подтверждения назначения.');
      let receipt: CharacterCatalogAdditionDto;
      try {
        receipt = await request(() => api.getCharacterAddition!(campaignId, step.catalogKind, state.targets[step.targetKey].metadata.id, requestId));
      } catch (error) {
        if ((error as { status?: number })?.status === 404) return false;
        throw error;
      }
      const characterId = state.targets[step.targetKey].metadata.id;
      if (receipt.requestId !== requestId || receipt.campaignId !== campaignId || receipt.characterId !== characterId || receipt.catalogEntryId !== step.catalogEntryId) throw new Error('Подтверждение назначения не соответствует импортируемой записи.');
      try {
        const entry = await request(() => api.getCharacterEntry!(campaignId, step.catalogKind, characterId, receipt.entryId));
        if (entry.record.id !== receipt.entryId || entry.record.campaignId !== campaignId || entry.record.characterId !== characterId || entry.record.catalogEntryId !== step.catalogEntryId || entry.definition.kind !== step.catalogKind) throw new Error('Запись подтверждения не соответствует импорту.');
      } catch (error) {
        if ((error as { status?: number })?.status !== 404) throw error;
      }
      return true;
    };
    for (const step of plan.steps) {
      if (step.kind === 'catalog' && ['pending', 'unknown', 'failed'].includes(state.statuses[step.key])) {
        const target = state.targets[step.targetKey];
        const entries = step.catalogKind === 'Item' ? target?.itemEntries ?? [] : target?.skillEntries ?? [];
        const matches = entries.filter(entry => entry.record.catalogEntryId === step.catalogEntryId);
        let confirmed: boolean;
        if (step.operation === 'single') {
          let confirmedReceipts = 0;
          for (const requestId of step.requestIds) if (await receiptExists(step, requestId)) confirmedReceipts++;
          confirmed = confirmedReceipts === step.desiredAdds;
        } else if (step.operation === 'skill') {
          confirmed = matches.length > 0;
          if (!confirmed && step.requestIds[0]) confirmed = await receiptExists(step, step.requestIds[0]);
        } else {
          confirmed = matches.length === 1 && String(matches[0].record.quantity) === String(step.amount);
          if (!confirmed && !step.records.length && step.requestIds[0]) confirmed = await receiptExists(step, step.requestIds[0]);
        }
        state.statuses[step.key] = confirmed ? 'verified' : 'pending';
      } else if (state.statuses[step.key] === 'unknown' || state.statuses[step.key] === 'failed') state.statuses[step.key] = 'pending';
    }
    state.needsCheck = false;
    state.stopped = false;
    delete state.error;
  } catch (error) {
    state.needsCheck = true;
    state.stopped = true;
    state.error = error;
  }
  return state;
}
