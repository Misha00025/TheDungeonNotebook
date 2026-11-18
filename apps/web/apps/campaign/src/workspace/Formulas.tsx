import React, { useEffect, useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace, useDirtyDraft, useDirtyState } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { CampaignApiError } from './api';
import { useResource, useMutation } from './hooks';
import type { DefinitionCreate, FormulaContentEnvelope, FormulaMetadata } from './types';
import { ApiError } from './Feedback';
import { ActionRow, Button, Field, Input, ModalPortal, Textarea } from '@tdn/shared';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';

const parametersFrom = (text: string) => text.split('\n').filter((item, index, values) => index < values.length - 1 || item.length > 0);
const isUncertain = (failure: unknown) => failure instanceof CampaignApiError && (failure.unknownOutcome || ['already_published', 'content_already_prepared', 'creation_already_published'].includes(failure.problem.code));

export const CreateFormula: React.FC<{ campaignId: number; onCreated: (formula: DefinitionCreate) => void; onCancel: () => void }> = ({ campaignId, onCreated, onCancel }) => {
  const { api, notifyInvalidation } = useWorkspace();
  const { permissions, permissionsLoading, campaign } = useCampaignWorkspace();
  const writable = permissions.canWrite && !permissionsLoading && campaign.id === campaignId;
  const [name, setName] = useState('');
  const [expression, setExpression] = useState('');
  const [parametersText, setParametersText] = useState('');
  const nameId = useId();
  const expressionId = useId();
  const parametersId = useId();
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<unknown>();
  const [checkError, setCheckError] = useState<unknown>();
  const [uncertain, setUncertain] = useState(false);
  const active = React.useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const dirty = Boolean(name || expression || parametersText);
  const clearDirty = useDirtyDraft(`formula-create-${campaignId}-${requestId}`, dirty);
  const mutation = useMutation(async () => api.createFormula(campaignId, { requestId, name: name.trim(), expression, parameters: parametersFrom(parametersText) }));
  const lookup = async () => {
    const metadata = await api.getFormula(campaignId, requestId);
    const content = await api.getFormulaContent(campaignId, requestId);
    return { ...metadata, contentRevision: content.contentRevision } as DefinitionCreate;
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!writable || !name.trim() || mutation.busy || uncertain) return;
    try {
      const result = await mutation.run();
      if (result && active.current) { clearDirty(); onCreated(result); }
    } catch (failure) {
      if (active.current) { setError(failure); if (failure instanceof CampaignApiError && failure.status === 403) notifyInvalidation(); setUncertain(isUncertain(failure)); }
    }
  };
  const check = async () => {
    setCheckError(undefined);
    if (!writable) return;
    try { const result = await lookup(); if (active.current) { clearDirty(); onCreated(result); } }
    catch (failure) { if (active.current) setCheckError(failure); }
  };
  const cancel = () => {
    if (mutation.busy) return;
    if (uncertain) {
      if (!window.confirm('Результат создания формулы неизвестен. Отказаться от проверки? Формула может существовать.')) return;
    } else if (dirty && !window.confirm('Отказаться от черновика формулы?')) return;
    clearDirty(); onCancel();
  };
  return <ModalPortal isOpen title="Создать формулу" onClose={cancel} dismissDisabled={mutation.busy}>
    <form onSubmit={create}>
      <Field label="Название" htmlFor={nameId}><Input id={nameId} autoFocus value={name} disabled={!writable || uncertain || mutation.busy} onChange={event => setName(event.target.value)} /></Field>
      <Field label="Выражение" htmlFor={expressionId}><Textarea id={expressionId} value={expression} disabled={!writable || uncertain || mutation.busy} onChange={event => setExpression(event.target.value)} /></Field>
      <Field label="Параметры, по одному в строке" htmlFor={parametersId}><Textarea id={parametersId} value={parametersText} disabled={!writable || uncertain || mutation.busy} onChange={event => setParametersText(event.target.value)} /></Field>
      {Boolean(error) && <ApiError error={error} />}{Boolean(checkError) && <ApiError error={checkError} />}
      <ActionRow>
        {uncertain ? <Button type="button" disabled={!writable} onClick={() => void check()}>Проверить создание</Button> : <Button type="submit" disabled={!writable || mutation.busy || !name.trim()}>Создать</Button>}
        <Button variant="secondary" type="button" disabled={mutation.busy} onClick={cancel}>{uncertain ? 'Отказаться от проверки' : 'Отмена'}</Button>
      </ActionRow>
    </form>
  </ModalPortal>;
};

export const FormulaEditor: React.FC<{ campaignId: number; formula: FormulaMetadata }> = ({ campaignId, formula }) => {
  const { api, notifyInvalidation } = useWorkspace();
  const { permissions, permissionsLoading, campaign: activeCampaign } = useCampaignWorkspace();
  const writable = permissions.canWrite && !permissionsLoading && activeCampaign.id === campaignId;
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<unknown>();
  const [name, setName] = useState('');
  const [baselineName, setBaselineName] = useState('');
  const [metadataRevision, setMetadataRevision] = useState(formula.metadataRevision);
  const [expression, setExpression] = useState('');
  const [baselineExpression, setBaselineExpression] = useState('');
  const [parametersText, setParametersText] = useState('');
  const [baselineParametersText, setBaselineParametersText] = useState('');
  const [contentRevision, setContentRevision] = useState<FormulaContentEnvelope['contentRevision']>(1);
  const [nameError, setNameError] = useState<unknown>();
  const [contentError, setContentError] = useState<unknown>();
  const [nameBlocked, setNameBlocked] = useState(false);
  const [contentBlocked, setContentBlocked] = useState(false);
  const [nameSnapshot, setNameSnapshot] = useState<FormulaMetadata>();
  const [contentSnapshot, setContentSnapshot] = useState<FormulaContentEnvelope>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [nameSaved, setNameSaved] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);
  const nameDirty = loaded && name !== baselineName;
  const contentDirty = loaded && (expression !== baselineExpression || parametersText !== baselineParametersText);
  useDirtyDraft(`formula-editor-name-${formula.id}`, nameDirty);
  useDirtyDraft(`formula-editor-content-${formula.id}`, contentDirty);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setLoadError(undefined);
    Promise.all([api.getFormula(campaignId, formula.id), api.getFormulaContent(campaignId, formula.id)]).then(([metadata, content]) => {
      if (!active) return;
      setName(metadata.name); setBaselineName(metadata.name); setMetadataRevision(metadata.metadataRevision);
      setExpression(content.data.expression); setBaselineExpression(content.data.expression);
      const text = content.data.parameters.join('\n'); setParametersText(text); setBaselineParametersText(text);
      setContentRevision(content.contentRevision); setLoaded(true);
    }, failure => { if (active) setLoadError(failure); });
    return () => { active = false; };
  }, [api, campaignId, formula.id, loadAttempt]);
  const rename = useMutation(async () => {
    if (!writable || nameBlocked || !nameDirty || !name.trim()) return undefined;
    const result = await api.renameFormula(campaignId, formula.id, { name: name.trim(), expectedRevision: metadataRevision });
    setName(result.name); setBaselineName(result.name); setMetadataRevision(result.metadataRevision); setNameError(undefined); setNameBlocked(false); setNameSnapshot(undefined);
    setNameSaved(true);
    return result;
  });
  const saveContent = useMutation(async () => {
    if (!writable || contentBlocked || !contentDirty) return undefined;
    const result = await api.putFormulaContent(campaignId, formula.id, { expression, parameters: parametersFrom(parametersText), expectedRevision: contentRevision });
    setExpression(result.data.expression); setBaselineExpression(result.data.expression);
    const text = result.data.parameters.join('\n'); setParametersText(text); setBaselineParametersText(text);
    setContentRevision(result.contentRevision); setContentError(undefined); setContentBlocked(false); setContentSnapshot(undefined);
    setContentSaved(true);
    return result;
  });
  const refreshName = async () => {
    try { const latest = await api.getFormula(campaignId, formula.id); setMetadataRevision(latest.metadataRevision); setNameSnapshot(latest); setNameBlocked(false); }
    catch (failure) { setNameError(failure); }
  };
  const refreshContent = async () => {
    try { const latest = await api.getFormulaContent(campaignId, formula.id); setContentRevision(latest.contentRevision); setContentSnapshot(latest); setContentBlocked(false); }
    catch (failure) { setContentError(failure); }
  };
  const handleNameError = (failure: unknown) => { setNameError(failure); if (failure instanceof CampaignApiError && failure.status === 403) notifyInvalidation(); if (failure instanceof CampaignApiError && (failure.status === 409 || failure.unknownOutcome)) setNameBlocked(true); };
  const handleContentError = (failure: unknown) => { setContentError(failure); if (failure instanceof CampaignApiError && failure.status === 403) notifyInvalidation(); if (failure instanceof CampaignApiError && (failure.status === 409 || failure.unknownOutcome)) setContentBlocked(true); };
  if (loadError) return <ApiError error={loadError} onRetry={() => { setLoadError(undefined); setLoaded(false); setLoadAttempt(value => value + 1); }} />;
  if (!loaded) return <p>Загрузка формулы…</p>;
  return <div className={styles.page}>
      <form className={commonStyles.form} onSubmit={event => { event.preventDefault(); if (writable && !nameBlocked && !rename.busy && nameDirty) void rename.run().catch(handleNameError); }}><h2>Метаданные</h2>
       <label className={commonStyles.formGroup}>Название<input className={inputStyles.input} disabled={!writable || rename.busy} value={name} onChange={event => { setName(event.target.value); setNameSaved(false); }} /></label>
       {Boolean(nameError) && <ApiError error={nameError} />}{nameBlocked && <button type="button" className={buttonStyles.button} onClick={() => void refreshName()}>Перечитать метаданные</button>}
      {nameSnapshot && <aside className={commonStyles.card}><h3>Актуальные метаданные (черновик не изменён)</h3><p>{nameSnapshot.name}</p></aside>}
        <div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!writable || !nameDirty || rename.busy || nameBlocked || !name.trim()}>Сохранить название</button><button type="button" className={buttonStyles.button} onClick={() => { if (window.confirm('Отменить черновик названия?')) setName(baselineName); }} disabled={!nameDirty || rename.busy}>Отменить</button></div>
      {nameSaved && !nameDirty && <p role="status">Название сохранено.</p>}
    </form>
      <form className={commonStyles.form} onSubmit={event => { event.preventDefault(); if (writable && !contentBlocked && !saveContent.busy && contentDirty) void saveContent.run().catch(handleContentError); }}><h2>Содержимое</h2>
        <label className={commonStyles.formGroup}>Выражение<textarea className={inputStyles.input} disabled={!writable || saveContent.busy} value={expression} onChange={event => { setExpression(event.target.value); setContentSaved(false); }} /></label>
        <label className={commonStyles.formGroup}>Параметры, по одному в строке<textarea className={inputStyles.input} disabled={!writable || saveContent.busy} value={parametersText} onChange={event => { setParametersText(event.target.value); setContentSaved(false); }} /></label>
       {Boolean(contentError) && <ApiError error={contentError} />}{contentBlocked && <button type="button" className={buttonStyles.button} onClick={() => void refreshContent()}>Перечитать содержимое</button>}
      {contentSnapshot && <aside className={commonStyles.card}><h3>Актуальное содержимое (черновик не изменён)</h3><p>{contentSnapshot.data.expression}</p><ul>{contentSnapshot.data.parameters.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul></aside>}
        <div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!writable || !contentDirty || saveContent.busy || contentBlocked}>Сохранить содержимое</button><button type="button" className={buttonStyles.button} onClick={() => { if (window.confirm('Отменить черновик содержимого?')) { setExpression(baselineExpression); setParametersText(baselineParametersText); } }} disabled={!contentDirty || saveContent.busy}>Отменить</button></div>
      {contentSaved && !contentDirty && <p role="status">Содержимое сохранено.</p>}
    </form>
  </div>;
};

export const Formulas: React.FC = () => {
  const { groupId = '' } = useParams(); const campaignId = Number(groupId); const { api, sessionKey, invalidation } = useWorkspace();
  const { permissions, permissionsLoading, campaign } = useCampaignWorkspace();
  const writable = permissions.canWrite && !permissionsLoading && campaign.id === campaignId;
  const resource = useResource<FormulaMetadata[]>(`${sessionKey}:${campaignId}:formulas:${invalidation}`, () => api.listFormulas(campaignId));
  const [selected, setSelected] = useState<FormulaMetadata>();
  const [creating, setCreating] = useState(false);
  const dirty = useDirtyState();
  const changeSelection = (nextId: string) => {
    const next = resource.data?.find(item => item.id === nextId);
    if (next?.id === selected?.id) return;
    if (dirty && !window.confirm('Есть несохранённые изменения. Переключить формулу?')) return;
    setSelected(next);
    if (creating) setCreating(false);
  };
  if (!resource.data && resource.loading) return <p>Загрузка формул…</p>;
  return <main className={styles.page}><h1>Формулы</h1>
    {Boolean(resource.error) && <ApiError error={resource.error} onRetry={resource.reload} />}
    <label>Выбранная формула<select className={inputStyles.input} value={selected?.id ?? ''} onChange={event => changeSelection(event.target.value)}><option value="">Выберите формулу</option>{resource.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {resource.data && <ul>{resource.data.map(item => <li key={item.id}><button type="button" className={buttonStyles.button} onClick={() => changeSelection(item.id)}>{item.name}</button></li>)}</ul>}
    <button type="button" className={buttonStyles.button} disabled={!writable || creating} onClick={() => { if (writable && !creating && (!dirty || window.confirm('Есть несохранённые изменения. Открыть создание формулы?'))) setCreating(true); }}>Создать формулу</button>
    {creating && <CreateFormula campaignId={campaignId} onCancel={() => setCreating(false)} onCreated={created => { const metadata = created as FormulaMetadata; setSelected(metadata); setCreating(false); resource.reload(); }} />}
    {selected && !creating && <FormulaEditor key={`${campaignId}:${selected.id}`} campaignId={campaignId} formula={selected} />}
  </main>;
};
export default Formulas;
