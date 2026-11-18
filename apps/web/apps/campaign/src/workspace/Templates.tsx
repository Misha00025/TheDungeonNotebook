import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { useMutation, useResource } from './hooks';
import { CampaignApiError } from './api';
import type { BaseField, BaseFieldInput, DefinitionMetadata, JsonValue, ValueType, TemplateContentEnvelope, VirtualField, VirtualFieldInput } from './types';
import { VirtualFieldsEditor } from './VirtualFieldsEditor';
import { ApiError } from './Feedback';
import { ValueInput, validateFieldValue } from './ValueInput';
import commonStyles from '@tdn/shared/styles/common.module.css';
import inputStyles from '@tdn/shared/styles/components/Input.module.css';
import styles from './Workspace.module.css';
import { stringifyJson } from './json';
import { ActionRow, Button, FieldSet, FormGrid, List, Panel } from '@tdn/shared';

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
  const contentResource = useResource<TemplateContentEnvelope>(`${identity}:content`, () => api.getTemplateContent(campaignId));
  const [description, setDescription] = useState('');
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
  const initializedContent = useRef(false);
  const [contentBlocked, setContentBlocked] = useState(false);
  const [latestContent, setLatestContent] = useState<TemplateContentEnvelope>();
  const [valueErrors, setValueErrors] = useState<Record<string, string | undefined>>({});
  const [contentError, setContentError] = useState<unknown>();
  const [reloadError, setReloadError] = useState<unknown>();
  const [contentSaved, setContentSaved] = useState(false);
  const [contentBusy, setContentBusy] = useState(false);
  const busyRef = useRef(false);
  const contentDirty = loaded && (!same(rows.map(row => row.field), baselineFields) || Object.values(valueErrors).some(Boolean));
  const virtualDirty = loaded && !same(virtualFields, baselineVirtualFields);
  const clearContentDirty = useDirtyDraft(`template-content-${identity}`, contentDirty);
  const clearVirtualDirty = useDirtyDraft(`template-virtual-content-${identity}`, virtualDirty);
  const previousInvalidation = useRef(invalidation);
  useEffect(() => { if (previousInvalidation.current !== invalidation) { previousInvalidation.current = invalidation; contentResource.reload(); } }, [invalidation, contentResource.reload]);
  useEffect(() => { if (contentResource.data && !initializedContent.current) { const data = contentResource.data.data; setDescription(data.description); const base = data.baseFields.map(inputFrom); setBaselineFields(base); setRows(rowsFrom(data.baseFields)); const virtual = (data.virtualFields ?? []).map(field => ({ ...field, bindings: { ...field.bindings } })); setVirtualFields(virtual); setBaselineVirtualFields(virtual); contentRevisionRef.current = contentResource.data.contentRevision; setContentRevision(contentResource.data.contentRevision); setLoaded(true); initializedContent.current = true; } }, [contentResource.data]);
  const saveContent = useMutation(async () => {
    if (!writable || !loaded || contentBlocked || busyRef.current) return;
    const fields = rows.map(row => row.field);
    if (fields.some(field => validateFieldValue({ valueType: field.valueType, options: field.options }, field.value)) || Object.values(valueErrors).some(Boolean)) return;
    busyRef.current = true; setContentBusy(true);
    try { const result = await api.putTemplateContent(campaignId, { expectedRevision: contentRevisionRef.current, description, baseFields: fields }); const savedFields = result.data.baseFields.map(inputFrom); const responseVirtual = result.data.virtualFields.map(field => ({ ...field, bindings: { ...field.bindings } })); contentRevisionRef.current = result.contentRevision; setContentRevision(result.contentRevision); setDescription(result.data.description); setBaselineFields(savedFields); setRows(rowsFrom(result.data.baseFields)); setBaselineVirtualFields(responseVirtual); if (!virtualDirty) setVirtualFields(responseVirtual); setValueErrors({}); setContentBlocked(false); setLatestContent(undefined); setContentError(undefined); setContentSaved(true); clearContentDirty(); }
    catch (error) { setContentError(error); if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation(); if (error instanceof CampaignApiError && (error.status === 409 || error.unknownOutcome)) setContentBlocked(true); throw error; }
    finally { busyRef.current = false; setContentBusy(false); }
  });
  const refreshContent = async () => { setReloadError(undefined); try { const fresh = await api.getTemplateContent(campaignId); contentRevisionRef.current = fresh.contentRevision; setContentRevision(fresh.contentRevision); setDescription(fresh.data.description); setLatestContent(fresh); setContentBlocked(false); setContentError(undefined); } catch (error) { setReloadError(error); } };
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
  if (!contentResource.data && contentResource.loading) return <p>Загрузка шаблона…</p>;
  if (!contentResource.data && contentResource.error) return <ApiError error={contentResource.error} onRetry={contentResource.reload} />;
  return (
    <div className={styles.page}>
      <Panel density="compact" title="Базовые поля">
        <form onSubmit={event => {
          event.preventDefault();
          if (!writable || contentBlocked || contentBusy) return;
          void saveContent.run().catch(() => undefined);
        }}>
          <fieldset disabled={!writable || !loaded || contentBusy || contentBlocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <List layout="vertical" stretch gap="small">
              {rows.map(row => (
                <FieldSet key={row.rowKey} legend={row.field.title || 'Новое поле'}>
                  <FormGrid minColumnWidth="9rem">
                    <label>Ключ<input className={inputStyles.input} value={row.field.key} disabled={row.existing} onChange={event => mutate(row.rowKey, field => ({ ...field, key: event.target.value }))} /></label>
                    <label>Заголовок<input className={inputStyles.input} value={row.field.title} onChange={event => { mutate(row.rowKey, field => ({ ...field, title: event.target.value })); setContentSaved(false); }} /></label>
                    <label>Тип<select className={inputStyles.input} value={row.field.valueType} onChange={event => { const valueType = event.target.value as ValueType; mutate(row.rowKey, field => ({ ...field, valueType, value: defaultFor(valueType), options: valueType === 'SingleChoice' || valueType === 'MultiChoice' ? field.options : [] })); setContentSaved(false); }}><option value="Integer">Целое число</option><option value="Number">Число</option><option value="String">Строка</option><option value="Boolean">Логическое значение</option><option value="SingleChoice">Один вариант</option><option value="MultiChoice">Несколько вариантов</option></select></label>
                    <label>Значение по умолчанию<ValueInput compact key={row.rowKey} field={{ valueType: row.field.valueType, options: row.field.options }} value={row.field.value} onChange={value => { mutate(row.rowKey, field => ({ ...field, value })); setContentSaved(false); }} onValidityChange={error => setValueErrors(current => current[row.rowKey] === error ? current : { ...current, [row.rowKey]: error })} /></label>
                  </FormGrid>
                  <FormGrid minColumnWidth="9rem">
                    <label>Описание поля<textarea className={inputStyles.input} rows={1} value={row.field.description} onChange={event => { mutate(row.rowKey, field => ({ ...field, description: event.target.value })); setContentSaved(false); }} /></label>
                    <ActionRow><Button type="button" onClick={() => { setRows(current => current.filter(item => item.rowKey !== row.rowKey)); setValueErrors(current => { const next = { ...current }; delete next[row.rowKey]; return next; }); setContentSaved(false); }}>Удалить поле</Button></ActionRow>
                  </FormGrid>
                  {(row.field.valueType === 'SingleChoice' || row.field.valueType === 'MultiChoice') && (
                    <details>
                      <summary>Варианты ({row.field.options.length})</summary>
                      <List layout="vertical" stretch gap="small">
                        {row.field.options.map((option, index) => (
                          <FormGrid key={`${row.rowKey}:${index}`} minColumnWidth="9rem">
                            <label>Ключ<input className={inputStyles.input} value={option.optionKey} onChange={event => { mutate(row.rowKey, field => ({ ...field, options: field.options.map((item, i) => i === index ? { ...item, optionKey: event.target.value } : item) })); setContentSaved(false); }} /></label>
                            <label>Название<input className={inputStyles.input} value={option.title} onChange={event => { mutate(row.rowKey, field => ({ ...field, options: field.options.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })); setContentSaved(false); }} /></label>
                            <ActionRow><Button type="button" onClick={() => { mutate(row.rowKey, field => ({ ...field, options: field.options.filter((_, i) => i !== index) })); setContentSaved(false); }}>Удалить вариант</Button></ActionRow>
                          </FormGrid>
                        ))}
                        <ActionRow><Button type="button" onClick={() => { mutate(row.rowKey, field => ({ ...field, options: [...field.options, { optionKey: '', title: '' }] })); setContentSaved(false); }}>Добавить вариант</Button></ActionRow>
                      </List>
                    </details>
                  )}
                </FieldSet>
              ))}
              <ActionRow><Button type="button" onClick={() => { setRows(current => [...current, { rowKey: guid(), existing: false, field: { key: '', title: '', description: '', valueType: 'String', value: '', options: [] } }]); setContentSaved(false); }}>Добавить поле</Button></ActionRow>
            </List>
          </fieldset>
          {Boolean(contentError) && <ApiError error={contentError} />}
          {contentBlocked && <Button type="button" onClick={() => void refreshContent()}>Перечитать содержимое</Button>}
          {latestContent && <aside className={commonStyles.card}><h3>Актуальная серверная версия (черновик сохранён отдельно)</h3><ul>{latestContent.data.baseFields.map(field => <li key={field.id}>{field.title}</li>)}</ul></aside>}
          {Boolean(reloadError) && <ApiError error={reloadError} />}
          <ActionRow>
            <Button type="submit" disabled={!writable || !contentDirty || contentBusy || contentBlocked || Object.values(valueErrors).some(Boolean)}>Сохранить базовые поля</Button>
            <Button type="button" disabled={!writable || contentBusy} onClick={() => { if (!contentDirty || window.confirm('Отменить черновик базовых полей?')) { setRows(baselineFields.map(field => ({ rowKey: guid(), field, existing: Boolean(field.id) }))); setValueErrors({}); setContentSaved(false); clearContentDirty(); } }}>Отменить</Button>
          </ActionRow>
          {contentSaved && <p role="status">Содержимое сохранено.</p>}
        </form>
      </Panel>
      <Panel density="compact" title="Виртуальные поля">
        {!virtualEditorOpen ? (
          <Button type="button" disabled={!writable} onClick={() => void openVirtualEditor()}>Открыть виртуальные поля</Button>
        ) : <>
          {formulaLoading && <p>Загрузка формул…</p>}
          {Boolean(formulaError) && <ApiError error={formulaError} onRetry={() => void openVirtualEditor()} />}
          <VirtualFieldsEditor compact campaignId={campaignId} fields={virtualFields} onChange={setVirtualFields} formulas={formulaMetadata} baseFields={rows.flatMap(row => row.field.id ? [{ id: row.field.id, key: row.field.key, title: row.field.title }] : [])} templateVirtualFields={virtualFields.filter((field): field is VirtualField => Boolean(field.id))} disabled={!writable || contentBusy || contentBlocked} />
          {Boolean(virtualError) && <ApiError error={virtualError} />}
          {contentBlocked && <Button type="button" disabled={contentBusy} onClick={() => void refreshContent()}>Перечитать содержимое</Button>}
          {latestContent && <aside className={commonStyles.card}><h3>Актуальная серверная версия (оба черновика сохранены)</h3><ul>{latestContent.data.virtualFields.map(field => <li key={field.id}>{field.title}</li>)}</ul></aside>}
          <ActionRow>
            <Button type="button" disabled={!writable || !virtualDirty || contentBusy || contentBlocked} onClick={() => void saveVirtualFields.run().catch(() => undefined)}>Сохранить виртуальные поля</Button>
            <Button type="button" disabled={!writable || contentBusy} onClick={() => { if (!virtualDirty || window.confirm('Отменить черновик виртуальных полей?')) { setVirtualFields(baselineVirtualFields.map(field => ({ ...field, bindings: { ...field.bindings } }))); setVirtualError(undefined); clearVirtualDirty(); } }}>Отменить</Button>
          </ActionRow>
        </>}
      </Panel>
    </div>
  );
};

const Templates: React.FC = () => {
  const { groupId = '' } = useParams();
  const campaignId = Number(groupId);
  const { sessionKey } = useWorkspace();
  return <main className={styles.page}><h1>Шаблон кампании</h1><TemplateEditor key={`${sessionKey}:${campaignId}`} campaignId={campaignId} /></main>;
};
export default Templates;
