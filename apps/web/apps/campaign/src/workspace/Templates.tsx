import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useMutation, useResource } from './hooks';
import { CampaignApiError } from './api';
import type { BaseField, BaseFieldInput, DefinitionMetadata, JsonValue, ValueType, TemplateContentEnvelope, TemplateMetadata, VirtualField, VirtualFieldInput } from './types';
import { VirtualFieldsEditor } from './VirtualFieldsEditor';
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

export const TemplateEditor: React.FC<{ campaignId: number }> = ({ campaignId }) => {
  const { api, sessionKey, notifyInvalidation, invalidation } = useWorkspace();
  const { permissions, permissionsLoading } = useCampaignWorkspace();
  const writable = permissions.canWrite && !permissionsLoading;
  const identity = `${sessionKey}:${campaignId}`;
  const metadataResource = useResource<TemplateMetadata>(`${identity}:metadata`, () => api.getTemplate(campaignId));
  const contentResource = useResource<TemplateContentEnvelope>(`${identity}:content`, () => api.getTemplateContent(campaignId));
  const [name, setName] = useState('');
  const [baselineName, setBaselineName] = useState('');
  const [metadataRevision, setMetadataRevision] = useState<TemplateMetadata['metadataRevision']>(1);
  const [description, setDescription] = useState('');
  const [baselineDescription, setBaselineDescription] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [baselineFields, setBaselineFields] = useState<BaseFieldInput[]>([]);
  const [virtualFields, setVirtualFields] = useState<VirtualFieldInput[]>([]);
  const [baselineVirtualFields, setBaselineVirtualFields] = useState<VirtualFieldInput[]>([]);
  const [virtualEditorOpen, setVirtualEditorOpen] = useState(false);
  const [formulaMetadata, setFormulaMetadata] = useState<DefinitionMetadata[]>([]);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [formulaError, setFormulaError] = useState<unknown>();
  const [virtualError, setVirtualError] = useState<unknown>();
  const contentRevisionRef = useRef<TemplateContentEnvelope['contentRevision']>(0);
  const [contentRevision, setContentRevision] = useState<TemplateContentEnvelope['contentRevision']>(0);
  const [loaded, setLoaded] = useState(false);
  const initializedMetadata = useRef(false);
  const initializedContent = useRef(false);
  const [metadataBlocked, setMetadataBlocked] = useState(false);
  const [contentBlocked, setContentBlocked] = useState(false);
  const [latestMetadata, setLatestMetadata] = useState<TemplateMetadata>();
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
  const virtualDirty = loaded && !same(virtualFields, baselineVirtualFields);
  const clearMetadataDirty = useDirtyDraft(`template-metadata-${identity}`, metadataDirty);
  const clearContentDirty = useDirtyDraft(`template-content-${identity}`, contentDirty);
  const clearVirtualDirty = useDirtyDraft(`template-virtual-content-${identity}`, virtualDirty);
  const previousInvalidation = useRef(invalidation);
  useEffect(() => { if (previousInvalidation.current !== invalidation) { previousInvalidation.current = invalidation; metadataResource.reload(); contentResource.reload(); } }, [invalidation, metadataResource.reload, contentResource.reload]);
  useEffect(() => { if (metadataResource.data && !initializedMetadata.current) { setName(metadataResource.data.name); setBaselineName(metadataResource.data.name); setMetadataRevision(metadataResource.data.metadataRevision); initializedMetadata.current = true; } }, [metadataResource.data]);
  useEffect(() => { if (contentResource.data && !initializedContent.current) { const data = contentResource.data.data; setDescription(data.description); setBaselineDescription(data.description); const base = data.baseFields.map(inputFrom); setBaselineFields(base); setRows(rowsFrom(data.baseFields)); const virtual = (data.virtualFields ?? []).map(field => ({ ...field, bindings: { ...field.bindings } })); setVirtualFields(virtual); setBaselineVirtualFields(virtual); contentRevisionRef.current = contentResource.data.contentRevision; setContentRevision(contentResource.data.contentRevision); setLoaded(true); initializedContent.current = true; } }, [contentResource.data]);
  const rename = useMutation(async () => {
    if (!writable || !loaded || !initializedMetadata.current || metadataBlocked || !name.trim()) return;
    try { const saved = await api.renameTemplate(campaignId, { name: name.trim(), expectedRevision: metadataRevision }); setName(saved.name); setBaselineName(saved.name); setMetadataRevision(saved.metadataRevision); setMetadataBlocked(false); setLatestMetadata(undefined); setMetadataError(undefined); setMetadataSaved(true); clearMetadataDirty(); }
    catch (error) { setMetadataError(error); if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation(); if (error instanceof CampaignApiError && (error.status === 409 || error.unknownOutcome)) setMetadataBlocked(true); throw error; }
  });
  const saveContent = useMutation(async () => {
    if (!writable || !loaded || contentBlocked || busyRef.current) return;
    const fields = rows.map(row => row.field);
    if (fields.some(field => validateFieldValue({ valueType: field.valueType, options: field.options }, field.value)) || Object.values(valueErrors).some(Boolean)) return;
    busyRef.current = true; setContentBusy(true);
    try { const result = await api.putTemplateContent(campaignId, { expectedRevision: contentRevisionRef.current, description, baseFields: fields }); const savedFields = result.data.baseFields.map(inputFrom); const responseVirtual = result.data.virtualFields.map(field => ({ ...field, bindings: { ...field.bindings } })); contentRevisionRef.current = result.contentRevision; setContentRevision(result.contentRevision); setDescription(result.data.description); setBaselineDescription(result.data.description); setBaselineFields(savedFields); setRows(rowsFrom(result.data.baseFields)); setBaselineVirtualFields(responseVirtual); if (!virtualDirty) setVirtualFields(responseVirtual); setValueErrors({}); setContentBlocked(false); setLatestContent(undefined); setContentError(undefined); setContentSaved(true); clearContentDirty(); }
    catch (error) { setContentError(error); if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation(); if (error instanceof CampaignApiError && (error.status === 409 || error.unknownOutcome)) setContentBlocked(true); throw error; }
    finally { busyRef.current = false; setContentBusy(false); }
  });
  const refreshMetadata = async () => { setReloadError(undefined); try { const fresh = await api.getTemplate(campaignId); setMetadataRevision(fresh.metadataRevision); setLatestMetadata(fresh); setMetadataBlocked(false); setMetadataError(undefined); } catch (error) { setReloadError(error); } };
  const refreshContent = async () => { setReloadError(undefined); try { const fresh = await api.getTemplateContent(campaignId); contentRevisionRef.current = fresh.contentRevision; setContentRevision(fresh.contentRevision); setLatestContent(fresh); setContentBlocked(false); setContentError(undefined); } catch (error) { setReloadError(error); } };
  const openVirtualEditor = async () => {
    setVirtualEditorOpen(true);
    if (formulaMetadata.length || formulaLoading) return;
    setFormulaLoading(true); setFormulaError(undefined);
    try { setFormulaMetadata(await api.listFormulas(campaignId)); } catch (error) { setFormulaError(error); if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation(); } finally { setFormulaLoading(false); }
  };
  const saveVirtualFields = useMutation(async () => {
    if (!writable || !loaded || contentBlocked || busyRef.current) return;
    busyRef.current = true; setContentBusy(true);
    try {
      const result = await api.putTemplateVirtualFields(campaignId, { expectedRevision: contentRevisionRef.current, virtualFields });
      const savedVirtual = result.virtualFields.map(field => ({ ...field, bindings: { ...field.bindings } }));
      contentRevisionRef.current = result.contentRevision; setContentRevision(result.contentRevision);
      setVirtualFields(savedVirtual); setBaselineVirtualFields(savedVirtual); setContentBlocked(false); setLatestContent(undefined); setContentError(undefined); setVirtualError(undefined); setContentSaved(true); clearVirtualDirty();
    } catch (error) { setVirtualError(error); if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation(); if (error instanceof CampaignApiError && (error.status === 409 || error.unknownOutcome)) setContentBlocked(true); throw error; }
    finally { busyRef.current = false; setContentBusy(false); }
  });
  const mutate = (rowKey: string, update: (field: BaseFieldInput) => BaseFieldInput) => setRows(current => current.map(row => row.rowKey === rowKey ? { ...row, field: update(row.field) } : row));
  if (!metadataResource.data && metadataResource.loading || !contentResource.data && contentResource.loading) return <p>Загрузка шаблона…</p>;
  if (!metadataResource.data && metadataResource.error) return <ApiError error={metadataResource.error} onRetry={metadataResource.reload} />;
  if (!contentResource.data && contentResource.error) return <ApiError error={contentResource.error} onRetry={contentResource.reload} />;
  return <div className={styles.page}>
    <form className={commonStyles.form} onSubmit={event => { event.preventDefault(); if (!writable || !loaded || metadataBlocked) return; void rename.run().catch(() => undefined); }}><h2>Метаданные</h2><fieldset disabled={!writable || !loaded || rename.busy}><label className={commonStyles.formGroup}>Название<input className={inputStyles.input} value={name} onChange={event => { setName(event.target.value); setMetadataSaved(false); }} required /></label></fieldset>{Boolean(metadataError) && <ApiError error={metadataError} />}{metadataBlocked && <button type="button" className={buttonStyles.button} onClick={() => void refreshMetadata()}>Перечитать метаданные</button>}{latestMetadata && <p>Актуальное название: {latestMetadata.name}. Черновик сохранён отдельно.</p>}<div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!writable || !loaded || !metadataDirty || rename.busy || metadataBlocked || !name.trim()}>Сохранить название</button><button className={buttonStyles.button} type="button" disabled={!writable || !loaded || rename.busy} onClick={() => { if (!metadataDirty || window.confirm('Отменить черновик названия?')) { setName(baselineName); setMetadataSaved(false); clearMetadataDirty(); } }}>Отменить</button></div>{metadataSaved && <p role="status">Название сохранено.</p>}</form>
    <form className={commonStyles.form} onSubmit={event => { event.preventDefault(); if (!writable || contentBlocked || contentBusy) return; void saveContent.run().catch(() => undefined); }}><h2>Базовое содержимое</h2><fieldset disabled={!writable || contentBusy || contentBlocked}><label className={commonStyles.formGroup}>Описание<textarea className={inputStyles.input} value={description} onChange={event => { setDescription(event.target.value); setContentSaved(false); }} /></label><h3>Базовые поля</h3>
      {rows.map(row => <fieldset className={commonStyles.card} key={row.rowKey}><legend>{row.field.title || 'Новое поле'}</legend><label>Ключ<input className={inputStyles.input} value={row.field.key} disabled={row.existing} onChange={event => mutate(row.rowKey, field => ({ ...field, key: event.target.value }))} /></label><label>Заголовок<input className={inputStyles.input} value={row.field.title} onChange={event => { mutate(row.rowKey, field => ({ ...field, title: event.target.value })); setContentSaved(false); }} /></label><label>Описание поля<textarea className={inputStyles.input} value={row.field.description} onChange={event => { mutate(row.rowKey, field => ({ ...field, description: event.target.value })); setContentSaved(false); }} /></label><label>Тип<select className={inputStyles.input} value={row.field.valueType} onChange={event => { const valueType = event.target.value as ValueType; mutate(row.rowKey, field => ({ ...field, valueType, value: defaultFor(valueType), options: valueType === 'SingleChoice' || valueType === 'MultiChoice' ? field.options : [] })); setContentSaved(false); }}><option>Integer</option><option>Number</option><option>String</option><option>Boolean</option><option>SingleChoice</option><option>MultiChoice</option></select></label>
        {(row.field.valueType === 'SingleChoice' || row.field.valueType === 'MultiChoice') && <div><h4>Варианты</h4>{row.field.options.map((option, index) => <div key={`${row.rowKey}:${index}`}><label>Ключ<input className={inputStyles.input} value={option.optionKey} onChange={event => { mutate(row.rowKey, field => ({ ...field, options: field.options.map((item, i) => i === index ? { ...item, optionKey: event.target.value } : item) })); setContentSaved(false); }} /></label><label>Название<input className={inputStyles.input} value={option.title} onChange={event => { mutate(row.rowKey, field => ({ ...field, options: field.options.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })); setContentSaved(false); }} /></label><button type="button" className={buttonStyles.button} onClick={() => { mutate(row.rowKey, field => ({ ...field, options: field.options.filter((_, i) => i !== index) })); setContentSaved(false); }}>Удалить вариант</button></div>)}<button type="button" className={buttonStyles.button} onClick={() => { mutate(row.rowKey, field => ({ ...field, options: [...field.options, { optionKey: '', title: '' }] })); setContentSaved(false); }}>Добавить вариант</button></div>}
        <label>Значение по умолчанию<ValueInput key={row.rowKey} field={{ valueType: row.field.valueType, options: row.field.options }} value={row.field.value} onChange={value => { mutate(row.rowKey, field => ({ ...field, value })); setContentSaved(false); }} onValidityChange={error => setValueErrors(current => current[row.rowKey] === error ? current : { ...current, [row.rowKey]: error })} /></label><button type="button" className={buttonStyles.button} onClick={() => { setRows(current => current.filter(item => item.rowKey !== row.rowKey)); setValueErrors(current => { const next = { ...current }; delete next[row.rowKey]; return next; }); setContentSaved(false); }}>Удалить поле</button>
      </fieldset>)}
      <button type="button" className={buttonStyles.button} onClick={() => { setRows(current => [...current, { rowKey: guid(), existing: false, field: { key: '', title: '', description: '', valueType: 'String', value: '', options: [] } }]); setContentSaved(false); }}>Добавить поле</button>
       </fieldset>{Boolean(contentError) && <ApiError error={contentError} />}{contentBlocked && <button type="button" className={buttonStyles.button} onClick={() => void refreshContent()}>Перечитать содержимое</button>}{latestContent && <aside className={commonStyles.card}><h3>Актуальная серверная версия (черновик сохранён отдельно)</h3><p>{latestContent.data.description}</p><ul>{latestContent.data.baseFields.map(field => <li key={field.id}>{field.title}</li>)}</ul></aside>}{Boolean(reloadError) && <ApiError error={reloadError} />}
       <div className={commonStyles.formActions}><button className={buttonStyles.button} disabled={!writable || !contentDirty || contentBusy || contentBlocked || Object.values(valueErrors).some(Boolean)}>Сохранить базовые поля</button><button type="button" className={buttonStyles.button} disabled={!writable || contentBusy} onClick={() => { if (!contentDirty || window.confirm('Отменить черновик базовых полей?')) { setDescription(baselineDescription); setRows(baselineFields.map(field => ({ rowKey: guid(), field, existing: Boolean(field.id) }))); setValueErrors({}); setContentSaved(false); clearContentDirty(); } }}>Отменить</button></div>{contentSaved && <p role="status">Содержимое сохранено.</p>}</form>
    <section className={commonStyles.form}><h2>Виртуальные поля</h2>{!virtualEditorOpen ? <button type="button" className={buttonStyles.button} disabled={!writable} onClick={() => void openVirtualEditor()}>Открыть виртуальные поля</button> : <>
      {formulaLoading && <p>Загрузка формул…</p>}{Boolean(formulaError) && <ApiError error={formulaError} onRetry={() => void openVirtualEditor()} />}
      <VirtualFieldsEditor campaignId={campaignId} fields={virtualFields} onChange={setVirtualFields} formulas={formulaMetadata} baseFields={rows.flatMap(row => row.field.id ? [{ id: row.field.id, key: row.field.key, title: row.field.title }] : [])} templateVirtualFields={virtualFields.filter((field): field is VirtualField => Boolean(field.id))} disabled={!writable || contentBusy || contentBlocked} />
       {Boolean(virtualError) && <ApiError error={virtualError} />}{contentBlocked && <button type="button" className={buttonStyles.button} disabled={contentBusy} onClick={() => void refreshContent()}>Перечитать содержимое</button>}{latestContent && <aside className={commonStyles.card}><h3>Актуальная серверная версия (оба черновика сохранены)</h3><p>{latestContent.data.description}</p><ul>{latestContent.data.virtualFields.map(field => <li key={field.id}>{field.title}</li>)}</ul></aside>}
      <div className={commonStyles.formActions}><button type="button" className={buttonStyles.button} disabled={!writable || !virtualDirty || contentBusy || contentBlocked} onClick={() => void saveVirtualFields.run().catch(() => undefined)}>Сохранить виртуальные поля</button><button type="button" className={buttonStyles.button} disabled={!writable || contentBusy} onClick={() => { if (!virtualDirty || window.confirm('Отменить черновик виртуальных полей?')) { setVirtualFields(baselineVirtualFields.map(field => ({ ...field, bindings: { ...field.bindings } }))); setVirtualError(undefined); clearVirtualDirty(); } }}>Отменить</button></div>
    </>}</section>
  </div>;
};

const Templates: React.FC = () => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { sessionKey } = useWorkspace();
  return <main className={styles.page}><h1>Шаблон кампании</h1><TemplateEditor key={`${sessionKey}:${campaignId}`} campaignId={campaignId} /></main>;
};
export default Templates;
