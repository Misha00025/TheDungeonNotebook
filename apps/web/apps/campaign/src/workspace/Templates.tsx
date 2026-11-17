import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace, useDirtyDraft, useDirtyState } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useMutation, useResource } from './hooks';
import { runCreation, CampaignApiError } from './api';
import type { BaseField, BaseFieldInput, ChoiceOption, DefinitionCreate, DefinitionMetadata, JsonValue, ValueType, TemplateContentEnvelope } from './types';
import { ApiError } from './Feedback';
import { ValueInput, validateFieldValue } from './ValueInput';
import commonStyles from '@tdn/shared/styles/common.module.css';
import buttonStyles from '@tdn/shared/styles/components/Button.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';
import { stringifyJson } from './json';

type Row = { rowKey: string; field: BaseFieldInput; existing: boolean };
const guid = () => crypto.randomUUID();
const defaultFor = (type: ValueType): JsonValue => type === 'Integer' || type === 'Number' ? 0 : type === 'String' || type === 'SingleChoice' ? '' : type === 'Boolean' ? false : [];
const inputFrom = (field: BaseField): BaseFieldInput => ({ id: field.id, key: field.key, title: field.title, description: field.description, valueType: field.valueType, value: field.value, options: field.options });
const rowsFrom = (fields: BaseField[]): Row[] => fields.map(field => ({ rowKey: guid(), field: inputFrom(field), existing: true }));
const same = (a: unknown, b: unknown) => stringifyJson(a) === stringifyJson(b);

const CreateTemplate: React.FC<{ campaignId: number; requestId: string; writable: boolean; onCreated: (template: DefinitionCreate) => void; onCancel: () => void }> = ({ campaignId, requestId, writable, onCreated, onCancel }) => {
  const { api } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [failure, setFailure] = useState<unknown>();
  const [checkFailure, setCheckFailure] = useState<unknown>();
  const [uncertain, setUncertain] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const clearDirty = useDirtyDraft(`template-create-${campaignId}-${requestId}`, Boolean(name || description));
  const lookup = async () => {
    const [metadata, content] = await Promise.all([api.getTemplate(campaignId, requestId), api.getTemplateContent(campaignId, requestId)]);
    return { ...metadata, contentRevision: content.contentRevision } as DefinitionCreate;
  };
  const mutation = useMutation((payload: { name: string; description: string; baseFields: BaseFieldInput[]; requestId: string }) => runCreation(() => api.createTemplate(campaignId, payload), lookup));
  const finish = (value: DefinitionCreate) => { if (active.current) { clearDirty(); onCreated(value); } };
  const cancel = () => { if ((!name && !description) || window.confirm('Отказаться от черновика шаблона?')) { clearDirty(); onCancel(); } };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!writable || !name.trim() || uncertain || mutation.busy) return;
    try { const created = await mutation.run({ name: name.trim(), description, baseFields: [], requestId }); if (created) finish(created); }
    catch (error) { if (active.current) { setFailure(error); setUncertain(error instanceof CampaignApiError && (error.unknownOutcome || error.status === 409)); } }
  };
  const check = async () => { if (mutation.busy) return; setCheckFailure(undefined); try { const value = await lookup(); finish(value); } catch (error) { if (active.current) setCheckFailure(error); } };
  return <form className={commonStyles.form} onSubmit={submit}><h2>Создать шаблон</h2>
    <fieldset disabled={!writable || uncertain || mutation.busy}><label className={commonStyles.formGroup}>Название<input className={inputStyles.input} value={name} onChange={event => setName(event.target.value)} required /></label>
    <label className={commonStyles.formGroup}>Описание<textarea className={inputStyles.input} value={description} onChange={event => setDescription(event.target.value)} /></label></fieldset>
    {Boolean(failure) && <ApiError error={failure} />}{Boolean(checkFailure) && <ApiError error={checkFailure} />}
    <div className={commonStyles.formActions}>{uncertain ? <button className={buttonStyles.button} type="button" disabled={mutation.busy} onClick={() => void check()}>Проверить создание</button> : <button className={buttonStyles.button} disabled={!writable || mutation.busy || !name.trim()}>Создать</button>}<button className={buttonStyles.button} type="button" disabled={mutation.busy} onClick={cancel}>Отмена</button></div>
  </form>;
};

export const TemplateEditor: React.FC<{ campaignId: number; template: DefinitionMetadata; onChanged: () => void }> = ({ campaignId, template, onChanged }) => {
  const { api, sessionKey, notifyInvalidation } = useWorkspace();
  const { permissions, permissionsLoading } = useCampaignWorkspace();
  const writable = permissions.canWrite && !permissionsLoading;
  const identity = `${sessionKey}:${campaignId}:${template.id}`;
  const metadataResource = useResource(`${identity}:metadata`, () => api.getTemplate(campaignId, template.id));
  const contentResource = useResource<TemplateContentEnvelope>(`${identity}:content`, () => api.getTemplateContent(campaignId, template.id));
  const [name, setName] = useState('');
  const [baselineName, setBaselineName] = useState('');
  const [metadataRevision, setMetadataRevision] = useState<DefinitionMetadata['metadataRevision']>(template.metadataRevision);
  const [description, setDescription] = useState('');
  const [baselineDescription, setBaselineDescription] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [baselineFields, setBaselineFields] = useState<BaseFieldInput[]>([]);
  const [contentRevision, setContentRevision] = useState<TemplateContentEnvelope['contentRevision']>(1);
  const [loaded, setLoaded] = useState(false);
  const initializedMetadata = useRef(false);
  const initializedContent = useRef(false);
  const [metadataBlocked, setMetadataBlocked] = useState(false);
  const [contentBlocked, setContentBlocked] = useState(false);
  const [latestMetadata, setLatestMetadata] = useState<DefinitionMetadata>();
  const [latestContent, setLatestContent] = useState<TemplateContentEnvelope>();
  const [valueErrors, setValueErrors] = useState<Record<string, string | undefined>>({});
  const [metadataError, setMetadataError] = useState<unknown>();
  const [contentError, setContentError] = useState<unknown>();
  const [reloadError, setReloadError] = useState<unknown>();
  const [metadataSaved, setMetadataSaved] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);
  const [contentBusy, setContentBusy] = useState(false);
  const busyRef = useRef(false);
  const metadataDirty = name !== baselineName;
  const contentDirty = loaded && (description !== baselineDescription || !same(rows.map(row => row.field), baselineFields) || Object.values(valueErrors).some(Boolean));
  const clearMetadataDirty = useDirtyDraft(`template-metadata-${identity}`, metadataDirty);
  const clearContentDirty = useDirtyDraft(`template-content-${identity}`, contentDirty);
  useEffect(() => { if (metadataResource.data && !initializedMetadata.current) { setName(metadataResource.data.name); setBaselineName(metadataResource.data.name); setMetadataRevision(metadataResource.data.metadataRevision); initializedMetadata.current = true; } }, [metadataResource.data]);
  useEffect(() => { if (contentResource.data && !initializedContent.current) { const data = contentResource.data.data; setDescription(data.description); setBaselineDescription(data.description); const base = data.baseFields.map(inputFrom); setBaselineFields(base); setRows(rowsFrom(data.baseFields)); setContentRevision(contentResource.data.contentRevision); setLoaded(true); initializedContent.current = true; } }, [contentResource.data]);
  const rename = useMutation(async () => {
    if (!writable || metadataBlocked || !name.trim()) return;
    try { const saved = await api.renameTemplate(campaignId, template.id, { name: name.trim(), expectedRevision: metadataRevision }); setName(saved.name); setBaselineName(saved.name); setMetadataRevision(saved.metadataRevision); setMetadataBlocked(false); setLatestMetadata(undefined); setMetadataError(undefined); setMetadataSaved(true); clearMetadataDirty(); onChanged(); }
    catch (error) { setMetadataError(error); if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation(); if (error instanceof CampaignApiError && (error.status === 409 || error.unknownOutcome)) setMetadataBlocked(true); throw error; }
  });
  const saveContent = useMutation(async () => {
    if (!writable || contentBlocked || busyRef.current) return;
    const fields = rows.map(row => row.field);
    if (fields.some(field => validateFieldValue({ valueType: field.valueType, options: field.options }, field.value)) || Object.values(valueErrors).some(Boolean)) return;
    busyRef.current = true; setContentBusy(true);
    try { const result = await api.putTemplateContent(campaignId, template.id, { expectedRevision: contentRevision, description, baseFields: fields }); const savedFields = result.data.baseFields.map(inputFrom); setContentRevision(result.contentRevision); setDescription(result.data.description); setBaselineDescription(result.data.description); setBaselineFields(savedFields); setRows(rowsFrom(result.data.baseFields)); setValueErrors({}); setContentBlocked(false); setLatestContent(undefined); setContentError(undefined); setContentSaved(true); clearContentDirty(); }
    catch (error) { setContentError(error); if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation(); if (error instanceof CampaignApiError && (error.status === 409 || error.unknownOutcome)) setContentBlocked(true); throw error; }
    finally { busyRef.current = false; setContentBusy(false); }
  });
  const refreshMetadata = async () => { setReloadError(undefined); try { const fresh = await api.getTemplate(campaignId, template.id); setMetadataRevision(fresh.metadataRevision); setLatestMetadata(fresh); setMetadataBlocked(false); setMetadataError(undefined); } catch (error) { setReloadError(error); } };
  const refreshContent = async () => { setReloadError(undefined); try { const fresh = await api.getTemplateContent(campaignId, template.id); setContentRevision(fresh.contentRevision); setLatestContent(fresh); setContentBlocked(false); setContentError(undefined); } catch (error) { setReloadError(error); } };
  const mutate = (rowKey: string, update: (field: BaseFieldInput) => BaseFieldInput) => setRows(current => current.map(row => row.rowKey === rowKey ? { ...row, field: update(row.field) } : row));
  if (!metadataResource.data && metadataResource.loading || !contentResource.data && contentResource.loading) return <p>Загрузка шаблона…</p>;
  if (!metadataResource.data && metadataResource.error) return <ApiError error={metadataResource.error} onRetry={metadataResource.reload} />;
  if (!contentResource.data && contentResource.error) return <ApiError error={contentResource.error} onRetry={contentResource.reload} />;
  return <div className={styles.page}>
    <form className={commonStyles.form} onSubmit={event => { event.preventDefault(); if (!writable || metadataBlocked) return; void rename.run().catch(() => undefined); }}><h2>Метаданные</h2><fieldset disabled={!writable || rename.busy}><label className={commonStyles.formGroup}>Название<input className={inputStyles.input} value={name} onChange={event => { setName(event.target.value); setMetadataSaved(false); }} required /></label></fieldset>{Boolean(metadataError) && <ApiError error={metadataError} />}{metadataBlocked && <button type="button" className={buttonStyles.button} onClick={() => void refreshMetadata()}>Перечитать метаданные</button>}{latestMetadata && <p>Актуальное название: {latestMetadata.name}. Черновик сохранён отдельно.</p>}<div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!writable || !metadataDirty || rename.busy || metadataBlocked || !name.trim()}>Сохранить название</button><button className={buttonStyles.button} type="button" disabled={!writable || rename.busy} onClick={() => { if (!metadataDirty || window.confirm('Отменить черновик названия?')) { setName(baselineName); setMetadataSaved(false); clearMetadataDirty(); } }}>Отменить</button></div>{metadataSaved && <p role="status">Название сохранено.</p>}</form>
    <form className={commonStyles.form} onSubmit={event => { event.preventDefault(); if (!writable || contentBlocked) return; void saveContent.run().catch(() => undefined); }}><h2>Базовое содержимое</h2><fieldset disabled={!writable || contentBusy}><label className={commonStyles.formGroup}>Описание<textarea className={inputStyles.input} value={description} onChange={event => { setDescription(event.target.value); setContentSaved(false); }} /></label><h3>Базовые поля</h3>
      {rows.map(row => <fieldset className={commonStyles.card} key={row.rowKey}><legend>{row.field.title || 'Новое поле'}</legend><label>Ключ<input className={inputStyles.input} value={row.field.key} disabled={row.existing} onChange={event => mutate(row.rowKey, field => ({ ...field, key: event.target.value }))} /></label><label>Заголовок<input className={inputStyles.input} value={row.field.title} onChange={event => { mutate(row.rowKey, field => ({ ...field, title: event.target.value })); setContentSaved(false); }} /></label><label>Описание поля<textarea className={inputStyles.input} value={row.field.description} onChange={event => { mutate(row.rowKey, field => ({ ...field, description: event.target.value })); setContentSaved(false); }} /></label><label>Тип<select className={inputStyles.input} value={row.field.valueType} onChange={event => { const valueType = event.target.value as ValueType; mutate(row.rowKey, field => ({ ...field, valueType, value: defaultFor(valueType), options: valueType === 'SingleChoice' || valueType === 'MultiChoice' ? field.options : [] })); setContentSaved(false); }}><option>Integer</option><option>Number</option><option>String</option><option>Boolean</option><option>SingleChoice</option><option>MultiChoice</option></select></label>
        {(row.field.valueType === 'SingleChoice' || row.field.valueType === 'MultiChoice') && <div><h4>Варианты</h4>{row.field.options.map((option, index) => <div key={`${row.rowKey}:${index}`}><label>Ключ<input className={inputStyles.input} value={option.optionKey} onChange={event => { mutate(row.rowKey, field => ({ ...field, options: field.options.map((item, i) => i === index ? { ...item, optionKey: event.target.value } : item) })); setContentSaved(false); }} /></label><label>Название<input className={inputStyles.input} value={option.title} onChange={event => { mutate(row.rowKey, field => ({ ...field, options: field.options.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })); setContentSaved(false); }} /></label><button type="button" className={buttonStyles.button} onClick={() => { mutate(row.rowKey, field => ({ ...field, options: field.options.filter((_, i) => i !== index) })); setContentSaved(false); }}>Удалить вариант</button></div>)}<button type="button" className={buttonStyles.button} onClick={() => { mutate(row.rowKey, field => ({ ...field, options: [...field.options, { optionKey: '', title: '' }] })); setContentSaved(false); }}>Добавить вариант</button></div>}
        <label>Значение по умолчанию<ValueInput key={row.rowKey} field={{ valueType: row.field.valueType, options: row.field.options }} value={row.field.value} onChange={value => { mutate(row.rowKey, field => ({ ...field, value })); setContentSaved(false); }} onValidityChange={error => setValueErrors(current => current[row.rowKey] === error ? current : { ...current, [row.rowKey]: error })} /></label><button type="button" className={buttonStyles.button} onClick={() => { setRows(current => current.filter(item => item.rowKey !== row.rowKey)); setValueErrors(current => { const next = { ...current }; delete next[row.rowKey]; return next; }); setContentSaved(false); }}>Удалить поле</button>
      </fieldset>)}
      <button type="button" className={buttonStyles.button} onClick={() => { setRows(current => [...current, { rowKey: guid(), existing: false, field: { key: '', title: '', description: '', valueType: 'String', value: '', options: [] } }]); setContentSaved(false); }}>Добавить поле</button>
      </fieldset>{Boolean(contentError) && <ApiError error={contentError} />}{contentBlocked && <button type="button" className={buttonStyles.button} onClick={() => void refreshContent()}>Перечитать содержимое</button>}{latestContent && <aside className={commonStyles.card}><h3>Актуальная серверная версия (черновик сохранён отдельно)</h3><p>{latestContent.data.description}</p><ul>{latestContent.data.baseFields.map(field => <li key={field.id}>{field.key}: {field.title}</li>)}</ul></aside>}{Boolean(reloadError) && <ApiError error={reloadError} />}
      <div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!writable || !contentDirty || contentBusy || contentBlocked || Object.values(valueErrors).some(Boolean)}>Сохранить базовые поля</button><button type="button" className={buttonStyles.button} disabled={!writable || contentBusy} onClick={() => { if (!contentDirty || window.confirm('Отменить черновик базовых полей?')) { setDescription(baselineDescription); setRows(baselineFields.map(field => ({ rowKey: guid(), field, existing: Boolean(field.id) }))); setValueErrors({}); setContentSaved(false); clearContentDirty(); } }}>Отменить</button></div>{contentSaved && <p role="status">Содержимое сохранено.</p>}</form>
  </div>;
};

const Templates: React.FC = () => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { api, sessionKey, invalidation } = useWorkspace();
  const { permissions, permissionsLoading } = useCampaignWorkspace();
  const writable = permissions.canWrite && !permissionsLoading;
  const resource = useResource<DefinitionMetadata[]>(`${sessionKey}:${campaignId}:templates`, () => api.listTemplates(campaignId));
  const [selectedId, setSelectedId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DefinitionMetadata>();
  const [creating, setCreating] = useState(false);
  const [requestId, setRequestId] = useState(guid);
  const dirty = useDirtyState();
  const previousInvalidation = useRef(invalidation);
  useEffect(() => { if (previousInvalidation.current !== invalidation) { previousInvalidation.current = invalidation; resource.reload(); } }, [invalidation, resource.reload]);
  const select = (id: string) => {
    if (id === selectedId && !creating) return;
    if (dirty && !window.confirm('Есть несохранённые изменения. Переключить шаблон?')) return;
    setSelectedId(id);
    setSelectedTemplate(resource.data?.find(item => item.id === id));
    setCreating(false);
  };
  if (!resource.data && resource.loading) return <p>Загрузка шаблонов…</p>;
  return <main className={styles.page}><h1>Шаблоны</h1>{Boolean(resource.error) && <ApiError error={resource.error} onRetry={resource.reload} />}<label>Выбранный шаблон<select className={inputStyles.input} value={selectedId} onChange={event => select(event.target.value)}><option value="">Выберите шаблон</option>{resource.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {!creating && <button className={buttonStyles.button} type="button" disabled={!writable} onClick={() => { if (dirty && !window.confirm('Есть несохранённые изменения. Открыть создание шаблона?')) return; setRequestId(guid()); setCreating(true); }}>Создать шаблон</button>}
    {creating && <CreateTemplate key={requestId} campaignId={campaignId} requestId={requestId} writable={writable} onCreated={item => { setSelectedId(item.id); setSelectedTemplate(item); setCreating(false); resource.reload(); }} onCancel={() => setCreating(false)} />}
    {!creating && selectedId && selectedTemplate && <TemplateEditor key={`${sessionKey}:${campaignId}:${selectedId}`} campaignId={campaignId} template={selectedTemplate} onChanged={() => resource.reload()} />}
  </main>;
};
export default Templates;
