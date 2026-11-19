import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ActionRow, Badge, Button, DataTable, IconButton, Input, LinkButton, List, Notification, PageHeader, Panel, Select, StatePanel, TabBar, Textarea } from '@tdn/shared';
import type { NotificationKind } from '@tdn/shared';
import { useWorkspace, useDirtyDraft, useDirtyState } from './Workspace';
import { useVisitHistory } from './VisitHistory';
import { useMutation, useResource } from './hooks';
import { CampaignApiError } from './api';
import type { CharacterMetadata, ComputedSheet, JsonValue, Permissions, Revision } from './types';
import { ValueInput, validateFieldValue } from './ValueInput';
import { displayValue, stringifyJson } from './json';
import { diagnosticMessage } from './displayDiagnostics';
import { ApiError } from './Feedback';
import styles from './Workspace.module.css';
import CharacterPresentation from './CharacterPresentation';
import characterStyles from './CharacterSheet.module.css';

const importanceLabel: Record<string, string> = { Background: 'Фоновый', Secondary: 'Второстепенный', Key: 'Ключевой' };
type MetadataDraft = { name: string; importance: CharacterMetadata['importance'] };
type ContentWriter = <T extends { contentRevision: Revision }>(operation: (revision: Revision) => Promise<T>, confirmed: (result: T) => void) => Promise<void>;

const CharacterSheet: React.FC<{ campaignId: number; characterId: string; stats: boolean }> = ({ campaignId, characterId, stats }) => {
  const { api, path, sessionKey } = useWorkspace();
  const { visitCharacter } = useVisitHistory();
  const anyDraftDirty = useDirtyState();
  const anyDraftDirtyRef = useRef(anyDraftDirty);
  anyDraftDirtyRef.current = anyDraftDirty;
  const mode = useLocation().pathname.includes('/gm/') ? 'gm' : 'player';
  const scope = `${sessionKey}:${campaignId}:${characterId}`;
  const metadataResource = useResource<CharacterMetadata>(`${scope}:metadata`, () => api.getCharacter(campaignId, characterId));
  const permissionResource = useResource<Permissions>(`${scope}:character-permissions`, () => api.characterPermissions(campaignId, characterId));
  const sheetResource = useResource<ComputedSheet>(`${scope}:computed-sheet`, () => api.getComputedSheet(campaignId, characterId));
  const [metadata, setMetadata] = useState<CharacterMetadata>();
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>();
  const [sheet, setSheet] = useState<ComputedSheet>();
  const sheetRef = useRef(sheet);
  const [presentationRefreshKey, setPresentationRefreshKey] = useState(0);
  const [descriptionDraft, setDescriptionDraft] = useState<string>();
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, JsonValue>>({});
  const [validity, setValidity] = useState<Record<string, string | undefined>>({});
  const [resetCounters, setResetCounters] = useState<Record<string, number>>({});
  const [writeError, setWriteError] = useState<unknown>();
  const [metadataError, setMetadataError] = useState<unknown>();
  const [sheetBlocked, setSheetBlocked] = useState(false);
  const [metadataBlocked, setMetadataBlocked] = useState(false);
  const [snapshotError, setSnapshotError] = useState<unknown>();
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [writeStatus, setWriteStatus] = useState('');
  const [writeStatusKind, setWriteStatusKind] = useState<NotificationKind>('success');
  const [writeStatusEvent, setWriteStatusEvent] = useState(0);
  const [contentBusy, setContentBusy] = useState(false);
  const fieldDraftsRef = useRef(fieldDrafts);
  const validityRef = useRef(validity);
  const canWriteRef = useRef(false);
  const blockedRef = useRef(sheetBlocked);
  const processorBusyRef = useRef(false);
  const pendingFieldWritesRef = useRef(new Map<string, JsonValue>());
  const failedFieldWritesRef = useRef(new Set<string>());
  const runContentRef = useRef<ContentWriter | undefined>(undefined);
  const contentBusyRef = useRef(false);
  const contentRevisionRef = useRef<Revision | undefined>(undefined);
  const metadataBusyRef = useRef(false);
  const snapshotGenerationRef = useRef(0);
  const snapshotBusyRef = useRef(false);
  const lastPermissionRef = useRef<Permissions | undefined>(undefined);
  const initializedRef = useRef(false);
  const previousStatsRef = useRef(stats);
  const recordedCharacter = useRef<string | null>(null);
  const activeRef = useRef(true);
  const updateSheet = (update: (current: ComputedSheet | undefined) => ComputedSheet | undefined) => {
    const next = update(sheetRef.current);
    sheetRef.current = next;
    setSheet(next);
  };
  const stopPendingFields = () => {
    for (const fieldId of pendingFieldWritesRef.current.keys()) failedFieldWritesRef.current.add(fieldId);
    pendingFieldWritesRef.current.clear();
  };
  const hasUnconfirmedDrafts = () => anyDraftDirtyRef.current || Object.keys(fieldDraftsRef.current).length > 0 || Object.values(validityRef.current).some(Boolean);
  const showWriteStatus = (message: string, kind: NotificationKind = 'success') => { setWriteStatus(message); setWriteStatusKind(kind); setWriteStatusEvent(value => value + 1); };
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  useEffect(() => {
    if (initializedRef.current || !metadataResource.data || !sheetResource.data) return;
    initializedRef.current = true;
    setMetadata(metadataResource.data);
    updateSheet(() => sheetResource.data);
    contentRevisionRef.current = sheetResource.data.contentRevision;
  }, [metadataResource.data, sheetResource.data]);
  useEffect(() => {
    if (sheetResource.data) setPresentationRefreshKey(value => value + 1);
  }, [sheetResource.data]);
  useEffect(() => {
    const identity = `${sessionKey}:${campaignId}:${characterId.toLowerCase()}`;
    if (!metadataResource.data || metadataResource.loading || metadataResource.error || !permissionResource.data || permissionResource.loading || permissionResource.error || (!permissionResource.data.canRead && !permissionResource.data.canWrite) || recordedCharacter.current === identity) return;
    recordedCharacter.current = identity;
    visitCharacter(campaignId, characterId);
  }, [sessionKey, campaignId, characterId, metadataResource.data, metadataResource.loading, metadataResource.error, permissionResource.data, permissionResource.loading, permissionResource.error, visitCharacter]);
  useEffect(() => {
    const returningToStats = stats && !previousStatsRef.current;
    previousStatsRef.current = stats;
    if (!returningToStats || contentBusyRef.current || snapshotBusyRef.current) return;
    snapshotBusyRef.current = true;
    setSnapshotBusy(true);
    void api.getComputedSheet(campaignId, characterId).then(fresh => {
      if (!activeRef.current) return;
      setPresentationRefreshKey(value => value + 1);
      const revisionChanged = contentRevisionRef.current !== undefined && stringifyJson(fresh.contentRevision) !== stringifyJson(contentRevisionRef.current);
       updateSheet(current => current ? { ...current, ...fresh } : fresh);
        if (revisionChanged && hasUnconfirmedDrafts()) {
         setSnapshotError(undefined);
         blockedRef.current = true;
         stopPendingFields();
         setSheetBlocked(true);
       } else if (!hasUnconfirmedDrafts()) {
        contentRevisionRef.current = fresh.contentRevision;
      }
    }).catch(error => { if (activeRef.current) setSnapshotError(error); }).finally(() => {
      snapshotBusyRef.current = false;
      if (activeRef.current) setSnapshotBusy(false);
    });
  }, [stats, api, campaignId, characterId, anyDraftDirty]);
  if (permissionResource.data && !permissionResource.loading && !permissionResource.error) lastPermissionRef.current = permissionResource.data;

  const fieldDirty = Object.keys(fieldDrafts).length > 0;
  const contentDirty = Boolean(
    (descriptionDraft !== undefined && descriptionDraft !== sheet?.description) || fieldDirty ||
    Object.values(validity).some(Boolean)
  );
  const metadataDirty = Boolean(metadata && metadataDraft && (
    metadata.name !== metadataDraft.name || metadata.importance !== metadataDraft.importance
  ));
  const canWrite = Boolean(permissionResource.data?.canWrite && !permissionResource.loading && !permissionResource.error);
  canWriteRef.current = canWrite;
  blockedRef.current = sheetBlocked;
  const updateDrafts = (update: (current: Record<string, JsonValue>) => Record<string, JsonValue>) => {
    const next = update(fieldDraftsRef.current);
    fieldDraftsRef.current = next;
    setFieldDrafts(next);
  };
  const updateValidity = (update: (current: Record<string, string | undefined>) => Record<string, string | undefined>) => {
    const next = update(validityRef.current);
    validityRef.current = next;
    setValidity(next);
  };
  useDirtyDraft(`character-sheet-${scope}`, contentDirty || metadataDirty);

  const metadataMutation = useMutation(async (draft: MetadataDraft) => {
    if (metadataBusyRef.current || snapshotBusyRef.current || metadataBlocked || !canWrite) return undefined;
    metadataBusyRef.current = true;
    setMetadataError(undefined);
    try {
      const result = await api.putCharacter(campaignId, characterId, {
        ...draft,
        expectedRevision: metadata!.metadataRevision
      });
      if (activeRef.current) {
        setMetadata(result);
        setMetadataDraft(undefined);
        showWriteStatus('Метаданные сохранены.');
      }
      return result;
    } catch (error) {
      if (activeRef.current) {
        setMetadataError(error);
        setWriteStatus('');
        if (error instanceof CampaignApiError && (error.conflict || error.unknownOutcome)) { setSnapshotError(undefined); setMetadataBlocked(true); }
        if (error instanceof CampaignApiError && error.status === 403) permissionResource.reload();
      }
      return undefined;
    } finally { metadataBusyRef.current = false; }
  });

  const runContent = async <T extends { contentRevision: Revision }>(
    operation: (revision: Revision) => Promise<T>,
    confirmed: (result: T) => void
  ) => {
    if (!canWriteRef.current || blockedRef.current || contentBusyRef.current || snapshotBusyRef.current || contentRevisionRef.current === undefined) return;
    contentBusyRef.current = true;
    setContentBusy(true);
    setWriteError(undefined);
    const expectedRevision = contentRevisionRef.current;
    try {
      const result = await operation(expectedRevision);
      if (!activeRef.current) return;
      contentRevisionRef.current = result.contentRevision;
      confirmed(result);
      try {
        const fresh = await api.getComputedSheet(campaignId, characterId);
        if (!activeRef.current) return;
        setPresentationRefreshKey(value => value + 1);
        updateSheet(current => current ? { ...current, ...fresh } : fresh);
        if (stringifyJson(fresh.contentRevision) !== stringifyJson(result.contentRevision) && hasUnconfirmedDrafts()) {
          setSnapshotError(undefined);
          blockedRef.current = true;
          stopPendingFields();
          setSheetBlocked(true);
        } else {
          contentRevisionRef.current = fresh.contentRevision;
        }
      } catch {
        if (activeRef.current) showWriteStatus('Запись подтверждена, вычисления не обновлены', 'warning');
      }
    } catch (error) {
      if (!activeRef.current) return;
      stopPendingFields();
      setWriteError(error);
      setWriteStatus('');
      if (error instanceof CampaignApiError && error.status === 403) permissionResource.reload();
      if (error instanceof CampaignApiError && (error.conflict || error.unknownOutcome)) { setSnapshotError(undefined); blockedRef.current = true; setSheetBlocked(true); }
    } finally {
      contentBusyRef.current = false;
      if (activeRef.current) setContentBusy(false);
    }
  };
  runContentRef.current = runContent;

  const drainFieldWrites = async () => {
    if (processorBusyRef.current) return;
    processorBusyRef.current = true;
    try {
      while (pendingFieldWritesRef.current.size > 0) {
        if (!activeRef.current) return;
        if (!canWriteRef.current) { stopPendingFields(); return; }
        if (blockedRef.current || snapshotBusyRef.current || contentBusyRef.current) return;
        const [fieldId, submitted] = pendingFieldWritesRef.current.entries().next().value as [string, JsonValue];
        pendingFieldWritesRef.current.delete(fieldId);
        if (validityRef.current[fieldId]) { failedFieldWritesRef.current.add(fieldId); continue; }
        const currentField = sheetRef.current?.baseFields.find(field => field.id === fieldId);
        if (!currentField || validateFieldValue({ valueType: currentField.valueType, options: currentField.options }, submitted)) {
          failedFieldWritesRef.current.add(fieldId);
          continue;
        }
        if (stringifyJson(submitted) === stringifyJson(currentField.effectiveValue)) {
          const currentDraft = fieldDraftsRef.current[fieldId];
          if (currentDraft !== undefined && stringifyJson(currentDraft) === stringifyJson(submitted) && !validityRef.current[fieldId]) {
            updateDrafts(drafts => { const next = { ...drafts }; delete next[fieldId]; return next; });
            updateValidity(errors => { const next = { ...errors }; delete next[fieldId]; return next; });
          }
          continue;
        }
        let accepted = false;
        await runContentRef.current?.(
          revision => api.putBaseValue(campaignId, characterId, fieldId, { value: submitted, expectedRevision: revision }),
          result => {
            accepted = true;
            updateSheet(current => current ? { ...current, ...result, virtualFields: current.virtualFields, formulaContentRevisions: current.formulaContentRevisions } : current);
            const current = fieldDraftsRef.current[fieldId];
            if (current !== undefined && stringifyJson(current) === stringifyJson(submitted) && !validityRef.current[fieldId]) {
              updateDrafts(drafts => { const next = { ...drafts }; delete next[fieldId]; return next; });
              updateValidity(errors => { const next = { ...errors }; delete next[fieldId]; return next; });
              failedFieldWritesRef.current.delete(fieldId);
            }
            showWriteStatus('Поле сохранено.');
          }
        );
        if (!activeRef.current) return;
        if (!accepted) { failedFieldWritesRef.current.add(fieldId); stopPendingFields(); return; }
      }
    } finally { processorBusyRef.current = false; }
  };
  useEffect(() => {
    if (!canWrite || sheetBlocked) {
      for (const fieldId of pendingFieldWritesRef.current.keys()) failedFieldWritesRef.current.add(fieldId);
      pendingFieldWritesRef.current.clear();
    }
    else if (!contentBusy && !snapshotBusy) void drainFieldWrites();
  }, [canWrite, sheetBlocked, contentBusy, snapshotBusy]);

  const saveDescription = () => {
    const submitted = descriptionDraft;
    if (submitted === undefined || submitted === sheet?.description) return;
    void runContent(
      revision => api.putDescription(campaignId, characterId, { description: submitted, expectedRevision: revision }),
      result => {
        updateSheet(current => current ? { ...current, description: submitted, contentRevision: result.contentRevision } : current);
        setDescriptionDraft(undefined);
        showWriteStatus('Описание сохранено.');
      }
    );
  };

  const resetField = (fieldId: string) => {
    if (contentBusyRef.current || sheetBlocked || snapshotBusyRef.current || !sheet?.baseFields.some(field => field.id === fieldId && field.isExplicit)) return;
    pendingFieldWritesRef.current.delete(fieldId);
    failedFieldWritesRef.current.delete(fieldId);
    void runContent(
      revision => api.resetBaseValue(campaignId, characterId, fieldId, revision),
      result => {
        updateSheet(current => current ? { ...current, ...result, virtualFields: current.virtualFields, formulaContentRevisions: current.formulaContentRevisions } : current);
        updateDrafts(current => { const next = { ...current }; delete next[fieldId]; return next; });
        updateValidity(current => { const next = { ...current }; delete next[fieldId]; return next; });
        failedFieldWritesRef.current.delete(fieldId);
        setResetCounters(current => ({ ...current, [fieldId]: (current[fieldId] ?? 0) + 1 }));
        showWriteStatus('Значение сброшено.');
      }
    );
  };

  const rereadSheet = async () => {
    if (contentBusyRef.current || metadataBusyRef.current || snapshotBusyRef.current) return;
    snapshotBusyRef.current = true;
    const generation = ++snapshotGenerationRef.current;
    setSnapshotError(undefined);
    setSnapshotBusy(true);
    try {
      const freshSheet = await api.getComputedSheet(campaignId, characterId);
      if (!activeRef.current || generation !== snapshotGenerationRef.current) return;
      setPresentationRefreshKey(value => value + 1);
      updateSheet(() => freshSheet);
      contentRevisionRef.current = freshSheet.contentRevision;
      blockedRef.current = false;
      setSheetBlocked(false);
      setWriteError(undefined);
       showWriteStatus('Актуальные данные загружены. Черновик сохранён; сохранение не повторялось.', 'info');
      permissionResource.reload();
    } catch (error) { if (activeRef.current && generation === snapshotGenerationRef.current) setSnapshotError(error); }
    finally { if (activeRef.current && generation === snapshotGenerationRef.current) { snapshotBusyRef.current = false; setSnapshotBusy(false); } }
  };

  const rereadMetadata = async () => {
    if (contentBusyRef.current || metadataBusyRef.current || snapshotBusyRef.current) return;
    snapshotBusyRef.current = true;
    const generation = ++snapshotGenerationRef.current;
    setSnapshotError(undefined);
    setSnapshotBusy(true);
    try {
      const freshMetadata = await api.getCharacter(campaignId, characterId);
      if (!activeRef.current || generation !== snapshotGenerationRef.current) return;
      setMetadata(freshMetadata);
      setMetadataBlocked(false);
      setMetadataError(undefined);
       showWriteStatus('Актуальные данные загружены. Черновик сохранён; сохранение не повторялось.', 'info');
      permissionResource.reload();
    } catch (error) { if (activeRef.current && generation === snapshotGenerationRef.current) setSnapshotError(error); }
    finally { if (activeRef.current && generation === snapshotGenerationRef.current) { snapshotBusyRef.current = false; setSnapshotBusy(false); } }
  };

  const cancelDescription = () => {
    if (descriptionDraft !== undefined && descriptionDraft !== sheet?.description && !window.confirm('Отменить черновик описания?')) return;
    setDescriptionDraft(undefined);
  };
  const cancelField = (fieldId: string) => {
    if (contentBusyRef.current) return;
    if ((Object.prototype.hasOwnProperty.call(fieldDrafts, fieldId) || Boolean(validity[fieldId])) && !window.confirm('Отменить черновик поля?')) return;
    pendingFieldWritesRef.current.delete(fieldId);
    failedFieldWritesRef.current.delete(fieldId);
    updateDrafts(current => { const next = { ...current }; delete next[fieldId]; return next; });
    updateValidity(current => { const next = { ...current }; delete next[fieldId]; return next; });
    setResetCounters(current => ({ ...current, [fieldId]: (current[fieldId] ?? 0) + 1 }));
  };
  const cancelMetadata = () => {
    if (metadataDirty && !window.confirm('Отменить черновик метаданных?')) return;
    setMetadataDraft(undefined);
  };

  useEffect(() => {
    if (!sheetBlocked && !metadataBlocked) return;
    if (contentBusy || metadataMutation.busy || snapshotBusy || snapshotBusyRef.current || snapshotError) return;
    if (sheetBlocked) void rereadSheet();
    else if (metadataBlocked) void rereadMetadata();
  }, [sheetBlocked, metadataBlocked, contentBusy, metadataMutation.busy, snapshotBusy, snapshotError, rereadSheet, rereadMetadata, api, campaignId, characterId]);

  const retrySnapshot = () => {
    if (sheetBlocked) void rereadSheet();
    else if (metadataBlocked) void rereadMetadata();
  };

  if (!metadata || !sheet) {
    if (metadataResource.error) return <ApiError error={metadataResource.error} onRetry={metadataResource.reload} />;
    if (sheetResource.error) return <ApiError error={sheetResource.error} onRetry={sheetResource.reload} />;
    return <StatePanel kind="loading">Загрузка листа персонажа…</StatePanel>;
  }
  const ensureMetadataDraft = () => setMetadataDraft(current => current ?? { name: metadata.name, importance: metadata.importance });
  const permissionPending = permissionResource.loading || Boolean(permissionResource.error) || !permissionResource.data;
  const editorAllowed = Boolean(lastPermissionRef.current?.canWrite);
  const saveMetadata = async () => { if (metadataDraft) await metadataMutation.run(metadataDraft); };
  const metadataControlsDisabled = permissionPending || !canWrite || metadataMutation.busy || metadataBlocked || snapshotBusy;
  const descriptionControlsDisabled = permissionPending || !canWrite || contentBusy || sheetBlocked || snapshotBusy;
  const handleDescriptionEscape = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && !contentBusy) {
      event.preventDefault();
      cancelDescription();
    }
  };
  const handleMetadataEscape = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === 'Escape' && !metadataMutation.busy) {
      event.preventDefault();
      cancelMetadata();
    }
  };
  const handleMetadataNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    handleMetadataEscape(event);
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!metadataControlsDisabled && metadataDirty) void saveMetadata();
    }
  };
  return <section><List layout="vertical" stretch>
    <PageHeader
      title={metadataDraft
        ? <Input aria-label="Имя" autoFocus value={metadataDraft.name} disabled={metadataControlsDisabled} onChange={event => setMetadataDraft(current => ({ ...(current ?? { name: metadata.name, importance: metadata.importance }), name: event.target.value }))} onKeyDown={handleMetadataNameKeyDown} />
        : metadata.name}
      headingLevel={2}
      titleAside={metadataDraft
        ? <Select aria-label="Важность" value={metadataDraft.importance} disabled={metadataControlsDisabled} onChange={event => setMetadataDraft(current => ({ ...(current ?? { name: metadata.name, importance: metadata.importance }), importance: event.target.value as CharacterMetadata['importance'] }))} onKeyDown={handleMetadataEscape}><option value="Background">Фоновый</option><option value="Secondary">Второстепенный</option><option value="Key">Ключевой</option></Select>
        : <Badge>{importanceLabel[metadata.importance] ?? metadata.importance}</Badge>}
      subtitle={descriptionDraft !== undefined ? <List layout="vertical" gap="small" stretch className={characterStyles.description}>
        <Textarea aria-label="Описание" autoFocus value={descriptionDraft} disabled={descriptionControlsDisabled} onChange={event => { setWriteStatus(''); setDescriptionDraft(event.target.value); }} onKeyDown={handleDescriptionEscape} />
        <ActionRow>
          <IconButton icon="check" title="Сохранить описание" ariaLabel="Сохранить описание" size="small" variant="secondary" disabled={descriptionDraft === sheet.description || descriptionControlsDisabled} onClick={saveDescription} />
          <IconButton icon="close" title="Отменить изменения описания" ariaLabel="Отменить изменения описания" size="small" variant="secondary" disabled={contentBusy} onClick={cancelDescription} />
        </ActionRow>
      </List> : sheet.description || canWrite ? <List layout="vertical" gap="small" stretch className={characterStyles.description}>
        <List layout="horizontal" gap="small">
          {sheet.description && <span className={characterStyles.descriptionText}>{sheet.description}</span>}
          {canWrite && <IconButton icon="edit" title="Изменить описание" ariaLabel="Изменить описание" size="small" variant="secondary" disabled={descriptionControlsDisabled} onClick={() => { setDescriptionDraft(sheet.description); setWriteStatus(''); }} />}
        </List>
      </List> : undefined}
      actions={<ActionRow justify="end">
        {permissionResource.data && !permissionResource.loading && !permissionResource.error && !permissionResource.data.canWrite && <Badge>Только чтение</Badge>}
        {metadataDraft === undefined && canWrite && <IconButton icon="edit" title="Изменить сведения персонажа" ariaLabel="Изменить сведения персонажа" size="small" variant="secondary" disabled={metadataControlsDisabled} onClick={ensureMetadataDraft} />}
        {metadataDraft !== undefined && <>
          <IconButton icon="check" title="Сохранить сведения персонажа" ariaLabel="Сохранить сведения персонажа" size="small" variant="secondary" disabled={!metadataDirty || metadataControlsDisabled} onClick={() => void saveMetadata()} />
          <IconButton icon="close" title="Отменить изменения сведений персонажа" ariaLabel="Отменить изменения сведений персонажа" size="small" variant="secondary" disabled={metadataMutation.busy} onClick={cancelMetadata} />
        </>}
        <LinkButton className={styles.desktopOnly} to={path(`/${campaignId}/${mode}/characters`)} variant="secondary">К персонажам</LinkButton>
      </ActionRow>}
    />
    {permissionResource.loading && <StatePanel kind="loading">Обновление прав персонажа…</StatePanel>}
    {Boolean(permissionResource.error) && <ApiError error={permissionResource.error} onRetry={permissionResource.reload} />}
    <TabBar
      basePath={path(`/${campaignId}/${mode}/characters/${encodeURIComponent(characterId)}`)}
      aria-label="Лист персонажа"
      hideOnMobile
      tabs={[{ id: 'overview', label: 'Обзор', path: 'overview' }, { id: 'stats', label: 'Характеристики', path: 'stats' }]}
    />
    {(sheetBlocked || metadataBlocked) && <Notification kind="warning" eventKey={`${sheetBlocked}:${metadataBlocked}`}>Обновляем данные после изменения на сервере. Черновик сохранён.</Notification>}
    {snapshotBusy && <StatePanel kind="loading">Обновляем актуальные данные…</StatePanel>}
    {Boolean(snapshotError) && <ApiError error={snapshotError} onRetry={sheetBlocked || metadataBlocked ? retrySnapshot : undefined} />}
    {Boolean(writeError) && <ApiError error={writeError} />}
    {Boolean(metadataError) && <ApiError error={metadataError} />}
    {writeStatus && <Notification kind={writeStatusKind} eventKey={writeStatusEvent}>{writeStatus}</Notification>}
    {!stats && <section aria-label="Обзор персонажа"><CharacterPresentation campaignId={campaignId} characterId={characterId} refreshKey={presentationRefreshKey} /></section>}
    {stats && <>
      <Panel title="Базовые характеристики" headingLevel={3}>
        <DataTable aria-label="Базовые характеристики" className={characterStyles.statsTable} minWidth="40rem">
          <thead><tr><th scope="col">Название</th><th scope="col">Значение</th><th scope="col">Источник</th>{editorAllowed && <th scope="col">Действия</th>}</tr></thead>
          <tbody>
          {sheet.baseFields.map(field => {
            const value = Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) ? fieldDrafts[field.id] : field.effectiveValue;
            const hasDraft = Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) || Boolean(validity[field.id]);
            const hasRecovery = Boolean(validity[field.id]) || failedFieldWritesRef.current.has(field.id);
            return <tr key={field.id}><th scope="row"><span>{field.title}</span>{field.description && <div className={characterStyles.fieldDescription}>{field.description}</div>}</th>
              <td><fieldset disabled={permissionPending || !editorAllowed || !canWrite || sheetBlocked || snapshotBusy} className={characterStyles.valueField}>
                <ValueInput key={`${field.id}:${resetCounters[field.id] ?? 0}`} label={field.title} compact disabled={!editorAllowed} field={{ valueType: field.valueType, options: field.options }} value={value} onChange={next => {
                  if (!activeRef.current || !canWriteRef.current || blockedRef.current || snapshotBusyRef.current) return;
                  setWriteStatus('');
                  const baseline = field.effectiveValue;
                  const hadQueued = pendingFieldWritesRef.current.has(field.id);
                  updateDrafts(current => ({ ...current, [field.id]: next }));
                  failedFieldWritesRef.current.delete(field.id);
                  if (validityRef.current[field.id]) return;
                  if (!hadQueued && !contentBusyRef.current && stringifyJson(next) === stringifyJson(baseline)) {
                    updateDrafts(current => { const updated = { ...current }; delete updated[field.id]; return updated; });
                    updateValidity(current => { const updated = { ...current }; delete updated[field.id]; return updated; });
                    return;
                  }
                  pendingFieldWritesRef.current.set(field.id, next);
                  void drainFieldWrites();
                }} onValidityChange={error => {
                  if (validityRef.current[field.id] === error) return;
                  updateValidity(current => ({ ...current, [field.id]: error }));
                  if (error) pendingFieldWritesRef.current.delete(field.id);
                }} />
              </fieldset></td><td>{field.isExplicit ? 'Задано явно' : 'Унаследовано'}</td>
              {editorAllowed && <td><ActionRow>
                {field.isExplicit && <Button variant="secondary" type="button" disabled={contentBusy || sheetBlocked || snapshotBusy || !canWrite} onClick={() => resetField(field.id)}>Сбросить {field.title}</Button>}
                {hasDraft && failedFieldWritesRef.current.has(field.id) && Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) && !validity[field.id] && <Button type="button" disabled={contentBusy || sheetBlocked || snapshotBusy || !canWrite} onClick={() => { failedFieldWritesRef.current.delete(field.id); pendingFieldWritesRef.current.set(field.id, fieldDraftsRef.current[field.id]); void drainFieldWrites(); }}>Повторить {field.title}</Button>}
                {hasDraft && hasRecovery && <Button variant="secondary" type="button" disabled={contentBusy} onClick={() => cancelField(field.id)}>Отбросить изменения {field.title}</Button>}
              </ActionRow></td>}
            </tr>;
          })}
          </tbody>
        </DataTable>
      </Panel>
      <Panel title="Вычисляемые значения" headingLevel={3} aria-label="Виртуальные характеристики">
        <DataTable aria-label="Вычисляемые значения" minWidth="32rem"><thead><tr><th scope="col">Название</th><th scope="col">Значение</th></tr></thead><tbody>
          {sheet.virtualFields.map(field => <tr key={field.id}><th scope="row"><span>{field.title}</span>{field.description && <div className={characterStyles.fieldDescription}>{field.description}</div>}</th><td>{field.diagnostic ? <p role="alert">{diagnosticMessage(field.diagnostic.code)}</p> : displayValue(field.value)}</td></tr>)}
        </tbody></DataTable>
      </Panel>
    </>}
  </List></section>;
};

export default CharacterSheet;
