import React, { useEffect, useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { CampaignApiError } from './api';
import { useMutation } from './hooks';
import type { DefinitionCreate } from './types';
import { ApiError } from './Feedback';
import { ActionRow, Button, DataTable, DataTableCell, DataTableRow, Field, Input, ModalPortal, Notification, PageHeader, Textarea } from '@tdn/shared';
import { rowDirty, useFormulaRows } from './useFormulaRows';
import styles from './Formulas.module.css';

const parametersFrom = (text: string) => text.split('\n').filter((item, index, values) => index < values.length - 1 || item.length > 0);
const isUncertain = (failure: unknown) => failure instanceof CampaignApiError && (failure.unknownOutcome || ['already_published', 'content_already_prepared', 'creation_already_published'].includes(failure.problem.code));

export const CreateFormula: React.FC<{ campaignId: number; onCreated: (formula: DefinitionCreate) => void; onCancel: () => void }> = ({ campaignId, onCreated, onCancel }) => {
  const { api } = useWorkspace();
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
      if (active.current) { setError(failure); setUncertain(isUncertain(failure)); }
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

const FormulaTableEditor: React.FC<{ campaignId: number }> = ({ campaignId }) => {
  const rows = useFormulaRows(campaignId);
  const [creating, setCreating] = useState(false);
  const header = <PageHeader title="Формулы" headingLevel={1} actions={<ActionRow>
    <Button type="button" disabled={!rows.canSave || creating} busy={rows.busy} onClick={() => void rows.saveAll()}>Сохранить</Button>
    <Button type="button" variant="secondary" disabled={!rows.dirty || rows.busy || creating} onClick={() => { if (window.confirm('Отменить все изменения формул?')) rows.cancelAll(); }}>Отменить</Button>
    <Button type="button" disabled={!rows.writable || rows.busy || creating} onClick={() => setCreating(true)}>Создать формулу</Button>
  </ActionRow>} />;
  if (rows.loading && !rows.loaded) return <main className={styles.page}>{header}<p>Загрузка формул…</p></main>;
  return <main className={styles.page}>{header}
    {Boolean(rows.listError) && <ApiError error={rows.listError} onRetry={() => void rows.reload()} />}
    {rows.feedback && <Notification kind={rows.feedback.kind} eventKey={String(rows.feedback.event)}>{rows.feedback.message}</Notification>}
    {rows.loaded && rows.rows.length === 0 && !rows.listError && <p>Формул пока нет.</p>}
    <DataTable aria-label="Формулы">
      <thead><tr><DataTableCell as="th" scope="col" sizing="editor">Название</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Выражение</DataTableCell><DataTableCell as="th" scope="col" sizing="editor">Параметры</DataTableCell></tr></thead>
      <tbody>{rows.rows.map(row => {
        const label = row.metadataBaseline.name || row.name || 'Без названия';
        const modified = rowDirty(row);
        return <DataTableRow key={row.id} aria-label={`Формула ${label}`} change={modified ? 'modified' : undefined}>
          <DataTableCell sizing="editor"><Input aria-label={`Название формулы ${label}`} value={row.name} disabled={!rows.writable || rows.busy || creating || row.missing || !row.contentBaseline} onChange={event => rows.change(row.id, 'name', event.target.value)} /></DataTableCell>
          <DataTableCell sizing="editor"><Textarea rows={2} aria-label={`Выражение формулы ${label}`} value={row.expression} disabled={!rows.writable || rows.busy || creating || row.missing || !row.contentBaseline} onChange={event => rows.change(row.id, 'expression', event.target.value)} /></DataTableCell>
          <DataTableCell sizing="editor"><Textarea rows={2} aria-label={`Параметры формулы ${label}`} placeholder="По одному в строке" value={row.parametersText} disabled={!rows.writable || rows.busy || creating || row.missing || !row.contentBaseline} onChange={event => rows.change(row.id, 'parametersText', event.target.value)} />
            {Boolean(row.loadError) && <ApiError error={row.loadError} />}
            {Boolean(row.nameError) && <ApiError error={row.nameError} />}
            {Boolean(row.contentError) && <ApiError error={row.contentError} />}
            {row.missing && <p role="alert">{row.nameBlocked || row.contentBlocked ? 'Формула отсутствует в списке. Перечитайте формулу для проверки результата.' : 'Формула отсутствует на сервере. Отмените черновик.'}</p>}
            {(Boolean(row.loadError) || row.nameBlocked || row.contentBlocked) && <Button type="button" variant="secondary" disabled={rows.busy || creating} onClick={() => void rows.rereadRow(row.id)}>Перечитать формулу {label}</Button>}
          </DataTableCell>
        </DataTableRow>;
      })}</tbody>
    </DataTable>
    {creating && <CreateFormula campaignId={campaignId} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); rows.created(); }} />}
  </main>;
};

export const Formulas: React.FC = () => {
  const { groupId = '' } = useParams(); const campaignId = Number(groupId); const { sessionKey } = useWorkspace();
  return <FormulaTableEditor key={`${sessionKey}:${campaignId}`} campaignId={campaignId} />;
};
export default Formulas;
