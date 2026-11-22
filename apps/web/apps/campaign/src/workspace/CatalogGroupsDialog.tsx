import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Field, FieldSet, Input, ModalPortal, Select, StatePanel } from '@tdn/shared';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { CampaignApiError } from './api';
import { ApiError } from './Feedback';
import { stringifyJson } from './json';
import { CatalogConditionEditor } from './CatalogConditionEditor';
import type { CatalogAttributeDefinition, CatalogGroup, CatalogGroupCondition, CatalogGroupConfigurationEnvelope, CatalogGroupInput, CatalogMetadata } from './catalogTypes';

type GroupRow = {
  clientKey: string;
  id?: string;
  title: string;
  parentId: string | null;
  entryIds: string[];
  condition: CatalogGroupCondition | null;
};

type RecoverySnapshot = {
  configuration: CatalogGroupConfigurationEnvelope;
  entries: CatalogMetadata[];
  definitions: CatalogAttributeDefinition[];
};

type Props = {
  campaignId: number;
  canManage: boolean;
  permissionsPending?: boolean;
  onClose: () => void;
  onSaved: (configuration: CatalogGroupConfigurationEnvelope) => void;
  onForbidden: () => void;
};

const diagnosticLabels: Record<string, string> = {
  invalid_condition: 'Условие сохранено в некорректной форме; автоматический отбор отключён.',
  unknown_attribute: 'Условие ссылается на отсутствующий атрибут.',
  incompatible_attribute_type: 'Тип или версия атрибута в условии устарели.',
  invalid_attribute_value: 'Значение условия не соответствует текущей схеме.',
  invalid_group_condition: 'Условие группы не прошло проверку схемы.',
  invalid_group_parent: 'Некорректная связь родителя группы.',
  invalid_group_entries: 'Состав группы содержит недопустимую запись.',
};

const safeMessage = (error: unknown) => {
  if (!(error instanceof CampaignApiError)) return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  if (error.unknownOutcome || error.status === 0) return 'Результат записи неизвестен. Перечитайте конфигурацию перед продолжением.';
  if (error.status === 409) return 'Конфигурация групп изменилась на сервере. Перечитайте актуальную версию.';
  if (error.status === 403) return 'Право управления каталогом больше недоступно.';
  if (error.status === 400) return 'Проверьте названия, состав, иерархию и условия групп.';
  return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
};

const isRecoverable = (error: unknown) => error instanceof CampaignApiError
  && (error.conflict || error.unknownOutcome || error.status === 0);

function rowsFromConfiguration(groups: CatalogGroup[]): GroupRow[] {
  return groups.map(group => ({
    clientKey: `group-${group.id}`,
    id: group.id,
    title: group.title,
    parentId: group.parentId,
    entryIds: [...group.entryIds],
    condition: group.condition,
  }));
}

function inputsFromRows(rows: GroupRow[]): CatalogGroupInput[] {
  return rows.map(({ id, title, parentId, entryIds, condition }) => ({
    ...(id ? { id } : {}),
    title,
    parentId: id ? parentId : null,
    entryIds,
    condition,
  }));
}

function collectAttributeIds(condition: CatalogGroupCondition | null, ids = new Set<string>()): string[] {
  if (!condition) return [...ids];
  if (condition.attributeId) ids.add(condition.attributeId);
  condition.children?.forEach(child => collectAttributeIds(child, ids));
  return [...ids];
}

function sameGroupDraft(left: CatalogGroupInput[], right: CatalogGroupInput[]): boolean {
  return stringifyJson(left) === stringifyJson(right);
}

const CatalogGroupsDialog: React.FC<Props> = ({
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

  const [baseline, setBaseline] = useState<CatalogGroupConfigurationEnvelope>();
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<CatalogMetadata[]>([]);
  const [definitions, setDefinitions] = useState<CatalogAttributeDefinition[]>([]);
  const [allowInactiveByGroup, setAllowInactiveByGroup] = useState<Record<string, string[]>>({});
  const [diagnostics, setDiagnostics] = useState<CatalogGroupConfigurationEnvelope['diagnostics']>([]);
  const [conditionInvalid, setConditionInvalid] = useState<Record<string, boolean>>({});
  const [conditionTouched, setConditionTouched] = useState(false);
  const [conditionEpoch, setConditionEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>();
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [acceptOnly, setAcceptOnly] = useState(false);
  const [recovery, setRecovery] = useState<RecoverySnapshot>();
  const [status, setStatus] = useState('');

  canWriteRef.current = canManage && !permissionsPending && !revoked;
  const baselineInputs = useMemo(() => baseline ? inputsFromRows(rowsFromConfiguration(baseline.data.groups)) : [], [baseline]);
  const dirty = Boolean(baseline && !sameGroupDraft(inputsFromRows(rows), baselineInputs));
  const invalidTitles = rows.some(row => !row.title.trim());
  const invalidConditions = rows.some(row => conditionInvalid[row.clientKey]);
  const invalid = invalidTitles || invalidConditions;
  useDirtyDraft(`catalog-groups-${sessionKey}-${campaignId}`, dirty || blocked || (invalid && conditionTouched));

  const reportForbidden = () => {
    if (!mountedRef.current) return;
    setRevoked(true);
    onForbiddenRef.current();
  };

  const acceptConfiguration = (snapshot: RecoverySnapshot) => {
    const nextRows = rowsFromConfiguration(snapshot.configuration.data.groups);
    setBaseline(snapshot.configuration);
    setRows(nextRows);
    setCatalogEntries(snapshot.entries);
    setDefinitions(snapshot.definitions);
    setDiagnostics(snapshot.configuration.diagnostics);
    setAllowInactiveByGroup(Object.fromEntries(snapshot.configuration.data.groups.map(group => [
      group.id,
      collectAttributeIds(group.condition),
    ])));
    setConditionInvalid({});
    setConditionTouched(false);
    setConditionEpoch(value => value + 1);
    setRecovery(undefined);
    setBlocked(false);
    setAcceptOnly(false);
    setFailure(undefined);
    setStatus('Принята серверная конфигурация групп.');
    onSavedRef.current(snapshot.configuration);
  };

  const loadConfiguration = async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const [configuration, entries, schema] = await Promise.all([
        api.getCatalogGroupConfiguration(campaignId),
        api.listCatalog(campaignId),
        api.getCatalogAttributes(campaignId),
      ]);
      if (!mountedRef.current || generation !== loadGeneration.current) return;
      setBaseline(configuration);
      setRows(rowsFromConfiguration(configuration.data.groups));
      setCatalogEntries(entries);
      setDefinitions(schema.data.definitions);
      setDiagnostics(configuration.diagnostics);
      setAllowInactiveByGroup(Object.fromEntries(configuration.data.groups.map(group => [
        group.id,
        collectAttributeIds(group.condition),
      ])));
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
    void loadConfiguration();
    return () => {
      mountedRef.current = false;
      loadGeneration.current += 1;
    };
  }, [campaignId, api]);

  const close = () => {
    if (busyRef.current || recoveryBusyRef.current || recovering) return;
    if ((dirty || blocked || (invalid && conditionTouched))
      && !window.confirm('Есть несохранённые изменения. Закрыть и потерять их?')) return;
    onCloseRef.current();
  };

  const updateRow = (clientKey: string, updater: (row: GroupRow) => GroupRow) => {
    setRows(current => current.map(row => row.clientKey === clientKey ? updater(row) : row));
  };

  const hasChildren = (row: GroupRow) => {
    const groupId = row.id;
    return Boolean(groupId && rows.some(child => child.parentId === groupId));
  };

  const removeGroup = (row: GroupRow) => {
    if (hasChildren(row)) return;
    setRows(current => current.filter(item => item.clientKey !== row.clientKey));
    setConditionInvalid(current => {
      if (!(row.clientKey in current)) return current;
      const next = { ...current };
      delete next[row.clientKey];
      return next;
    });
  };

  const isDescendant = (candidateId: string, groupId: string) => {
    let current = rows.find(row => row.id === candidateId);
    const visited = new Set<string>();
    while (current?.parentId && !visited.has(current.parentId)) {
      const parentId = current.parentId;
      if (parentId === groupId) return true;
      visited.add(parentId);
      current = rows.find(row => row.id === parentId);
    }
    return false;
  };

  const updateConditionValidity = (clientKey: string, value: boolean) => {
    setConditionInvalid(current => current[clientKey] === value ? current : { ...current, [clientKey]: value });
  };

  const serverRows = (result: CatalogGroupConfigurationEnvelope, submittedRows: GroupRow[]) => result.data.groups.map((group, index) => ({
    clientKey: submittedRows[index]?.clientKey ?? `group-${group.id}`,
    id: group.id,
    title: group.title,
    parentId: group.parentId,
    entryIds: [...group.entryIds],
    condition: group.condition,
  }));

  const save = async () => {
    if (!baseline || !canWriteRef.current || busyRef.current || blocked || invalid || !dirty) return;
    const submittedRows = rows;
    const payload = inputsFromRows(submittedRows);
    const hasNewGroups = payload.some(group => !group.id);
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    setStatus('');
    try {
      const result = await api.putCatalogGroups(campaignId, {
        expectedRevision: baseline.contentRevision,
        groups: payload,
      });
      if (!mountedRef.current) return;
      setBaseline(result);
      setRows(serverRows(result, submittedRows));
      setDiagnostics(result.diagnostics);
      setConditionInvalid({});
      setConditionTouched(false);
      setConditionEpoch(value => value + 1);
      setAllowInactiveByGroup(Object.fromEntries(result.data.groups.map(group => [group.id, collectAttributeIds(group.condition)])));
      setStatus('Конфигурация групп подтверждённо сохранена.');
      onSavedRef.current(result);
    } catch (error) {
      if (!mountedRef.current) return;
      setFailure(error);
      if ((error as { status?: number })?.status === 403) reportForbidden();
      if (isRecoverable(error)) {
        setBlocked(true);
        setAcceptOnly(Boolean(error instanceof CampaignApiError && (error.unknownOutcome || error.status === 0) && hasNewGroups));
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
    setRecovery(undefined);
    setFailure(undefined);
    try {
      const [configuration, entries, schema] = await Promise.all([
        api.getCatalogGroupConfiguration(campaignId),
        api.listCatalog(campaignId),
        api.getCatalogAttributes(campaignId),
      ]);
      if (!mountedRef.current) return;
      const snapshot = { configuration, entries, definitions: schema.data.definitions };
      setRecovery(snapshot);
      onSavedRef.current(configuration);
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
    if (!recovery || !blocked) return;
    if (action === 'accept') {
      if (!window.confirm('Заменить черновик групп актуальной серверной конфигурацией?')) return;
      acceptConfiguration(recovery);
      return;
    }
    if (acceptOnly) return;
    setBaseline(recovery.configuration);
    setCatalogEntries(recovery.entries);
    setDefinitions(recovery.definitions);
    setDiagnostics(recovery.configuration.diagnostics);
    setAllowInactiveByGroup(Object.fromEntries(recovery.configuration.data.groups.map(group => [
      group.id,
      collectAttributeIds(group.condition),
    ])));
    setRecovery(undefined);
    setBlocked(false);
    setFailure(undefined);
    setStatus('Черновик оставлен; актуальная ревизия принята для следующего явного сохранения.');
  };

  const controlsDisabled = busy || recovering || permissionsPending || revoked || !canManage || blocked;
  const entryById = useMemo(() => new Map(catalogEntries.map(entry => [entry.id, entry])), [catalogEntries]);
  const diagnosticRows = (groupId: string) => diagnostics.filter(item => item.groupId === groupId);

  return <ModalPortal isOpen onClose={close} title="Группы каталога" dismissDisabled={busy || recovering}>
    {loading && <StatePanel kind="loading">Загрузка групп, состава каталога и схемы условий…</StatePanel>}
    {!loading && Boolean(loadError) && <>
      <ApiError error={loadError} />
      <p role="alert">Конфигурация не загружена. Редактирование недоступно.</p>
      <Button type="button" onClick={() => void loadConfiguration()}>Повторить чтение</Button>
    </>}
    {!loading && !loadError && baseline ? <>
      {permissionsPending && <p role="status">Проверка прав. Запись до её завершения отключена.</p>}
      {revoked && <p role="alert">Управление группами заблокировано после отказа сервера.</p>}
      {rows.length === 0 && <StatePanel kind="empty">Групп пока нет. Добавьте корневую группу.</StatePanel>}
      {rows.map(row => {
        const currentGroupId = row.id;
        const children = Boolean(currentGroupId && rows.some(candidate => candidate.parentId === currentGroupId));
        const safeDiagnostics = currentGroupId ? diagnosticRows(currentGroupId) : [];
        const groupAttributeIds = currentGroupId ? allowInactiveByGroup[currentGroupId] ?? [] : [];
        const parentChoices = currentGroupId
          ? rows.filter((candidate): candidate is GroupRow & { id: string } => typeof candidate.id === 'string'
            && candidate.id !== currentGroupId
            && !isDescendant(candidate.id, currentGroupId))
          : [];
        return <FieldSet key={row.clientKey} legend={row.title || 'Новая группа'}>
          <Field label="Название группы" htmlFor={`${row.clientKey}-title`} error={!row.title.trim() ? 'Введите название.' : undefined}>
            <Input
              id={`${row.clientKey}-title`}
              value={row.title}
              disabled={controlsDisabled}
              aria-invalid={!row.title.trim() || undefined}
              onChange={event => updateRow(row.clientKey, current => ({ ...current, title: event.target.value }))}
            />
          </Field>
          {currentGroupId
            ? <Field label="Родительская группа" htmlFor={`${row.clientKey}-parent`}>
              <Select
                id={`${row.clientKey}-parent`}
                value={row.parentId ?? ''}
                disabled={controlsDisabled}
                onChange={event => updateRow(row.clientKey, current => ({ ...current, parentId: event.target.value || null }))}
              >
                <option value="">Нет родителя</option>
                {parentChoices.map(parent => <option key={parent.id} value={parent.id}>{parent.title}</option>)}
              </Select>
            </Field>
            : <p>Новая группа будет создана корневой. Сохраните её, чтобы назначать её родителем.</p>}
          <FieldSet legend="Явный состав">
            {catalogEntries.length === 0 && <p>Доступных определений каталога нет.</p>}
            {catalogEntries.map(entry => <label key={entry.id}>
              <Checkbox
                checked={row.entryIds.includes(entry.id)}
                disabled={controlsDisabled}
                onChange={event => updateRow(row.clientKey, current => ({
                  ...current,
                  entryIds: event.target.checked
                    ? [...current.entryIds, entry.id]
                    : current.entryIds.filter(id => id !== entry.id),
                }))}
              />
              {entry.name} <small>{entry.kind === 'Item' ? 'Предмет' : 'Навык'}{entry.isHidden ? ' · скрытое' : ''}</small>
            </label>)}
          </FieldSet>
          <CatalogConditionEditor
            key={`${conditionEpoch}:${row.clientKey}`}
            definitions={definitions}
            condition={row.condition}
            disabled={controlsDisabled}
            allowInactiveAttributeIds={groupAttributeIds}
            onChange={condition => updateRow(row.clientKey, current => ({ ...current, condition }))}
            onValidityChange={invalid => updateConditionValidity(row.clientKey, invalid)}
            onInteraction={() => setConditionTouched(true)}
          />
          {safeDiagnostics.map((diagnostic, index) => {
            const message = diagnosticLabels[diagnostic.code] ?? 'Сервер обнаружил проблему в настройке этой группы.';
            const entryName = diagnostic.entryId ? entryById.get(diagnostic.entryId)?.name : undefined;
            return <p role="status" key={`${diagnostic.code}-${index}`}>
              {message}{diagnostic.entryId ? ` Определение: ${entryName ?? 'недоступно'}.` : ''}
            </p>;
          })}
          {children && <p role="alert">Перед удалением группы перенесите или удалите её дочерние группы.</p>}
          <Button type="button" variant="secondary" disabled={controlsDisabled || children} onClick={() => removeGroup(row)}>Удалить группу</Button>
        </FieldSet>;
      })}
      {!controlsDisabled && <Button type="button" onClick={() => setRows(current => [...current, {
        clientKey: `new:${crypto.randomUUID()}`,
        title: '',
        parentId: null,
        entryIds: [],
        condition: null,
      }])}>Добавить корневую группу</Button>}
      {Boolean(failure) && <>
        <ApiError error={failure} />
        <p role="alert">{safeMessage(failure)}</p>
      </>}
      {status && <p role="status">{status}</p>}
      {blocked && <section>
        <h3>Восстановление конфигурации</h3>
        <p>Запись заблокирована. Перечитайте конфигурацию перед выбором дальнейшего действия.</p>
        {!recovery
          ? <Button type="button" disabled={recovering || busy} onClick={() => void reread()}>Перечитать группы и состав</Button>
          : <>
            <p>Серверная конфигурация перечитана. Неопубликованные новые группы не будут отправлены повторно после неизвестного результата.</p>
            <Button type="button" disabled={recovering || busy} onClick={() => resolveRecovery('accept')}>Принять серверную конфигурацию</Button>
            {!acceptOnly && <Button type="button" variant="secondary" disabled={recovering || busy} onClick={() => resolveRecovery('keep')}>Оставить черновик с новой ревизией</Button>}
          </>}
      </section>}
      {!blocked && <Button type="button" disabled={controlsDisabled || invalid || !dirty} onClick={() => void save()}>{busy ? 'Сохранение…' : 'Сохранить группы'}</Button>}
      <Button type="button" variant="secondary" disabled={busy || recovering} onClick={close}>Отмена</Button>
    </> : null}
  </ModalPortal>;
};

export default CatalogGroupsDialog;
