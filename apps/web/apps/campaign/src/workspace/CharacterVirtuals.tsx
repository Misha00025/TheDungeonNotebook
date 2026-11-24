import React, { useEffect, useMemo, useState } from 'react';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { useResource } from './hooks';
import { ApiError } from './Feedback';
import { VirtualFieldsEditor } from './VirtualFieldsEditor';
import type { ComputedField, EffectiveBaseField, FormulaMetadata, Revision, VirtualField, VirtualFieldInput } from './types';
import { stringifyJson } from './json';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import commonStyles from '@tdn/shared/styles/common.module.css';

type Props = { campaignId: number; characterId: string; baseFields: EffectiveBaseField[]; virtualFields: ComputedField[]; canWrite: boolean; busy: boolean; blocked: boolean; write: <T extends { contentRevision: Revision }>(operation: (revision: Revision) => Promise<T>, confirmed: (result: T) => void) => Promise<void> };
const CharacterVirtuals: React.FC<Props> = ({ campaignId, characterId, baseFields, virtualFields, canWrite, busy, blocked, write }) => {
  const { api, sessionKey } = useWorkspace();
  const scope = `${sessionKey}:${campaignId}:${characterId}`;
  const [open, setOpen] = useState(false);
  const custom = useResource(`${scope}:custom-virtuals`, () => api.getCustomVirtualFields(campaignId, characterId), open);
  const overrides = useResource(`${scope}:overrides`, () => api.getOverrides(campaignId, characterId), open);
  const [draft, setDraft] = useState<VirtualFieldInput[]>([]);
  const [baseline, setBaseline] = useState<VirtualFieldInput[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [formulas, setFormulas] = useState<FormulaMetadata[]>([]);
  const [templateFields, setTemplateFields] = useState<VirtualField[]>([]);
  const [templateFieldsLoaded, setTemplateFieldsLoaded] = useState(false);
  const [definitionError, setDefinitionError] = useState<unknown[]>([]);
  const [valid, setValid] = useState(true);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [overrideBaseline, setOverrideBaseline] = useState<Record<string, string>>({});
  useEffect(() => {
    if (custom.data && !initialized) {
      const fields = custom.data.virtualFields.map(field => ({ ...field, bindings: { ...field.bindings } }));
      setDraft(fields); setBaseline(fields); setInitialized(true);
    }
  }, [custom.data, initialized]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.allSettled([api.listFormulas(campaignId), api.getTemplateVirtualFields(campaignId)]).then(results => {
      if (!active) return;
      const failures: unknown[] = [];
      if (results[0].status === 'fulfilled') setFormulas(results[0].value); else failures.push(results[0].reason);
      if (results[1].status === 'fulfilled') { setTemplateFields(results[1].value.virtualFields); setTemplateFieldsLoaded(true); } else { setTemplateFieldsLoaded(false); failures.push(results[1].reason); }
      setDefinitionError(failures);
    });
    return () => { active = false; };
  }, [open, api, campaignId]);
  useEffect(() => {
    if (!overrides.data) return;
    const next = Object.fromEntries(overrides.data.overrides.map(item => [item.virtualFieldId, item.expression]));
    setOverrideDrafts(current => ({ ...next, ...Object.fromEntries(Object.entries(current).filter(([id, value]) => value !== overrideBaseline[id])) }));
    setOverrideBaseline(next);
  }, [overrides.data]);
  const customDirty = stringifyJson(draft as never) !== stringifyJson(baseline as never);
  const savedIds = useMemo(() => new Set(baseline.flatMap(field => field.id ? [field.id] : [])), [baseline]);
  const activeOverrides = templateFieldsLoaded ? templateFields : virtualFields.filter(field => !savedIds.has(field.id)).map(field => ({ ...field, formulaId: '', bindings: {} } as VirtualField));
  const existingOverrides = overrides.data?.overrides ?? [];
  const targets = [...activeOverrides, ...existingOverrides.map(item => virtualFields.find(field => field.id === item.virtualFieldId) ?? { id: item.virtualFieldId, key: item.virtualFieldId, title: item.virtualFieldId, description: '', resultType: 'Number' as const, value: null, diagnostic: null })].filter((field, index, all) => all.findIndex(other => other.id === field.id) === index);
  const overrideDirty = Object.keys(overrideDrafts).some(id => overrideDrafts[id] !== overrideBaseline[id]);
  const dirty = customDirty || overrideDirty;
  useDirtyDraft(`character-virtuals-${scope}`, dirty);
  const saveCustom = () => {
    if (!canWrite || busy || blocked || !customDirty || !valid || custom.error || !initialized) return;
    void write(revision => api.putCustomVirtualFields(campaignId, characterId, { expectedRevision: revision, virtualFields: draft }), result => {
    const fields = result.virtualFields.map(field => ({ ...field, bindings: { ...field.bindings } })); setDraft(fields); setBaseline(fields);
    });
  };
  const saveOverride = (id: string) => {
    const submitted = overrideDrafts[id] ?? '';
    if (!canWrite || busy || blocked || !overrides.data || submitted === overrideBaseline[id]) return;
    void write(revision => api.putOverride(campaignId, characterId, id, { expression: submitted, expectedRevision: revision }), () => setOverrideBaseline(current => ({ ...current, [id]: submitted })));
  };
  const resetOverride = (id: string) => {
    if (!canWrite || busy || blocked || !overrides.data || !Object.prototype.hasOwnProperty.call(overrideBaseline, id)) return;
    void write(revision => api.resetOverride(campaignId, characterId, id, revision), () => {
      setOverrideDrafts(current => { const next = { ...current }; delete next[id]; return next; });
      setOverrideBaseline(current => { const next = { ...current }; delete next[id]; return next; });
    });
  };
  if (!open) return <button type="button" className={buttonStyles.button} disabled={busy} onClick={() => setOpen(true)}>Индивидуальные формулы</button>;
  return <section className={commonStyles.card}><h2>Индивидуальные формулы</h2><button type="button" className={buttonStyles.button} disabled={busy} onClick={() => { if (dirty && !window.confirm('Отменить черновики индивидуальных формул?')) return; setDraft(baseline); setOverrideDrafts(overrideBaseline); setOpen(false); }}>Закрыть</button>
    {custom.loading && <p>Загрузка индивидуальных полей…</p>}{Boolean(custom.error) && <ApiError error={custom.error} onRetry={custom.reload} />}
    {definitionError.map((error, index) => <ApiError key={index} error={error} />)}
    {initialized && <><VirtualFieldsEditor campaignId={campaignId} fields={draft} onChange={setDraft} formulas={formulas} baseFields={baseFields} templateVirtualFields={templateFields} disabled={!canWrite || busy || blocked || Boolean(custom.error)} onValidityChange={setValid} />
      <button type="button" className={buttonStyles.button} disabled={!canWrite || busy || blocked || !customDirty || !valid || Boolean(custom.error)} onClick={saveCustom}>Сохранить индивидуальные поля</button>
    </>}
    {overrides.loading && <p>Загрузка переопределений…</p>}{Boolean(overrides.error) && <ApiError error={overrides.error} onRetry={overrides.reload} />}
      {targets.map(field => { const id = field.id; const baselineExpression = overrideBaseline[id]; const expression = overrideDrafts[id] ?? baselineExpression ?? ''; const hasOverride = Object.prototype.hasOwnProperty.call(overrideBaseline, id); const canEdit = Boolean(overrides.data && !overrides.loading && !overrides.error); return <fieldset key={id} aria-label={`Переопределение ${field.title}`} className={commonStyles.card} disabled={!canWrite || busy || blocked || !canEdit}><legend>{field.title}</legend><label>Формула<textarea className={`${inputStyles.input} ${inputStyles.multiline}`} value={expression} onChange={event => setOverrideDrafts(current => ({ ...current, [id]: event.target.value }))} /></label><button type="button" className={buttonStyles.button} disabled={!canEdit || expression === baselineExpression} onClick={() => saveOverride(id)}>Сохранить формулу</button>{hasOverride && <button type="button" className={buttonStyles.button} disabled={!canEdit} onClick={() => resetOverride(id)}>Сбросить формулу</button>}</fieldset>; })}
  </section>;
};
export { CharacterVirtuals };
