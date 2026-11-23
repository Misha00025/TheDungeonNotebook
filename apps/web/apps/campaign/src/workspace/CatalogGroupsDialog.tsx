import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, DataTable, IconButton, Input, ModalPortal, StatePanel } from '@tdn/shared';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { CampaignApiError } from './api';
import { ApiError } from './Feedback';
import CatalogGroupConditionDialog from './CatalogGroupConditionDialog';
import CatalogGroupMembersDialog from './CatalogGroupMembersDialog';
import CatalogGroupMoveDialog from './CatalogGroupMoveDialog';
import styles from './CatalogGroupsDialog.module.css';
import type { CatalogAttributeDefinition, CatalogGroupCondition, CatalogGroupConfigurationEnvelope, CatalogMetadata } from './catalogTypes';
import { assignConfirmedIds, createGroupDraftRow, groupDraftHierarchyError, groupDraftIsDirty, planGroupSaveStage, rowsFromAcceptedGroups, rowsFromConfiguration } from './catalogGroupDraft';
import type { CatalogGroupDraftRow } from './catalogGroupDraft';

type RecoverySnapshot = {
  configuration: CatalogGroupConfigurationEnvelope;
  entries: CatalogMetadata[];
  definitions: CatalogAttributeDefinition[];
};

type ActiveEditor = { kind: 'members' | 'condition' | 'move'; clientKey: string };

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

function initialExpandedKeys(rows: CatalogGroupDraftRow[]) {
  const parentKeys = new Set(rows.flatMap(row => row.parentKey ? [row.parentKey] : []));
  return new Set(rows.filter(row => row.parentKey === null || !parentKeys.has(row.clientKey)).map(row => row.clientKey));
}

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

function collectAttributeIds(condition: CatalogGroupCondition | null, ids = new Set<string>()): string[] {
  if (!condition) return [...ids];
  if (condition.attributeId) ids.add(condition.attributeId);
  condition.children?.forEach(child => collectAttributeIds(child, ids));
  return [...ids];
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
  const [rows, setRows] = useState<CatalogGroupDraftRow[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [focusGroupKey, setFocusGroupKey] = useState<string>();
  const titleInputRefs = useRef(new Map<string, HTMLInputElement>());
  const [catalogEntries, setCatalogEntries] = useState<CatalogMetadata[]>([]);
  const [definitions, setDefinitions] = useState<CatalogAttributeDefinition[]>([]);
  const [allowInactiveByGroup, setAllowInactiveByGroup] = useState<Record<string, string[]>>({});
  const [diagnostics, setDiagnostics] = useState<CatalogGroupConfigurationEnvelope['diagnostics']>([]);
  const [activeEditor, setActiveEditor] = useState<ActiveEditor>();
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
  const [draftError, setDraftError] = useState<string>();

  canWriteRef.current = canManage && !permissionsPending && !revoked;
  const dirty = groupDraftIsDirty(rows, baseline);
  const invalidTitles = rows.some(row => !row.title.trim());
  const hierarchyError = groupDraftHierarchyError(rows);
  const invalid = invalidTitles || Boolean(hierarchyError || draftError);
  useDirtyDraft(`catalog-groups-${sessionKey}-${campaignId}`, dirty || blocked);

  useEffect(() => {
    if (!focusGroupKey) return;
    titleInputRefs.current.get(focusGroupKey)?.focus();
    setFocusGroupKey(undefined);
  }, [focusGroupKey, rows, expandedKeys]);

  const reportForbidden = () => {
    if (!mountedRef.current) return;
    setRevoked(true);
    onForbiddenRef.current();
  };

  const acceptConfiguration = (snapshot: RecoverySnapshot) => {
    const nextRows = rowsFromConfiguration(snapshot.configuration.data.groups);
    setBaseline(snapshot.configuration);
    setRows(nextRows);
    setExpandedKeys(initialExpandedKeys(nextRows));
    setCatalogEntries(snapshot.entries);
    setDefinitions(snapshot.definitions);
    setDiagnostics(snapshot.configuration.diagnostics);
    setAllowInactiveByGroup(Object.fromEntries(snapshot.configuration.data.groups.map(group => [
      group.id,
      collectAttributeIds(group.condition),
    ])));
    setActiveEditor(undefined);
    setRecovery(undefined);
    setBlocked(false);
    setAcceptOnly(false);
    setFailure(undefined);
    setDraftError(undefined);
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
      const loadedRows = rowsFromConfiguration(configuration.data.groups);
      setRows(loadedRows);
      setExpandedKeys(initialExpandedKeys(loadedRows));
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
    if ((dirty || blocked)
      && !window.confirm('Есть несохранённые изменения. Закрыть и потерять их?')) return;
    onCloseRef.current();
  };

  const updateRow = (clientKey: string, updater: (row: CatalogGroupDraftRow) => CatalogGroupDraftRow) => {
    setDraftError(undefined);
    setRows(current => current.map(row => row.clientKey === clientKey ? updater(row) : row));
  };

  const hasChildren = (row: CatalogGroupDraftRow) => {
    return rows.some(child => child.parentKey === row.clientKey);
  };

  const removeGroup = (row: CatalogGroupDraftRow) => {
    if (!canWriteRef.current || busyRef.current || blocked || activeEditor || hasChildren(row)) return;
    setDraftError(undefined);
    setRows(current => current.filter(item => item.clientKey !== row.clientKey));
    setExpandedKeys(current => {
      const next = new Set(current);
      next.delete(row.clientKey);
      return next;
    });
  };

  const addGroup = (parentKey: string | null = null) => {
    if (!canWriteRef.current || busyRef.current || blocked || activeEditor) return;
    if (parentKey !== null && !rows.some(row => row.clientKey === parentKey)) return;
    setDraftError(undefined);
    const row = createGroupDraftRow(parentKey);
    setRows(current => [...current, row]);
    setExpandedKeys(current => {
      const next = new Set(current);
      if (parentKey) next.add(parentKey);
      next.add(row.clientKey);
      return next;
    });
    setFocusGroupKey(row.clientKey);
  };

  const toggleExpanded = (clientKey: string) => setExpandedKeys(current => {
    const next = new Set(current);
    if (next.has(clientKey)) next.delete(clientKey);
    else next.add(clientKey);
    return next;
  });

  const isDescendant = (candidateKey: string, groupKey: string) => {
    let current = rows.find(row => row.clientKey === candidateKey);
    const visited = new Set<string>();
    while (current?.parentKey && !visited.has(current.parentKey)) {
      const parentKey = current.parentKey;
      if (parentKey === groupKey) return true;
      visited.add(parentKey);
      current = rows.find(row => row.clientKey === parentKey);
    }
    return false;
  };

  const save = async () => {
    if (!baseline || !canWriteRef.current || busyRef.current || blocked || activeEditor || invalid || !dirty) return;
    const generation = loadGeneration.current;
    let confirmed = baseline;
    let workingRows = rows;
    let failedStageContainsNewGroups = false;
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    setStatus('');
    setDraftError(undefined);
    try {
      while (true) {
        if (!mountedRef.current || generation !== loadGeneration.current) return;
        if (!canWriteRef.current || blocked) {
          setStatus('Дальнейшее сохранение остановлено после изменения доступа.');
          break;
        }
        const plan = planGroupSaveStage(workingRows, confirmed.data.groups);
        if ('error' in plan) {
          setDraftError(plan.error);
          break;
        }
        failedStageContainsNewGroups = plan.stage.containsNewGroups;
        const result = await api.putCatalogGroups(campaignId, {
          expectedRevision: confirmed.contentRevision,
          groups: plan.stage.groups,
        });
        if (!mountedRef.current || generation !== loadGeneration.current) return;
        workingRows = plan.stage.kind === 'final'
          ? rowsFromAcceptedGroups(result.data.groups, plan.stage.clientKeys)
          : assignConfirmedIds(workingRows, plan.stage.clientKeys, result.data.groups);
        confirmed = result;
        setBaseline(result);
        setRows(workingRows);
        setDiagnostics(result.diagnostics);
        setAllowInactiveByGroup(Object.fromEntries(result.data.groups.map(group => [group.id, collectAttributeIds(group.condition)])));
        onSavedRef.current(result);
        if (plan.stage.kind === 'final') {
          setStatus('Конфигурация групп подтверждённо сохранена.');
          break;
        }
        setStatus('Новые группы подтверждены; остальные изменения ещё не сохранены.');
        failedStageContainsNewGroups = false;
        if (!canWriteRef.current) {
          setStatus('Сохранённый этап принят; дальнейшая запись остановлена после изменения доступа.');
          break;
        }
      }
    } catch (error) {
      if (!mountedRef.current || generation !== loadGeneration.current) return;
      setFailure(error);
      if ((error as { status?: number })?.status === 403) reportForbidden();
      if (isRecoverable(error)) {
        setBlocked(true);
        setAcceptOnly(Boolean(error instanceof CampaignApiError && (error.unknownOutcome || error.status === 0) && failedStageContainsNewGroups));
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
    setDraftError(undefined);
    setStatus('Черновик оставлен; актуальная ревизия принята для следующего явного сохранения.');
  };

  const controlsDisabled = busy || recovering || permissionsPending || revoked || !canManage || blocked;
  const tableDisabled = controlsDisabled || Boolean(activeEditor);
  const entryById = useMemo(() => new Map(catalogEntries.map(entry => [entry.id, entry])), [catalogEntries]);
  const diagnosticRows = (groupId: string) => diagnostics.filter(item => item.groupId === groupId);
  const diagnosticMessage = (diagnostic: CatalogGroupConfigurationEnvelope['diagnostics'][number]) => {
    const message = diagnosticLabels[diagnostic.code] ?? 'Сервер обнаружил проблему в настройке группы.';
    const entryName = diagnostic.entryId ? entryById.get(diagnostic.entryId)?.name : undefined;
    return diagnostic.entryId ? `${message} Запись: ${entryName ?? 'недоступно'}.` : message;
  };
  const applyMembers = (clientKey: string, entryIds: string[]) => {
    if (activeEditor?.kind !== 'members' || activeEditor.clientKey !== clientKey
      || controlsDisabled || !canWriteRef.current || busyRef.current || recoveryBusyRef.current || blocked || recovering) return;
    if (!rows.some(row => row.clientKey === clientKey)) return;
    updateRow(clientKey, row => ({ ...row, entryIds: [...new Set(entryIds)] }));
    setActiveEditor(undefined);
  };
  const applyCondition = (clientKey: string, condition: CatalogGroupCondition | null) => {
    if (activeEditor?.kind !== 'condition' || activeEditor.clientKey !== clientKey
      || controlsDisabled || !canWriteRef.current || busyRef.current || recoveryBusyRef.current || blocked || recovering) return;
    if (!rows.some(row => row.clientKey === clientKey)) return;
    updateRow(clientKey, row => ({ ...row, condition }));
    setActiveEditor(undefined);
  };
  const applyMove = (clientKey: string, parentKey: string | null) => {
    if (activeEditor?.kind !== 'move' || activeEditor.clientKey !== clientKey
      || controlsDisabled || !canWriteRef.current || busyRef.current || recoveryBusyRef.current || blocked || recovering) return;
    if (!rows.some(row => row.clientKey === clientKey)) return;
    if (parentKey !== null && (!rows.some(row => row.clientKey === parentKey)
      || parentKey === clientKey || isDescendant(parentKey, clientKey))) return;
    updateRow(clientKey, row => ({ ...row, parentKey }));
    setExpandedKeys(current => {
      const next = new Set(current);
      let currentKey: string | null = parentKey;
      const visited = new Set<string>();
      while (currentKey && !visited.has(currentKey)) {
        next.add(currentKey);
        visited.add(currentKey);
        currentKey = rows.find(row => row.clientKey === currentKey)?.parentKey ?? null;
      }
      next.add(clientKey);
      return next;
    });
    setActiveEditor(undefined);
  };

  const renderGroupRows = () => {
    const rendered = new Set<string>();
    const renderGroup = (row: CatalogGroupDraftRow, depth: number, detached = false): React.ReactNode[] => {
      if (rendered.has(row.clientKey)) return [];
      rendered.add(row.clientKey);
      const children = rows.filter(candidate => candidate.parentKey === row.clientKey);
      const expanded = expandedKeys.has(row.clientKey);
      const safeDiagnostics = row.id ? diagnosticRows(row.id) : [];
      const groupLabel = row.title || 'Новая группа';
      const diagnosticTitle = safeDiagnostics.map(diagnosticMessage).join(' ');
      const result: React.ReactNode[] = [<tr key={row.clientKey}>
        <td><div className={styles.groupCell} style={{ '--tree-indent': `${depth * 1.125}rem` } as React.CSSProperties}>
          <Button
            type="button"
            variant="ghost"
            size="small"
            className={styles.disclosure}
            aria-label={`${expanded ? 'Свернуть' : 'Развернуть'} группу ${groupLabel}`}
            aria-expanded={expanded}
            disabled={tableDisabled}
            onClick={() => toggleExpanded(row.clientKey)}
          ><span aria-hidden="true">{expanded ? '▾' : '▸'}</span></Button>
          <Input
            ref={element => {
              if (element) titleInputRefs.current.set(row.clientKey, element);
              else titleInputRefs.current.delete(row.clientKey);
            }}
            className={styles.groupName}
            aria-label="Название группы"
            value={row.title}
            disabled={tableDisabled}
            aria-invalid={!row.title.trim() || undefined}
            title={!row.title.trim() ? 'Введите название.' : undefined}
            onChange={event => updateRow(row.clientKey, current => ({ ...current, title: event.target.value }))}
          />
          {detached && <small className={styles.hierarchyWarning} aria-hidden="true" title={hierarchyError}>!</small>}
          {safeDiagnostics.length > 0 && <small className={styles.groupDiagnostic} role="status" aria-label={`Проблемы: ${safeDiagnostics.length}. ${diagnosticTitle}`} title={diagnosticTitle}>!</small>}
        </div></td>
        <td><Button type="button" size="small" variant="ghost" className={styles.rowAction} aria-label={`Состав: ${groupLabel}`} disabled={tableDisabled} onClick={() => setActiveEditor({ kind: 'members', clientKey: row.clientKey })}>#{row.entryIds.length}</Button></td>
        <td><Button type="button" size="small" variant="ghost" className={styles.rowAction} aria-label={`Условие: ${groupLabel}`} disabled={tableDisabled} onClick={() => setActiveEditor({ kind: 'condition', clientKey: row.clientKey })}>{row.condition ? 'Задано' : 'Нет'}</Button></td>
        <td><div className={styles.rowActions}>
          <IconButton icon="sort" size="small" title={`Переместить группу ${groupLabel}`} ariaLabel={`Переместить группу ${groupLabel}`} disabled={tableDisabled} onClick={() => setActiveEditor({ kind: 'move', clientKey: row.clientKey })} />
          <IconButton icon="delete" size="small" variant="danger" title={children.length > 0 ? 'Сначала перенесите дочерние группы' : `Удалить группу ${groupLabel}`} ariaLabel={`Удалить группу ${groupLabel}`} disabled={tableDisabled || children.length > 0} onClick={() => removeGroup(row)} />
        </div></td>
      </tr>];
      if (expanded) {
        for (const child of children) result.push(...renderGroup(child, depth + 1));
        result.push(<tr key={`add-child-${row.clientKey}`}>
          <td colSpan={4}>
            <div className={styles.treeActionCell} style={{ '--tree-indent': `${(depth + 1) * 1.125}rem` } as React.CSSProperties}>
              <Button type="button" variant="ghost" className={styles.addRowAction} aria-label={`Добавить дочернюю группу: ${groupLabel}`} disabled={tableDisabled} onClick={() => addGroup(row.clientKey)}>+ Добавить дочернюю группу</Button>
            </div>
          </td>
        </tr>);
      }
      return result;
    };

    const reachable = new Set<string>();
    const pending = rows.filter(row => row.parentKey === null).map(row => row.clientKey);
    while (pending.length > 0) {
      const clientKey = pending.pop()!;
      if (reachable.has(clientKey)) continue;
      reachable.add(clientKey);
      rows.filter(row => row.parentKey === clientKey).forEach(row => pending.push(row.clientKey));
    }

    const treeRows: React.ReactNode[] = [];
    for (const root of rows.filter(row => row.parentKey === null)) treeRows.push(...renderGroup(root, 0));
    for (const row of rows) {
      if (!reachable.has(row.clientKey)) treeRows.push(...renderGroup(row, 0, true));
    }
    treeRows.push(<tr key="add-root-group">
      <td colSpan={4}><Button type="button" variant="ghost" className={styles.addRowAction} aria-label="Добавить группу" disabled={tableDisabled} onClick={() => addGroup(null)}>+ Добавить группу</Button></td>
    </tr>);
    return treeRows;
  };

  return <ModalPortal isOpen onClose={close} title="Группы каталога" size="wide" dismissDisabled={busy || recovering}>
    {loading && <StatePanel kind="loading">Загрузка групп, состава каталога и схемы условий…</StatePanel>}
    {!loading && Boolean(loadError) && <>
      <ApiError error={loadError} />
      <p role="alert">Конфигурация не загружена. Редактирование недоступно.</p>
      <Button type="button" onClick={() => void loadConfiguration()}>Повторить чтение</Button>
    </>}
    {!loading && !loadError && baseline ? <>
      {permissionsPending && <p role="status">Проверка прав. Запись до её завершения отключена.</p>}
      {revoked && <p role="alert">Управление группами заблокировано после отказа сервера.</p>}
      {(hierarchyError || draftError) && <p role="alert">{hierarchyError ?? draftError}</p>}
      {invalidTitles && <p role="alert">Укажите название каждой группы.</p>}
      <DataTable className={styles.treeTable} aria-label="Группы каталога" minWidth="32rem">
        <thead><tr><th scope="col">Группа</th><th scope="col">Состав</th><th scope="col">Условие</th><th scope="col">Действия</th></tr></thead>
        <tbody>{renderGroupRows()}</tbody>
      </DataTable>
      {activeEditor?.kind === 'members' && (() => {
        const row = rows.find(candidate => candidate.clientKey === activeEditor.clientKey);
        return row ? <CatalogGroupMembersDialog
          key={row.clientKey}
          groupLabel={row.title || 'Новая группа'}
          initialEntryIds={row.entryIds}
          catalogEntries={catalogEntries}
          disabled={controlsDisabled}
          onApply={entryIds => applyMembers(row.clientKey, entryIds)}
          onClose={() => setActiveEditor(undefined)}
        /> : null;
      })()}
      {activeEditor?.kind === 'condition' && (() => {
        const row = rows.find(candidate => candidate.clientKey === activeEditor.clientKey);
        return row ? <CatalogGroupConditionDialog
          key={row.clientKey}
          groupLabel={row.title || 'Новая группа'}
          initialCondition={row.condition}
          definitions={definitions}
          allowInactiveAttributeIds={row.id ? allowInactiveByGroup[row.id] ?? [] : []}
          disabled={controlsDisabled}
          onApply={condition => applyCondition(row.clientKey, condition)}
          onClose={() => setActiveEditor(undefined)}
        /> : null;
      })()}
      {activeEditor?.kind === 'move' && (() => {
        const row = rows.find(candidate => candidate.clientKey === activeEditor.clientKey);
        const choices = row
          ? rows.filter(candidate => candidate.clientKey !== row.clientKey && !isDescendant(candidate.clientKey, row.clientKey))
            .map(candidate => ({ key: candidate.clientKey, title: candidate.title || 'Новая группа' }))
          : [];
        return row ? <CatalogGroupMoveDialog
          key={row.clientKey}
          groupLabel={row.title || 'Новая группа'}
          initialParentKey={row.parentKey}
          choices={choices}
          disabled={controlsDisabled}
          onApply={parentKey => applyMove(row.clientKey, parentKey)}
          onClose={() => setActiveEditor(undefined)}
        /> : null;
      })()}
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
            <ActionRow style={{ gap: '0.5rem' }}>
              <Button type="button" disabled={recovering || busy} onClick={() => resolveRecovery('accept')}>Принять серверную конфигурацию</Button>
              {!acceptOnly && <Button type="button" variant="secondary" disabled={recovering || busy} onClick={() => resolveRecovery('keep')}>Оставить черновик с новой ревизией</Button>}
            </ActionRow>
          </>}
      </section>}
      <ActionRow style={{ gap: '0.5rem' }}>
        {!blocked && <Button type="button" disabled={controlsDisabled || Boolean(activeEditor) || invalid || !dirty} onClick={() => void save()}>{busy ? 'Сохранение…' : 'Сохранить группы'}</Button>}
        <Button type="button" variant="secondary" disabled={busy || recovering} onClick={close}>Отмена</Button>
      </ActionRow>
    </> : null}
  </ModalPortal>;
};

export default CatalogGroupsDialog;
