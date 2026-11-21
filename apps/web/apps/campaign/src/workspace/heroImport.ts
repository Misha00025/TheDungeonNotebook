import type { createCampaignApi } from './api';
import { CampaignApiError as ApiError } from './api';
import { validateFieldValue } from './ValueInput';
import type { BaseField, CharacterMetadata, CharacterSheetEnvelope, EffectiveBaseField, Importance, JsonValue, Revision, TemplateContentEnvelope, ValueType } from './types';
import type { LegacyField, LegacyObject } from './legacyDiscovery';

export type HeroPartAction = '' | 'skip' | 'replace';
export interface HeroFieldChoice { selected: boolean; targetId: string; action: HeroPartAction }
export interface HeroDraft {
  sourceIndex: number;
  selected: boolean;
  selectName: boolean;
  selectDescription: boolean;
  fields: Record<string, HeroFieldChoice>;
  targetMode: '' | 'new' | 'existing';
  targetId: string;
  newName: string;
  importance: Importance | '';
  nameAction: HeroPartAction;
  descriptionAction: HeroPartAction;
  mappingTargetKey?: string;
}
export interface HeroTargetSnapshot { metadata: CharacterMetadata; sheet: CharacterSheetEnvelope }
export interface HeroImportContext { template: TemplateContentEnvelope; targets: Record<string, HeroTargetSnapshot> }
interface HeroStepBase { key: string; label: string; sourceIndex: number; targetKey: string }
export type HeroImportStep =
  | (HeroStepBase & { kind: 'create'; name: string; importance?: Importance })
  | (HeroStepBase & { kind: 'name'; name: string })
  | (HeroStepBase & { kind: 'description'; description: string })
  | (HeroStepBase & { kind: 'value'; fieldId: string; sourceKey: string; title: string; value: JsonValue; typeRevision: Revision; valueType: ValueType });
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
export type HeroImportApi = Pick<ReturnType<typeof createCampaignApi>, 'characterPermissions' | 'getCharacter' | 'getSheet' | 'getTemplateContent' | 'createCharacter' | 'putCharacter' | 'putDescription' | 'putBaseValue'>;

export function createHeroDraft(source: LegacyObject, sourceIndex: number): HeroDraft {
  return {
    sourceIndex,
    selected: false,
    selectName: false,
    selectDescription: false,
    fields: Object.fromEntries(source.fields.map(field => [field.key, { selected: false, targetId: '', action: '' }])),
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
  const [metadata, sheet] = await Promise.all([api.getCharacter(campaignId, characterId), api.getSheet(campaignId, characterId)]);
  return { metadata, sheet };
}

const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const sourceString = (source: LegacyObject, property: string): string | undefined => own(source.data, property) && typeof source.data[property] === 'string' ? source.data[property] as string : undefined;
const equalRevision = (left: Revision, right: Revision) => String(left) === String(right);
const conflict = (code: string) => new ApiError(409, { code, title: 'Conflict', detail: code });

export function prepareHeroImport(sources: LegacyObject[], drafts: HeroDraft[], context: HeroImportContext, requestIds: Record<number, string>, previous?: HeroImportRun): { plan?: HeroImportPlan; errors: string[] } {
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
    const domain = step.kind === 'value' ? `value:${step.fieldId}` : step.kind;
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
  const sheet = await api.getSheet(campaignId, characterId);
  return { metadata, sheet };
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
        state.targets[step.targetKey] = { metadata, sheet };
      } else {
        const target = state.targets[step.targetKey];
        if (!target) throw new Error('Не загружен целевой персонаж.');
        if (step.kind === 'name') {
          const metadata = await api.putCharacter(campaignId, step.targetKey, { name: step.name, importance: target.metadata.importance, expectedRevision: target.metadata.metadataRevision });
          state.targets[step.targetKey] = { ...target, metadata };
        } else if (step.kind === 'description') {
          const result = await api.putDescription(campaignId, step.targetKey, { description: step.description, expectedRevision: target.sheet.contentRevision });
          state.targets[step.targetKey] = { ...target, sheet: { ...target.sheet, description: step.description, contentRevision: result.contentRevision } };
        } else {
          const current = target.sheet.baseFields.find(field => field.id === step.fieldId);
          if (!equalRevision(target.sheet.templateContentRevision, state.template.contentRevision) || !current || !equalRevision(current.typeRevision, step.typeRevision) || current.valueType !== step.valueType) throw conflict('import_field_definition_changed');
          const sheet = await api.putBaseValue(campaignId, step.targetKey, step.fieldId, { value: step.value, expectedRevision: target.sheet.contentRevision });
          state.targets[step.targetKey] = { ...target, sheet };
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
        state.createdMetadata = { ...state.createdMetadata, [key]: metadata };
        state.targets[key] = { metadata, sheet };
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
    for (const step of plan.steps) if (state.statuses[step.key] === 'unknown' || state.statuses[step.key] === 'failed') state.statuses[step.key] = 'pending';
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
