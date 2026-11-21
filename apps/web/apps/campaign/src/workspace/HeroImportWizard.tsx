import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Checkbox, DataTable, Field, Input, LinkButton, ModalPortal, Panel, Select } from '@tdn/shared';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import { CampaignApiError } from './api';
import { displayValue } from './json';
import type { JsonValue } from './types';
import type { LegacyField, LegacyObject } from './legacyDiscovery';
import {
  compatibleHeroFields,
  createHeroDraft,
  executeHeroImport,
  prepareHeroImport,
  readHeroTarget,
  recheckHeroImport
} from './heroImport';
import type { HeroDraft, HeroImportPlan, HeroImportRun, HeroPartAction, HeroTargetSnapshot } from './heroImport';

type WizardProps = { sources: LegacyObject[]; campaignId: number; onClose: () => void; onResult?: (plan: HeroImportPlan, run: HeroImportRun) => void };
type SummaryProps = { plan: HeroImportPlan; run: HeroImportRun; campaignId: number };

const importanceOptions = [
  { value: '', label: 'По умолчанию' },
  { value: 'Background', label: 'Фоновый' },
  { value: 'Secondary', label: 'Второстепенный' },
  { value: 'Key', label: 'Ключевой' }
];
const jsonDisplay = (value: JsonValue | undefined) => value === undefined ? 'Не задано' : displayValue(value);
const importValueDisplay = (value: JsonValue | undefined) => value === '' ? 'Пустая строка' : jsonDisplay(value);
const completeRun = (run: HeroImportRun | undefined, plan: HeroImportPlan | undefined) => Boolean(run && plan && !run.needsCheck && !run.error && !run.stopped && plan.steps.length > 0 && plan.steps.every(step => ['applied', 'verified'].includes(run.statuses[step.key])));
const sourceFieldValue = (field: LegacyField) => Object.prototype.hasOwnProperty.call(field.data, 'value') ? jsonDisplay(field.data.value) : 'Нет явного значения';
const hasOwnString = (source: LegacyObject, key: string) => Object.prototype.hasOwnProperty.call(source.data, key) && typeof source.data[key] === 'string';

export const HeroImportSummary: React.FC<SummaryProps> = ({ plan, run, campaignId }) => {
  const { path } = useWorkspace();
  const resources = new Map<string, HeroTargetSnapshot>();
  Object.entries(plan.targets).forEach(([key, value]) => resources.set(key, value));
  Object.entries(run.targets).forEach(([key, value]) => resources.set(key, value));
  Object.entries(run.createdMetadata ?? {}).forEach(([key, metadata]) => {
    const prior = resources.get(key);
    if (prior) resources.set(key, { ...prior, metadata });
  });
  const statuses = { ...Object.fromEntries(plan.steps.map(step => [step.key, 'pending'])), ...run.statuses };
  const statusText = (status: string) => status === 'applied' ? 'Сохранено' : status === 'verified' ? 'Создание подтверждено' : status === 'unknown' ? 'Результат неизвестен' : status === 'failed' ? 'Не сохранено' : 'Ожидает подтверждения';
  const targets = new Map<string, { name: string; id: string }>();
  resources.forEach((snapshot, key) => targets.set(key, { name: snapshot.metadata.name, id: snapshot.metadata.id }));
  Object.entries(run.createdMetadata ?? {}).forEach(([key, metadata]) => targets.set(key, { name: metadata.name, id: metadata.id }));
  return <section aria-label="Итог импорта">
    <p>Шаги выполняются последовательно; импорт не является атомарной операцией.</p>
    {run.stopped && <p role="status">Импорт остановлен. Уже подтверждённые изменения сохранены; остальные шаги не выполнялись.</p>}
    <ul>{plan.steps.map(step => {
      const target = targets.get(step.targetKey);
      return <li key={step.key}>
        <span>{`Персонаж ${step.sourceIndex + 1}: ${step.label} — ${statusText(statuses[step.key] ?? 'pending')}`}</span>
        {target && <span> — <LinkButton size="small" variant="secondary" to={path(`/${campaignId}/gm/characters/${encodeURIComponent(target.id)}`)}>Открыть {target.name}</LinkButton></span>}
      </li>;
    })}</ul>
  </section>;
};

const HeroImportWizard: React.FC<WizardProps> = ({ sources, campaignId, onClose, onResult }) => {
  const { api, sessionKey } = useWorkspace();
  const { mode, permissions, permissionsLoading, reloadPermissions } = useCampaignWorkspace();
  const canWrite = mode === 'gm' && permissions.canWrite && !permissionsLoading;
  const canWriteRef = useRef(canWrite);
  canWriteRef.current = canWrite;
  const [requestIds] = useState<Record<number, string>>(() => Object.fromEntries(sources.map((_, index) => [index, crypto.randomUUID()])));
  const [drafts, setDrafts] = useState<HeroDraft[]>(() => sources.map((source, index) => createHeroDraft(source, index)));
  const [step, setStep] = useState(1);
  const [run, setRun] = useState<HeroImportRun>();
  const [plan, setPlan] = useState<HeroImportPlan>();
  const [reportPlan, setReportPlan] = useState<HeroImportPlan>();
  const [planErrors, setPlanErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [notice, setNotice] = useState('');
  const [genericError, setGenericError] = useState<unknown>();
  const activeRef = useRef(true);
  const busyRef = useRef(false);
  const stopRef = useRef(false);
  const selected = drafts.filter(draft => draft.selected);
  const selectedDraft = selected[0];
  const selectedSourceValue = selectedDraft ? String(selectedDraft.sourceIndex) : '';
  const selectedExistingIds = Array.from(new Set(selected.filter(draft => draft.targetMode === 'existing' && draft.targetId).map(draft => draft.targetId))).sort();
  const resourcesEnabled = canWrite;
  const definitions = useResource(`${sessionKey}:${campaignId}:hero-import-base`, async () => {
    const [template, characters] = await Promise.all([api.getTemplateContent(campaignId), api.listCharacters(campaignId)]);
    return { template, characters };
  }, resourcesEnabled);
  const targetResources = useResource(`${sessionKey}:${campaignId}:hero-import-targets:${selectedExistingIds.join('|')}`, () => Promise.all(selectedExistingIds.map(async id => [id, await readHeroTarget(api, campaignId, id)] as const)), canWrite && selectedExistingIds.length > 0);
  const locked = Boolean(run?.attempted);
  const complete = completeRun(run, plan);
  const dirty = busy || (selected.length > 0 && !complete);
  const clearDirty = useDirtyDraft(`hero-import-${sessionKey}-${campaignId}`, dirty);
  const resourceBusy = canWrite && (definitions.loading || (selectedExistingIds.length > 0 && targetResources.loading));
  const targetMap = useMemo(() => Object.fromEntries(targetResources.data ?? []), [targetResources.data]);
  const snapshots: Record<string, HeroTargetSnapshot> = { ...targetMap, ...(run?.targets ?? {}) };
  const currentTemplate = run?.template ?? definitions.data?.template;
  const context = currentTemplate ? { template: currentTemplate, targets: snapshots } : undefined;
  const resourceError = definitions.error ?? targetResources.error;
  const controlsDisabled = busy || !canWrite || resourceBusy || Boolean(resourceError) || !definitions.data;

  useEffect(() => {
    if (resourceError instanceof CampaignApiError && resourceError.status === 403) reloadPermissions();
  }, [resourceError, reloadPermissions]);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; stopRef.current = true; };
  }, []);

  useEffect(() => {
    if (!definitions.data || !resourcesEnabled || resourceBusy || resourceError) return;
    setDrafts(current => {
      let changed = false;
      const next = current.map(draft => {
        if (!draft.selected || !draft.targetMode) return draft;
        const targetKey = draft.targetMode === 'new' ? requestIds[draft.sourceIndex] : draft.targetId;
        if (!targetKey || draft.mappingTargetKey === targetKey) return draft;
        const snapshot = draft.targetMode === 'existing' ? snapshots[targetKey] : undefined;
        if (draft.targetMode === 'existing' && !snapshot) return draft;
        const candidates = snapshot ? snapshot.sheet.baseFields : currentTemplate!.data.baseFields;
        const source = sources[draft.sourceIndex];
        if (!source) return draft;
        const fields = Object.fromEntries(source.fields.map(field => {
          const compatible = compatibleHeroFields(field, candidates);
          const exact = compatible.filter(candidate => candidate.key === field.key);
          return [field.key, { ...draft.fields[field.key], targetId: exact.length === 1 ? exact[0].id : '', action: exact.length === 1 ? 'replace' as HeroPartAction : 'skip' as HeroPartAction }];
        }));
        changed = true;
        return { ...draft, fields, mappingTargetKey: targetKey };
      });
      return changed ? next : current;
    });
  }, [definitions.data, resourceError, resourceBusy, resourcesEnabled, requestIds, snapshots, sources]);

  const invalidatePlan = () => { setPlan(undefined); setPlanErrors([]); setNotice(''); };
  const updateDraft = (sourceIndex: number, update: (draft: HeroDraft) => HeroDraft) => {
    invalidatePlan();
    setDrafts(current => current.map(draft => draft.sourceIndex === sourceIndex ? update(draft) : draft));
  };
  const updateField = (sourceIndex: number, key: string, update: (choice: HeroDraft['fields'][string]) => HeroDraft['fields'][string]) => updateDraft(sourceIndex, draft => ({ ...draft, fields: { ...draft.fields, [key]: update(draft.fields[key]) } }));
  const prepare = () => {
    if (!context || controlsDisabled || !canWrite || run?.needsCheck) return;
    const result = prepareHeroImport(sources, drafts, context, requestIds, run);
    setPlanErrors(result.errors);
    setPlan(result.plan);
    if (result.plan) {
      setReportPlan(result.plan);
      setStep(4);
    }
    setNotice('');
  };

  const execute = async () => {
    if (!plan || !canWrite || controlsDisabled || genericError || run?.error || busyRef.current || run?.needsCheck) return;
    busyRef.current = true;
    stopRef.current = false;
    setStopRequested(false);
    setBusy(true);
    setGenericError(undefined);
    try {
      const result = await executeHeroImport(api, campaignId, plan, run, next => {
        if (!activeRef.current) return;
        setRun(next);
        try { onResult?.(plan, next); } catch { }
      }, () => activeRef.current && canWriteRef.current && !stopRef.current);
      if (!activeRef.current) return;
      setRun(result);
      try { onResult?.(plan, result); } catch { }
      if (result.error instanceof CampaignApiError && result.error.status === 403) reloadPermissions();
    } catch (error) {
      if (activeRef.current) setGenericError(error);
    } finally {
      busyRef.current = false;
      if (activeRef.current) setBusy(false);
    }
  };

  const recheck = async () => {
    const checkPlan = plan ?? reportPlan;
    if (!checkPlan || !run || !canWrite || busyRef.current) return;
    busyRef.current = true;
    stopRef.current = false;
    setBusy(true);
    setGenericError(undefined);
    try {
      const next = await recheckHeroImport(api, campaignId, checkPlan, run, () => activeRef.current && canWriteRef.current && !stopRef.current);
      if (!activeRef.current) return;
      setRun(next);
      setPlan(undefined);
      setPlanErrors([]);
      if (!next.needsCheck) setStep(3);
      setNotice(next.needsCheck ? '' : 'Текущее состояние перечитано. Проверьте действия и повторно откройте итог перед подтверждением.');
      try { onResult?.(checkPlan, next); } catch { }
      if (next.error instanceof CampaignApiError && next.error.status === 403) reloadPermissions();
    } catch (error) {
      if (activeRef.current) setGenericError(error);
    } finally {
      busyRef.current = false;
      if (activeRef.current) setBusy(false);
    }
  };

  const stop = () => { stopRef.current = true; setStopRequested(true); };
  const requestClose = () => {
    if (busyRef.current) return;
    if (run?.needsCheck || (run?.attempted && !complete)) {
      if (!window.confirm('Часть данных уже могла измениться. Отмена не откатит сохранённые изменения и не выяснит неизвестный результат. Закрыть мастер?')) return;
    } else if (dirty && !window.confirm('Выбранные данные не импортированы. Отказаться от текущего выбора?')) return;
    clearDirty();
    onClose();
  };

  const selectSource = (value: string) => {
    invalidatePlan();
    const sourceIndex = value === '' ? -1 : Number(value);
    setDrafts(current => current.map(draft => ({ ...draft, selected: draft.sourceIndex === sourceIndex })));
  };
  const setTarget = (draft: HeroDraft, targetMode: HeroDraft['targetMode'], targetId = '') => updateDraft(draft.sourceIndex, current => {
    const source = sources[current.sourceIndex];
    const modeChanged = current.targetMode !== targetMode;
    const nameValid = Boolean(source && hasOwnString(source, 'name') && (source.data.name as string).trim().length > 0);
    const selectName = targetMode === 'new' ? nameValid : modeChanged ? false : current.selectName;
    const selectDescription = targetMode === 'new' ? Boolean(source && typeof source.data.description === 'string') : modeChanged ? false : current.selectDescription;
    const fields = Object.fromEntries(Object.entries(current.fields).map(([key, choice]) => {
      const selected = targetMode === 'new' ? true : modeChanged ? false : choice.selected;
      return [key, { ...choice, selected, targetId: '', action: 'skip' as HeroPartAction }];
    }));
    return {
      ...current,
      targetMode,
      targetId,
      newName: targetMode === 'new' ? (nameValid ? source!.data.name as string : '') : '',
      importance: targetMode === 'new' ? current.importance : '',
      selectName,
      selectDescription,
      nameAction: selectName ? 'replace' : 'skip',
      descriptionAction: selectDescription ? 'replace' : 'skip',
      mappingTargetKey: undefined,
      fields
    };
  });

  const currentValue = (targetKey: string, fieldId: string) => {
    const snapshot = snapshots[targetKey];
    const found = snapshot?.sheet.baseFields.find(field => field.id === fieldId);
    if (found) return `${found.isExplicit ? '' : 'Из шаблона: '}${importValueDisplay(found.effectiveValue)}`;
    if (snapshot) return 'Не задано';
    const templateField = currentTemplate?.data.baseFields.find(field => field.id === fieldId);
    return templateField ? importValueDisplay(templateField.value) : 'Не задано';
  };

  const stepDescription = step === 1 ? 'выберите персонажа и цель' : step === 2 ? 'выберите данные' : step === 3 ? 'задайте сопоставление полей' : 'итог';
  const allComplete = !busy && completeRun(run, plan);
  const existingTargets = definitions.data?.characters ?? [];
  const runIncomplete = Boolean(run?.attempted && !allComplete);
  const frozenPlan = step === 4 ? plan ?? reportPlan : undefined;
  const confirmDisabled = !plan || !canWrite || busy || resourceBusy || Boolean(resourceError) || !definitions.data || Boolean(genericError) || Boolean(run?.error) || Boolean(run?.needsCheck) || allComplete;
  const targetNextDisabled = !selectedDraft || !selectedDraft.targetMode || !definitions.data || resourceBusy || Boolean(resourceError) || (selectedDraft.targetMode === 'new' ? !selectedDraft.newName.trim() : !selectedDraft.targetId || !snapshots[selectedDraft.targetId]);
  const statusLabel = (key: string) => run?.statuses[key] === 'applied' ? 'Уже сохранено' : run?.statuses[key] === 'verified' ? 'Создание подтверждено' : run?.statuses[key] === 'unknown' ? 'Результат неизвестен' : run?.statuses[key] === 'failed' ? 'Не сохранено' : 'Будет выполнено после подтверждения';
  const beforeFieldValue = (targetKey: string, fieldId: string) => {
    const snapshot = frozenPlan?.targets[targetKey];
    const field = snapshot?.sheet.baseFields.find(item => item.id === fieldId);
    if (field) return `${field.isExplicit ? '' : 'Из шаблона: '}${importValueDisplay(field.effectiveValue)}`;
    if (snapshot) return 'Не задано';
    const isCreated = Boolean(frozenPlan?.steps.some(item => item.kind === 'create' && item.targetKey === targetKey));
    if (!isCreated) return 'Не задано';
    return `Из шаблона: ${importValueDisplay(frozenPlan?.template.data.baseFields.find(item => item.id === fieldId)?.value)}`;
  };
  const targetPathLabel = (targetKey: string) => {
    const create = frozenPlan?.steps.find(item => item.kind === 'create' && item.targetKey === targetKey);
    if (create?.kind === 'create') {
      const status = run?.statuses[create.key];
      const name = frozenPlan?.targets[targetKey]?.metadata.name ?? run?.createdMetadata?.[targetKey]?.name ?? create.name;
      return ['applied', 'verified'].includes(status ?? '') ? `Создан: ${name}` : `Создать: ${create.name}`;
    }
    return `В существующего: ${frozenPlan?.targets[targetKey]?.metadata.name ?? 'Персонаж'}`;
  };
  const sourceLabel = (sourceIndex: number) => sources[sourceIndex]?.name ?? `Персонаж ${sourceIndex + 1}`;
  const proceed = () => setStep(value => Math.min(3, value + 1));
  const proceedFromTarget = () => {
    const draft = selected[0];
    if (!draft || !definitions.data || controlsDisabled || resourceBusy || resourceError || !draft.targetMode) return;
    if (draft.targetMode === 'new') {
      if (!draft.newName.trim()) return;
      setStep(3);
      return;
    }
    if (!draft.targetId || !snapshots[draft.targetId]) return;
    setStep(2);
  };
  const goBack = () => {
    if (step === 4) {
      setPlan(undefined);
      setPlanErrors([]);
      setStep(3);
      return;
    }
    if (step === 3) {
      setStep(selected[0]?.targetMode === 'new' ? 1 : 2);
      return;
    }
    setStep(value => Math.max(1, value - 1));
  };

  return <ModalPortal isOpen onClose={requestClose} title="Импорт персонажа" size="wide" dismissDisabled={busy}>
    <p>{`Шаг ${step} из 4: ${stepDescription}`}</p>
    {mode !== 'gm' && <p role="alert">Импорт доступен только в пространстве ведущего.</p>}
    {permissionsLoading && <p role="status">Проверка прав…</p>}
    {!permissionsLoading && mode === 'gm' && !permissions.canWrite && <p role="alert">Нет прав на запись в кампанию.</p>}
    {step === 1 && <section aria-label="Выбор персонажа">
      <Field label="Персонаж из файла" htmlFor="hero-import-source">
        <Select id="hero-import-source" value={selectedSourceValue} disabled={locked || busy || !canWrite} onChange={event => selectSource(event.target.value)}>
          <option value="">Выберите персонажа</option>{sources.map((source, index) => <option key={index} value={String(index)}>{source.name}</option>)}
        </Select>
      </Field>
      {selected.map(draft => {
        const source = sources[draft.sourceIndex];
        if (!source) return null;
        const identityDisabled = locked || busy || !canWrite || controlsDisabled;
        return <Panel key={draft.sourceIndex} title={source.name}>
          <Field label={`Цель для ${source.name}`} htmlFor={`hero-target-mode-${draft.sourceIndex}`}>
            <Select id={`hero-target-mode-${draft.sourceIndex}`} value={draft.targetMode ?? ''} disabled={identityDisabled} onChange={event => setTarget(draft, event.target.value as HeroDraft['targetMode'])}>
              <option value="">Выберите цель</option><option value="new">Создать нового персонажа</option><option value="existing">Существующий персонаж</option>
            </Select>
          </Field>
          {draft.targetMode === 'existing' && <Field label={`Существующий персонаж для ${source.name}`} htmlFor={`hero-target-id-${draft.sourceIndex}`}>
            <Select id={`hero-target-id-${draft.sourceIndex}`} value={draft.targetId} disabled={identityDisabled} onChange={event => setTarget(draft, 'existing', event.target.value)}>
              <option value="">Выберите персонажа</option>{existingTargets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
            </Select>
          </Field>}
          {draft.targetMode === 'new' && <>
            <Field label={`Имя нового персонажа ${source.name}`} htmlFor={`hero-new-name-${draft.sourceIndex}`}>
              <Input id={`hero-new-name-${draft.sourceIndex}`} value={draft.newName} disabled={identityDisabled} onChange={event => updateDraft(draft.sourceIndex, value => ({ ...value, newName: event.target.value }))} />
            </Field>
            <Field label={`Важность персонажа ${source.name}`} htmlFor={`hero-importance-${draft.sourceIndex}`}>
              <Select id={`hero-importance-${draft.sourceIndex}`} value={draft.importance} disabled={identityDisabled} onChange={event => updateDraft(draft.sourceIndex, value => ({ ...value, importance: event.target.value as HeroDraft['importance'] }))}>
                {importanceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
          </>}
        </Panel>;
      })}
      {sources.length === 0 && <p>В файле нет персонажей для импорта.</p>}
      {resourceBusy && <p role="status">Загрузка шаблона и персонажей…</p>}
      {Boolean(resourceError) && <ApiError error={resourceError} onRetry={() => { if (definitions.error) definitions.reload(); else targetResources.reload(); }} />}
    </section>}

    {step === 2 && selected.some(draft => draft.targetMode === 'existing') && <section aria-label="Выбор данных">
      {selected.map(draft => {
        const source = sources[draft.sourceIndex];
        if (!source) return null;
        const nameValid = hasOwnString(source, 'name') && (source.data.name as string).trim().length > 0;
        const descriptionValid = hasOwnString(source, 'description');
        return <Panel key={draft.sourceIndex} title={source.name}>
          <label><Checkbox aria-label={`Имя ${source.name}`} checked={draft.selectName} disabled={locked || busy || !canWrite || !nameValid} onChange={event => updateDraft(draft.sourceIndex, value => ({ ...value, selectName: event.target.checked, nameAction: event.target.checked ? 'replace' : 'skip' }))} /> Имя</label>
          {!nameValid && <p>Имя в исходных данных отсутствует или некорректно.</p>}
          <label><Checkbox aria-label={`Описание ${source.name}`} checked={draft.selectDescription} disabled={locked || busy || !canWrite || !descriptionValid} onChange={event => updateDraft(draft.sourceIndex, value => ({ ...value, selectDescription: event.target.checked, descriptionAction: event.target.checked ? 'replace' : 'skip' }))} /> Описание</label>
          {!descriptionValid && <p>Описание в исходных данных отсутствует или некорректно.</p>}
          <label><Checkbox aria-label={`Поля ${source.name}`} checked={source.fields.length > 0 && source.fields.every(field => draft.fields[field.key]?.selected)} disabled={locked || busy || !canWrite || source.fields.length === 0} onChange={event => updateDraft(draft.sourceIndex, value => ({ ...value, fields: Object.fromEntries(Object.entries(value.fields).map(([key, choice]) => [key, { ...choice, selected: event.target.checked }])) }))} /> Поля ({source.fields.length})</label>
          {source.fields.length === 0 && <p>В файле нет полей.</p>}
          <p>Формулы, формулы модификаторов и максимальные значения не импортируются.</p>
        </Panel>;
      })}
      {selected.length === 0 && <p>Вернитесь назад и выберите хотя бы одного персонажа.</p>}
    </section>}

    {(step === 3 || step === 4) && <section aria-label={step === 3 ? 'Действия импорта' : 'Итог импорта'}>
      {resourceBusy && <p role="status">Загрузка шаблона и персонажей…</p>}
      {Boolean(resourceError) && <ApiError error={resourceError} onRetry={() => { if (definitions.error) definitions.reload(); else targetResources.reload(); }} />}
      {!canWrite && <p>Действия недоступны без актуального права записи.</p>}
      {step === 3 && <>
      {selected.map(draft => {
        const source = sources[draft.sourceIndex];
        if (!source) return null;
        const targetKey = draft.targetMode === 'new' ? requestIds[draft.sourceIndex] : draft.targetMode === 'existing' ? draft.targetId : '';
        const snapshot = targetKey ? snapshots[targetKey] : undefined;
        const mapDisabled = controlsDisabled || !targetKey || (draft.targetMode === 'existing' && !snapshot) || Boolean(run?.needsCheck);
        return <Panel key={draft.sourceIndex} title={source.name}>
          {draft.targetMode === 'existing' && snapshot && <p>Существующий персонаж: {snapshot.metadata.name}</p>}
          {draft.targetMode === 'existing' && draft.selectName && <p>Имя: {snapshot?.metadata.name ?? '—'} → {String(source.data.name ?? '')}</p>}
          {draft.targetMode === 'existing' && draft.selectDescription && <p>Описание: {snapshot?.sheet.description ?? '—'} → {String(source.data.description ?? '')}</p>}
          {source.fields.some(field => draft.fields[field.key]?.selected) ? <DataTable aria-label={`Сопоставление полей ${source.name}`} minWidth="55rem"><thead><tr><th>Исходное поле</th><th>Ключ</th><th>Значение</th><th>Поле назначения</th><th>Текущее значение</th></tr></thead><tbody>
            {source.fields.filter(field => draft.fields[field.key]?.selected).map((field, index) => {
              const choice = draft.fields[field.key];
              const candidates = compatibleHeroFields(field, snapshot ? snapshot.sheet.baseFields : currentTemplate?.data.baseFields ?? []);
              const targetField = candidates.find(candidate => candidate.id === choice.targetId);
              return <tr key={`${field.key}:${index}`}><th scope="row">{field.name}</th><td>{field.key}</td><td>{sourceFieldValue(field)}</td><td>
                <Field label={`Поле назначения ${source.name}: ${field.name}`} htmlFor={`hero-field-target-${draft.sourceIndex}-${index}`}>
                  <Select id={`hero-field-target-${draft.sourceIndex}-${index}`} value={choice.targetId} disabled={mapDisabled || candidates.length === 0 || ['applied', 'verified'].includes(run?.statuses[`${draft.sourceIndex}:value:${field.key}`] ?? '')} onChange={event => updateField(draft.sourceIndex, field.key, current => ({ ...current, targetId: event.target.value, action: event.target.value ? 'replace' : 'skip' }))}>
                    <option value="">Не импортировать</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
                  </Select>
                </Field>
                {candidates.length === 0 && <p>{Object.prototype.hasOwnProperty.call(field.data, 'value') ? 'Нет подходящего поля — поле не импортируется.' : 'Нет явного значения — поле не импортируется.'}</p>}
                {candidates.length > 0 && !choice.targetId && <p>По умолчанию не импортируется. Выберите существующее поле для переноса.</p>}
              </td><td>{targetField ? currentValue(targetKey, targetField.id) : '—'}</td></tr>;
            })}
          </tbody></DataTable> : <p>Поля не выбраны.</p>}
        </Panel>;
      })}

      {planErrors.length > 0 && <ul role="alert">{planErrors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
      {notice && <p role="status">{notice}</p>}
      {Boolean(genericError) && <ApiError error={genericError} />}
      {Boolean(run?.error) && <ApiError error={run?.error} />}
      {run?.needsCheck && <Button type="button" variant="secondary" disabled={busy || !canWrite} busy={busy} onClick={() => void recheck()}>Перечитать данные</Button>}
      </>}
      {step === 4 && frozenPlan && <>
        <p>Проверьте итог и подтвердите импорт выбранных данных.</p>
        <ul>{Array.from(new Set(frozenPlan.steps.map(item => item.sourceIndex))).map(sourceIndex => {
          const sourceSteps = frozenPlan.steps.filter(item => item.sourceIndex === sourceIndex);
          const targetKey = sourceSteps[0].targetKey;
          const creation = sourceSteps.find(item => item.kind === 'create');
          const nameStep = sourceSteps.find(item => item.kind === 'name');
          const descriptionStep = sourceSteps.find(item => item.kind === 'description');
          const values = sourceSteps.filter((item): item is Extract<HeroImportPlan['steps'][number], { kind: 'value' }> => item.kind === 'value');
          const currentName = frozenPlan.targets[targetKey]?.metadata.name ?? '';
          const currentDescription = frozenPlan.targets[targetKey]?.sheet.description ?? '';
          return <li key={sourceIndex}>
            <strong>{sourceLabel(sourceIndex)}</strong>{' → '}{targetPathLabel(targetKey)}
            <ul>
              {creation?.kind === 'create' && <li>Создание персонажа «{creation.name}» — {statusLabel(creation.key)}</li>}
              {nameStep?.kind === 'name' && <li>Имя: {currentName} → {nameStep.name} — {statusLabel(nameStep.key)}</li>}
              {descriptionStep?.kind === 'description' && <li>Описание: {importValueDisplay(currentDescription)} → {importValueDisplay(descriptionStep.description)} — {statusLabel(descriptionStep.key)}</li>}
              {values.length > 0 && <li>Поля<ul>{values.map(item => {
                const sourceField = sources[sourceIndex]?.fields.find(field => field.key === item.sourceKey);
                return <li key={item.key}>{sourceField?.name ?? item.sourceKey} → {item.title}: {beforeFieldValue(item.targetKey, item.fieldId)} → {importValueDisplay(item.value)} — {statusLabel(item.key)}</li>;
              })}</ul></li>}
            </ul>
          </li>;
        })}</ul>
        {run && <HeroImportSummary plan={frozenPlan} run={run} campaignId={campaignId} />}
        {stopRequested && busy && <p role="status">Остановка запрошена. Текущий запрос может завершиться.</p>}
        {Boolean(genericError) && <ApiError error={genericError} />}
        {Boolean(run?.error) && <ApiError error={run?.error} />}
        {allComplete && <p role="status">Импорт выбранных данных завершён.</p>}
        {runIncomplete && <p>Закрытие мастера не отменяет уже сохранённые изменения.</p>}
      </>}
      {step === 4 && !frozenPlan && <p>Итог недоступен. Вернитесь к действиям и сформируйте его заново.</p>}
      {step === 4 && <ActionRow>
        <Button type="button" disabled={confirmDisabled} busy={busy} onClick={() => void execute()}>Подтвердить импорт</Button>
        {busy && <Button type="button" variant="secondary" onClick={stop}>Остановить</Button>}
        {run?.needsCheck && <Button type="button" variant="secondary" disabled={busy || !canWrite} busy={busy} onClick={() => void recheck()}>Перечитать данные</Button>}
        {allComplete ? <Button type="button" variant="secondary" onClick={requestClose}>Закрыть</Button> : <Button type="button" variant="secondary" disabled={busy} onClick={requestClose}>Отменить импорт</Button>}
      </ActionRow>}
    </section>}

    <ActionRow>
      <Button type="button" variant="secondary" disabled={busy || step === 1 || (locked && step !== 4)} onClick={goBack}>Назад</Button>
      {step === 1 && <Button type="button" disabled={busy || !canWrite || targetNextDisabled || locked} onClick={proceedFromTarget}>Далее</Button>}
      {step === 2 && <Button type="button" disabled={busy || !canWrite || locked} onClick={proceed}>Далее</Button>}
      {step === 3 && <Button type="button" disabled={controlsDisabled || Boolean(run?.needsCheck) || Boolean(genericError) || Boolean(run?.error) || allComplete} onClick={prepare}>Далее</Button>}
    </ActionRow>
  </ModalPortal>;
};

export default HeroImportWizard;
