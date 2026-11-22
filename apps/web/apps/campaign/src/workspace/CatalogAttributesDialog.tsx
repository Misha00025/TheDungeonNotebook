import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, Checkbox, DataTable, Field, IconButton, Input, ModalPortal, Select, StatePanel } from '@tdn/shared';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { CampaignApiError } from './api';
import { ApiError } from './Feedback';
import { stringifyJson } from './json';
import type { CatalogAttributeDefinition, CatalogAttributeInput, CatalogAttributeSchemaEnvelope, CatalogAttributeType } from './catalogTypes';

type AttributeRow = {
  clientKey: string;
  id?: string;
  title: string;
  typeKey: CatalogAttributeType;
  options: { optionKey: string; title: string }[];
  isActive: boolean;
};

type Props = {
  campaignId: number;
  canManage: boolean;
  permissionsPending?: boolean;
  onClose: () => void;
  onSaved: (schema: CatalogAttributeSchemaEnvelope) => void;
  onForbidden: () => void;
};

const typeLabels: Record<CatalogAttributeType, string> = {
  integer: 'Целое число',
  number: 'Число',
  string: 'Текст',
  boolean: 'Да или нет',
  singleChoice: 'Один вариант',
  multiChoice: 'Несколько вариантов',
};

const schemaTypes: CatalogAttributeType[] = ['integer', 'number', 'string', 'boolean', 'singleChoice', 'multiChoice'];

const toRows = (definitions: CatalogAttributeDefinition[]): AttributeRow[] => definitions.map(definition => ({
  clientKey: `schema-${definition.id}`,
  id: definition.id,
  title: definition.title,
  typeKey: definition.typeKey,
  options: definition.options.map(option => ({ ...option })),
  isActive: definition.isActive,
}));

const toInputs = (rows: AttributeRow[]): CatalogAttributeInput[] => rows.map(({ id, title, typeKey, options, isActive }) => ({
  ...(id ? { id } : {}),
  title,
  typeKey,
  options,
  isActive,
}));

const safeMessage = (error: unknown) => {
  if (!(error instanceof CampaignApiError)) return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  if (error.unknownOutcome || error.status === 0) return 'Результат записи неизвестен. Перечитайте схему перед продолжением.';
  if (error.status === 409) return 'Схема изменилась на сервере. Перечитайте актуальную версию.';
  if (error.status === 403) return 'Право управления каталогом больше недоступно.';
  if (error.status === 400) return 'Проверьте названия и варианты атрибутов.';
  return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
};

const isRecoverable = (error: unknown) => error instanceof CampaignApiError
  && (error.conflict || error.unknownOutcome || error.status === 0);

const CatalogAttributesDialog: React.FC<Props> = ({
  campaignId,
  canManage,
  permissionsPending = false,
  onClose,
  onSaved,
  onForbidden,
}) => {
  const { api, sessionKey } = useWorkspace();
  const mountedRef = useRef(false);
  const loadGeneration = useRef(0);
  const busyRef = useRef(false);
  const recoveryBusyRef = useRef(false);
  const canWriteRef = useRef(canManage && !permissionsPending);
  const onCloseRef = useRef(onClose);
  const onSavedRef = useRef(onSaved);
  const onForbiddenRef = useRef(onForbidden);
  onCloseRef.current = onClose;
  onSavedRef.current = onSaved;
  onForbiddenRef.current = onForbidden;

  const [baseline, setBaseline] = useState<CatalogAttributeSchemaEnvelope>();
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [recoverySchema, setRecoverySchema] = useState<CatalogAttributeSchemaEnvelope>();
  const [acceptOnly, setAcceptOnly] = useState(false);
  const [status, setStatus] = useState('');
  const [optionsRowKey, setOptionsRowKey] = useState<string>();
  const [optionsDraft, setOptionsDraft] = useState<AttributeRow['options']>([]);

  canWriteRef.current = canManage && !permissionsPending && !revoked;
  const baselineInputs = useMemo(() => baseline ? toInputs(toRows(baseline.data.definitions)) : [], [baseline]);
  const dirty = Boolean(baseline && stringifyJson(toInputs(rows)) !== stringifyJson(baselineInputs));
  const invalid = rows.some(row => !row.title.trim() || row.options.some(option => !option.optionKey.trim()));
  const optionsDraftDirty = Boolean(optionsRowKey && rows.some(row => row.clientKey === optionsRowKey)
    && stringifyJson(optionsDraft) !== stringifyJson(rows.find(row => row.clientKey === optionsRowKey)?.options ?? []));
  useDirtyDraft(`catalog-attributes-${sessionKey}-${campaignId}`, dirty || blocked || optionsDraftDirty);

  const reportForbidden = () => {
    if (!mountedRef.current) return;
    setRevoked(true);
    onForbiddenRef.current();
  };

  const loadSchema = async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const result = await api.getCatalogAttributes(campaignId);
      if (!mountedRef.current || generation !== loadGeneration.current) return;
      setBaseline(result);
      setRows(toRows(result.data.definitions));
    } catch (error) {
      if (!mountedRef.current || generation !== loadGeneration.current) return;
      setLoadError(error);
      if ((error as { status?: number })?.status === 403) reportForbidden();
    } finally {
      if (mountedRef.current && generation === loadGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void loadSchema();
    return () => {
      mountedRef.current = false;
      loadGeneration.current += 1;
    };
  }, [campaignId, api]);

  const close = () => {
    if (busyRef.current || recoveryBusyRef.current || recovering) return;
    if ((dirty || optionsDraftDirty || blocked) && !window.confirm('Есть несохранённые изменения. Закрыть и потерять их?')) return;
    onCloseRef.current();
  };

  const addDefinition = () => setRows(current => [...current, {
    clientKey: `new:${crypto.randomUUID()}`,
    title: '',
    typeKey: 'string',
    options: [],
    isActive: true,
  }]);

  const changeType = (row: AttributeRow, typeKey: CatalogAttributeType) => {
    if (typeKey === row.typeKey || !canWriteRef.current || busyRef.current) return;
    if (!window.confirm('Смена типа не преобразует значения, уже сохранённые у определений каталога. Продолжить?')) return;
    setRows(current => current.map(item => item.clientKey === row.clientKey ? {
      ...item,
      typeKey,
      options: typeKey === 'singleChoice' || typeKey === 'multiChoice' ? item.options : [],
    } : item));
  };

  const acceptServerSchema = (result: CatalogAttributeSchemaEnvelope) => {
    setBaseline(result);
    setRows(toRows(result.data.definitions));
    setRecoverySchema(undefined);
    setBlocked(false);
    setAcceptOnly(false);
    setFailure(undefined);
    setStatus('Принята серверная схема атрибутов.');
    onSavedRef.current(result);
  };

  const save = async () => {
    if (!baseline || invalid || !dirty || busyRef.current || blocked || !canWriteRef.current) return;
    const submitted = toInputs(rows);
    const hadNewRows = submitted.some(item => !item.id);
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    setStatus('');
    try {
      const result = await api.putCatalogAttributes(campaignId, {
        expectedRevision: baseline.contentRevision,
        definitions: submitted,
      });
      if (!mountedRef.current) return;
      const acceptedRows = result.data.definitions.map((definition, index) => {
        const submittedRow = rows[index];
        return {
          clientKey: submittedRow?.clientKey ?? `schema-${definition.id}`,
          id: definition.id,
          title: definition.title,
          typeKey: definition.typeKey,
          options: definition.options.map(option => ({ ...option })),
          isActive: definition.isActive,
        } satisfies AttributeRow;
      });
      setBaseline(result);
      setRows(acceptedRows);
      setStatus('Схема атрибутов подтверждённо сохранена.');
      onSavedRef.current(result);
    } catch (error) {
      if (!mountedRef.current) return;
      setFailure(error);
      if ((error as { status?: number })?.status === 403) reportForbidden();
      if (isRecoverable(error)) {
        setBlocked(true);
        setAcceptOnly(Boolean(error instanceof CampaignApiError && (error.unknownOutcome || error.status === 0) && hadNewRows));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const reread = async () => {
    if (busyRef.current || recoveryBusyRef.current) return;
    recoveryBusyRef.current = true;
    setRecovering(true);
    setRecoverySchema(undefined);
    setFailure(undefined);
    try {
      const result = await api.getCatalogAttributes(campaignId);
      if (!mountedRef.current) return;
      setRecoverySchema(result);
      onSavedRef.current(result);
    } catch (error) {
      if (!mountedRef.current) return;
      setFailure(error);
      if ((error as { status?: number })?.status === 403) reportForbidden();
    } finally {
      recoveryBusyRef.current = false;
      if (mountedRef.current) setRecovering(false);
    }
  };

  const resolveRecovery = (action: 'accept' | 'keep') => {
    if (!recoverySchema || !blocked) return;
    if (action === 'accept') {
      if (!window.confirm('Заменить черновик схемы актуальной серверной версией?')) return;
      acceptServerSchema(recoverySchema);
      return;
    }
    if (acceptOnly) return;
    const priorIds = new Set(baseline?.data.definitions.map(definition => definition.id) ?? []);
    const localIds = new Set(rows.flatMap(row => row.id ? [row.id] : []));
    const serverAddedRows = recoverySchema.data.definitions
      .filter(definition => !priorIds.has(definition.id) && !localIds.has(definition.id))
      .map(definition => ({
        clientKey: `schema-${definition.id}`,
        id: definition.id,
        title: definition.title,
        typeKey: definition.typeKey,
        options: definition.options.map(option => ({ ...option })),
        isActive: definition.isActive,
      }));
    setBaseline(recoverySchema);
    setRows([...rows, ...serverAddedRows]);
    setRecoverySchema(undefined);
    setBlocked(false);
    setFailure(undefined);
    setStatus('Черновик оставлен с серверными атрибутами. Следующее явное сохранение заменит схему целиком.');
  };

  const writesDisabled = busy || recovering || permissionsPending || revoked || !canManage || blocked;

  const optionsRow = rows.find(row => row.clientKey === optionsRowKey);
  const applyOptions = () => {
    if (!optionsRowKey || writesDisabled) return;
    const current = rows.find(row => row.clientKey === optionsRowKey);
    if (!current || (current.typeKey !== 'singleChoice' && current.typeKey !== 'multiChoice')) return;
    setRows(current => current.map(row => row.clientKey === optionsRowKey ? { ...row, options: optionsDraft.map(option => ({ ...option })) } : row));
    setOptionsRowKey(undefined);
  };

  return <ModalPortal isOpen onClose={close} title="Схема атрибутов каталога" size="wide" dismissDisabled={busy || recovering}>
    {loading && <StatePanel kind="loading">Загрузка схемы атрибутов…</StatePanel>}
    {!loading && Boolean(loadError) && <>
      <ApiError error={loadError} />
      <p role="alert">Схему не удалось прочитать. Редактирование недоступно.</p>
      <Button type="button" onClick={() => void loadSchema()}>Повторить чтение</Button>
    </>}
    {!loading && !loadError && baseline ? <>
      {permissionsPending && <p role="status">Проверка прав. Запись до её завершения отключена.</p>}
      {revoked && <p role="alert">Управление схемой заблокировано после отказа сервера.</p>}
      {rows.length === 0 && <StatePanel kind="empty">В схеме пока нет атрибутов. Добавьте определение, чтобы использовать типизированные поля.</StatePanel>}
      <p>При смене типа или удалении варианта существующие значения не преобразуются автоматически.</p>
      <p>Неактивные атрибуты сохраняются и остаются доступны для просмотра ранее записанных значений.</p>
      <DataTable aria-label="Атрибуты каталога" minWidth="46rem">
        <thead><tr><th scope="col">Название</th><th scope="col">Тип значения</th><th scope="col">Варианты</th><th scope="col">Активен</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.clientKey}>
          <td><Input aria-label={`Название атрибута ${row.title || 'новый'}`} value={row.title} disabled={writesDisabled} aria-invalid={!row.title.trim() || undefined} onChange={event => setRows(current => current.map(item => item.clientKey === row.clientKey ? { ...item, title: event.target.value } : item))} /></td>
          <td><Select aria-label={`Тип атрибута ${row.title || 'новый'}`} value={row.typeKey} disabled={writesDisabled} onChange={event => changeType(row, event.target.value as CatalogAttributeType)}>
            {schemaTypes.map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </Select></td>
          <td>{row.typeKey === 'singleChoice' || row.typeKey === 'multiChoice'
            ? <Button type="button" size="small" variant="secondary" disabled={writesDisabled} onClick={() => { setOptionsDraft(row.options.map(option => ({ ...option }))); setOptionsRowKey(row.clientKey); }}>Варианты ({row.options.length})</Button>
            : '—'}</td>
          <td><Checkbox aria-label={`Активен: ${row.title || 'новый атрибут'}`} checked={row.isActive} disabled={writesDisabled} onChange={event => setRows(current => current.map(item => item.clientKey === row.clientKey ? { ...item, isActive: event.target.checked } : item))} /></td>
        </tr>)}</tbody>
      </DataTable>
      {!writesDisabled && <Button type="button" onClick={addDefinition}>Добавить атрибут</Button>}
      {Boolean(failure) && <>
        <ApiError error={failure} />
        <p role="alert">{safeMessage(failure)}</p>
      </>}
      {status && <p role="status">{status}</p>}
      {blocked && <section>
        <h3>Восстановление схемы</h3>
        <p>Запись заблокирована. Перечитайте серверную схему перед выбором дальнейшего действия.</p>
        {!recoverySchema
          ? <Button type="button" disabled={recovering || busy} onClick={() => void reread()}>Перечитать серверную схему</Button>
          : <>
            <p>Серверная схема прочитана. Новые атрибуты после неопределённого результата нельзя повторно создавать автоматически.</p>
            <Button type="button" disabled={recovering || busy} onClick={() => resolveRecovery('accept')}>Принять серверную схему</Button>
            {!acceptOnly && <>
              <p>Оставление черновика сохранит дополнительные серверные атрибуты. Следующее сохранение отправит схему целиком.</p>
              <Button type="button" variant="secondary" disabled={recovering || busy} onClick={() => resolveRecovery('keep')}>Оставить черновик с новой ревизией</Button>
            </>}
          </>}
      </section>}
      {!blocked && <Button type="button" disabled={writesDisabled || invalid || !dirty} onClick={() => void save()}>{busy ? 'Сохранение…' : 'Сохранить схему'}</Button>}
      <Button type="button" variant="secondary" disabled={busy || recovering} onClick={close}>Отмена</Button>
    </> : null}
    {optionsRow && <ModalPortal isOpen onClose={() => setOptionsRowKey(undefined)} title={`Варианты: ${optionsRow.title || 'новый атрибут'}`} size="compact">
      <DataTable aria-label={`Варианты атрибута ${optionsRow.title || 'новый'}`} minWidth="24rem">
        <thead><tr><th scope="col">Название</th><th scope="col">Действия</th></tr></thead>
        <tbody>{optionsDraft.map((option, index) => <tr key={option.optionKey}>
          <td><Input aria-label={`Название варианта ${index + 1}`} value={option.title} disabled={writesDisabled} onChange={event => setOptionsDraft(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></td>
          <td><IconButton icon="delete" size="small" variant="danger" title="Удалить вариант" ariaLabel="Удалить вариант" disabled={writesDisabled} onClick={() => {
            const option = optionsDraft[index];
            if (optionsRow.id && option && !window.confirm('Удаление варианта может сделать сохранённые значения несовместимыми. Удалить вариант?')) return;
            setOptionsDraft(current => current.filter((_, itemIndex) => itemIndex !== index));
          }} /></td>
        </tr>)}</tbody>
      </DataTable>
      <ActionRow><Button type="button" size="small" disabled={writesDisabled} onClick={() => setOptionsDraft(current => [...current, { optionKey: crypto.randomUUID(), title: '' }])}>Добавить вариант</Button></ActionRow>
      <ActionRow><Button type="button" disabled={writesDisabled} onClick={applyOptions}>Применить</Button><Button type="button" variant="secondary" onClick={() => setOptionsRowKey(undefined)}>Отмена</Button></ActionRow>
    </ModalPortal>}
  </ModalPortal>;
};

export default CatalogAttributesDialog;
