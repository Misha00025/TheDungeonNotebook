import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ActionRow, Badge, Button, IconButton, Input, LinkButton, List, Notification, PageHeader, Select, StatePanel, TabBar, Textarea } from '@tdn/shared';
import type { NotificationKind } from '@tdn/shared';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useOptionalCampaignWorkspace } from './Shell';
import { useVisitHistory } from './VisitHistory';
import { useMutation, useResource } from './hooks';
import { CampaignApiError } from './api';
import type { CharacterMetadata, ChoiceOption, ComputedSheet, FieldReference, JsonValue, Permissions, PresentationEnvelope, Revision, ValueType } from './types';
import { ValueInput, validateFieldValue } from './ValueInput';
import { stringifyJson } from './json';
import { ApiError } from './Feedback';
import styles from './Workspace.module.css';
import CharacterPresentation from './CharacterPresentation';
import characterStyles from './CharacterSheet.module.css';
import { readPages } from './presentationModel';
import InlineValueEditor from './InlineValueEditor';

const importanceLabel: Record<string, string> = { Background: 'Фоновый', Secondary: 'Второстепенный', Key: 'Ключевой' };
type MetadataDraft = { name: string; importance: CharacterMetadata['importance'] };
type FieldFingerprint = { valueType: ValueType; typeRevision: Revision; options: ChoiceOption[]; baselineValue: JsonValue };
type PendingFieldWrite = { value: JsonValue; raw?: string; fingerprint: FieldFingerprint };
type ContentWriter = <T extends { contentRevision: Revision }>(operation: (revision: Revision) => Promise<T>, confirmed: (result: T) => void) => Promise<void>;
const sheetSchemaFingerprint = (value: ComputedSheet) => stringifyJson({ templateContentRevision: value.templateContentRevision, baseFields: value.baseFields.map(field => ({ id: field.id, key: field.key, title: field.title, description: field.description, valueType: field.valueType, typeRevision: field.typeRevision, options: field.options })) });
const fieldFingerprint = (field: ComputedSheet['baseFields'][number]): FieldFingerprint => ({ valueType: field.valueType, typeRevision: field.typeRevision, options: field.options.map(option => ({ optionKey: option.optionKey, title: option.title })), baselineValue: field.effectiveValue });
const sameFingerprint = (left: FieldFingerprint, right: FieldFingerprint) => left.valueType === right.valueType && stringifyJson(left.typeRevision) === stringifyJson(right.typeRevision) && stringifyJson(left.options) === stringifyJson(right.options);

const CharacterSheet: React.FC<{ campaignId: number; characterId: string; pageKey?: string; stats?: boolean }> = ({ campaignId, characterId, pageKey }) => {
  const { api, path, sessionKey, invalidation, notifyInvalidation, navigate } = useWorkspace();
  const campaignWorkspace = useOptionalCampaignWorkspace();
  const { visitCharacter } = useVisitHistory();
  const mode = useLocation().pathname.includes('/gm/') ? 'gm' : 'player';
  const scope = `${sessionKey}:${campaignId}:${characterId}`;
  const metadataResource = useResource<CharacterMetadata>(`${scope}:metadata`, () => api.getCharacter(campaignId, characterId));
  const permissionResource = useResource<Permissions>(`${scope}:character-permissions`, () => api.characterPermissions(campaignId, characterId));
  const sheetResource = useResource<ComputedSheet>(`${scope}:computed-sheet`, () => api.getComputedSheet(campaignId, characterId));
  const presentationResource = useResource<PresentationEnvelope>(`${scope}:presentation`, () => api.getPresentation(campaignId));
  const [metadata, setMetadata] = useState<CharacterMetadata>();
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>();
  const [sheet, setSheet] = useState<ComputedSheet>();
  const sheetRef = useRef(sheet);
  const [presentationRefreshKey, setPresentationRefreshKey] = useState(0);
  const [descriptionDraft, setDescriptionDraft] = useState<string>();
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, JsonValue>>({});
  const [rawDrafts, setRawDrafts] = useState<Record<string, string>>({});
  const [fieldFingerprints, setFieldFingerprints] = useState<Record<string, FieldFingerprint>>({});
  const [validity, setValidity] = useState<Record<string, string | undefined>>({});
  const [serverSheetSnapshot, setServerSheetSnapshot] = useState<ComputedSheet>();
  const [pageRefreshConflict, setPageRefreshConflict] = useState(false);
  const [visibleFieldIds, setVisibleFieldIds] = useState<string[]>([]);
  const [permissionSnapshot, setPermissionSnapshot] = useState<Permissions>();
  const [permissionCheckError, setPermissionCheckError] = useState<unknown>();
  const [permissionDirectVerified, setPermissionDirectVerified] = useState(false);
  const [serverMetadataSnapshot, setServerMetadataSnapshot] = useState<CharacterMetadata>();
  const [presentation, setPresentation] = useState<PresentationEnvelope>();
  const [presentationError, setPresentationError] = useState<unknown>();
  const [resetCounters, setResetCounters] = useState<Record<string, number>>({});
  const descriptionDraftRef = useRef(descriptionDraft);
  descriptionDraftRef.current = descriptionDraft;
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;
  const metadataDraftRef = useRef(metadataDraft);
  metadataDraftRef.current = metadataDraft;
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
  const rawDraftsRef = useRef(rawDrafts);
  const fieldFingerprintsRef = useRef(fieldFingerprints);
  const validityRef = useRef(validity);
  const canWriteRef = useRef(false);
  const blockedRef = useRef(sheetBlocked);
  const processorBusyRef = useRef(false);
  const pendingFieldWritesRef = useRef(new Map<string, PendingFieldWrite>());
  const failedFieldWritesRef = useRef(new Set<string>());
  const runContentRef = useRef<ContentWriter | undefined>(undefined);
  const contentBusyRef = useRef(false);
  const contentRevisionRef = useRef<Revision | undefined>(undefined);
  const metadataBusyRef = useRef(false);
  const snapshotGenerationRef = useRef(0);
  const snapshotBusyRef = useRef(false);
  const lastPermissionRef = useRef<Permissions | undefined>(undefined);
  const initializedRef = useRef(false);
  const recordedCharacter = useRef<string | null>(null);
  const activeRef = useRef(true);
  const refreshBusyRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const refreshAllRef = useRef<(() => void) | undefined>(undefined);
  const updateSheet = (update: (current: ComputedSheet | undefined) => ComputedSheet | undefined) => {
    const next = update(sheetRef.current);
    sheetRef.current = next;
    setSheet(next);
  };
  const stopPendingFields = () => {
    for (const fieldId of pendingFieldWritesRef.current.keys()) failedFieldWritesRef.current.add(fieldId);
    pendingFieldWritesRef.current.clear();
  };
  const hasUnconfirmedDrafts = () => (descriptionDraftRef.current !== undefined && descriptionDraftRef.current !== sheetRef.current?.description) || Object.keys(fieldDraftsRef.current).length > 0 || Object.keys(rawDraftsRef.current).length > 0 || Object.values(validityRef.current).some(Boolean);
  const showWriteStatus = (message: string, kind: NotificationKind = 'success') => { setWriteStatus(message); setWriteStatusKind(kind); setWriteStatusEvent(value => value + 1); };
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  useEffect(() => {
    if (metadataResource.data && !metadataResource.loading && !metadataResource.error) setMetadata(metadataResource.data);
  }, [metadataResource.data, metadataResource.loading, metadataResource.error]);
  useEffect(() => {
    if (!sheetResource.data || sheetResource.loading || sheetResource.error || initializedRef.current) return;
    initializedRef.current = true;
    updateSheet(() => sheetResource.data);
    contentRevisionRef.current = sheetResource.data.contentRevision;
  }, [sheetResource.data, sheetResource.loading, sheetResource.error]);
  useEffect(() => {
    if (permissionResource.loading) { setPermissionDirectVerified(false); return; }
    if (permissionResource.error) {
      setPermissionDirectVerified(false); setPermissionCheckError(permissionResource.error); return;
    }
    if (permissionResource.data) {
      setPermissionSnapshot(permissionResource.data); lastPermissionRef.current = permissionResource.data; setPermissionCheckError(undefined);
      setPermissionDirectVerified(false);
    }
  }, [permissionResource.data, permissionResource.loading, permissionResource.error]);
  useEffect(() => {
    if (!presentationResource.loading && presentationResource.error) setPresentationError(presentationResource.error);
    if (presentationResource.data && !presentationResource.loading && !presentationResource.error) {
      setPresentation(presentationResource.data); setPresentationError(undefined); setPresentationRefreshKey(value => value + 1);
    }
  }, [presentationResource.data, presentationResource.loading, presentationResource.error]);
  useEffect(() => {
    const identity = `${sessionKey}:${campaignId}:${characterId.toLowerCase()}`;
    const permission = permissionSnapshot ?? permissionResource.data;
    if (!metadataResource.data || metadataResource.loading || metadataResource.error || !permission || permissionResource.loading || permissionCheckError || (!permission.canRead && !permission.canWrite) || recordedCharacter.current === identity) return;
    recordedCharacter.current = identity;
    visitCharacter(campaignId, characterId);
  }, [sessionKey, campaignId, characterId, metadataResource.data, metadataResource.loading, metadataResource.error, permissionSnapshot, permissionResource.data, permissionResource.loading, permissionCheckError, visitCharacter]);

  const fieldDirty = Object.keys(fieldDrafts).length > 0 || Object.keys(rawDrafts).length > 0;
  const contentDirty = Boolean(
    (descriptionDraft !== undefined && descriptionDraft !== sheet?.description) || fieldDirty ||
    Object.values(validity).some(Boolean)
  );
  const metadataDirty = Boolean(metadata && metadataDraft && (
    metadata.name !== metadataDraft.name || metadata.importance !== metadataDraft.importance
  ));
  const currentPermissions = permissionSnapshot ?? permissionResource.data;
  const permissionError = permissionCheckError ?? (permissionDirectVerified ? undefined : permissionResource.error);
  const permissionPending = !currentPermissions || permissionResource.loading || snapshotBusy || Boolean(permissionError) || Boolean(snapshotError);
  const canWrite = Boolean(currentPermissions?.canWrite && !permissionPending);
  const readAllowed = Boolean(currentPermissions && !permissionError && !snapshotError && (currentPermissions.canRead || currentPermissions.canWrite));
  const editorAllowed = Boolean(lastPermissionRef.current?.canWrite && !permissionError && !snapshotError);
  const pages = useMemo(() => presentation && !presentationError ? readPages(presentation) : [], [presentation, presentationError]);
  const presentationSheet = useMemo(() => sheet ? {
    ...sheet,
    baseFields: sheet.baseFields.map(field => {
      const fingerprint = fieldFingerprints[field.id];
      return Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) && fingerprint && sameFingerprint(fingerprint, fieldFingerprint(field)) ? { ...field, effectiveValue: fieldDrafts[field.id]! } : field;
    }),
  } : undefined, [sheet, fieldDrafts, fieldFingerprints]);
  const pageBase = path(`/${campaignId}/${mode}/characters/${encodeURIComponent(characterId)}`);
  const routeDirty = contentDirty || metadataDirty;
  const canManageViews = Boolean(campaignWorkspace?.permissions.canWrite && !campaignWorkspace.permissionsLoading);
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
  const updateRawDrafts = (update: (current: Record<string, string>) => Record<string, string>) => {
    const next = update(rawDraftsRef.current); rawDraftsRef.current = next; setRawDrafts(next);
  };
  const updateFingerprints = (update: (current: Record<string, FieldFingerprint>) => Record<string, FieldFingerprint>) => {
    const next = update(fieldFingerprintsRef.current); fieldFingerprintsRef.current = next; setFieldFingerprints(next);
  };
  const captureFingerprint = (field: ComputedSheet['baseFields'][number]) => {
    if (Object.prototype.hasOwnProperty.call(fieldFingerprintsRef.current, field.id)) return;
    updateFingerprints(current => Object.prototype.hasOwnProperty.call(current, field.id) ? current : { ...current, [field.id]: fieldFingerprint(field) });
  };
  useDirtyDraft(`character-sheet-${scope}`, contentDirty || metadataDirty);

  const acceptFreshSheet = (fresh: ComputedSheet) => {
    const currentSheet = sheetRef.current;
    const changed = (contentRevisionRef.current !== undefined && stringifyJson(fresh.contentRevision) !== stringifyJson(contentRevisionRef.current)) || Boolean(currentSheet && sheetSchemaFingerprint(currentSheet) !== sheetSchemaFingerprint(fresh));
    if (changed && hasUnconfirmedDrafts()) {
      setServerSheetSnapshot(fresh); blockedRef.current = true; stopPendingFields(); setSheetBlocked(true);
      return;
    }
    updateSheet(() => fresh); contentRevisionRef.current = fresh.contentRevision; setServerSheetSnapshot(undefined);
    if (!hasUnconfirmedDrafts()) { blockedRef.current = false; setSheetBlocked(false); }
    else if (!changed) { blockedRef.current = false; setSheetBlocked(false); }
  };
  const refreshAll = useCallback(async () => {
    if (!initializedRef.current || !activeRef.current) return;
    if (refreshBusyRef.current || contentBusyRef.current || processorBusyRef.current || metadataBusyRef.current) { refreshQueuedRef.current = true; return; }
    refreshBusyRef.current = true; snapshotBusyRef.current = true; setSnapshotBusy(true); setSnapshotError(undefined); setPermissionCheckError(undefined);
    const generation = ++snapshotGenerationRef.current;
    const results = await Promise.allSettled([
      api.getPresentation(campaignId),
      api.getComputedSheet(campaignId, characterId),
      api.characterPermissions(campaignId, characterId),
      api.getCharacter(campaignId, characterId),
    ]);
    if (activeRef.current && generation === snapshotGenerationRef.current) {
      const [presentationResult, sheetResult, permissionResult, metadataResult] = results;
      if (presentationResult.status === 'fulfilled') { setPresentation(presentationResult.value); setPresentationError(undefined); setPresentationRefreshKey(value => value + 1); }
      else setPresentationError(presentationResult.reason);
      if (sheetResult.status === 'fulfilled') { setSnapshotError(undefined); acceptFreshSheet(sheetResult.value); }
      else setSnapshotError(sheetResult.reason);
      if (permissionResult.status === 'fulfilled') {
        setPermissionSnapshot(permissionResult.value); setPermissionCheckError(undefined); setPermissionDirectVerified(true); lastPermissionRef.current = permissionResult.value;
      } else { setPermissionCheckError(permissionResult.reason); setPermissionDirectVerified(false); }
      if (metadataResult.status === 'fulfilled') {
        const latest = metadataResult.value;
        const current = metadataRef.current;
        const draft = metadataDraftRef.current;
        const dirtyMetadata = Boolean(current && draft && (current.name !== draft.name || current.importance !== draft.importance));
        if (dirtyMetadata && current && stringifyJson(current.metadataRevision) !== stringifyJson(latest.metadataRevision)) { setServerMetadataSnapshot(latest); setMetadataBlocked(true); }
        else if (dirtyMetadata) { setServerMetadataSnapshot(undefined); setMetadataBlocked(false); setMetadataError(undefined); }
        else { setMetadata(latest); setServerMetadataSnapshot(undefined); setMetadataBlocked(false); setMetadataError(undefined); }
      } else setMetadataError(metadataResult.reason);
    }
    refreshBusyRef.current = false; snapshotBusyRef.current = false;
    if (activeRef.current) setSnapshotBusy(false);
    if (refreshQueuedRef.current) { refreshQueuedRef.current = false; refreshAllRef.current?.(); }
  }, [api, campaignId, characterId]);
  refreshAllRef.current = () => { void refreshAll(); };

  const observedInvalidationRef = useRef(invalidation);
  useEffect(() => {
    if (observedInvalidationRef.current === invalidation) return;
    observedInvalidationRef.current = invalidation;
    void refreshAll();
  }, [invalidation, refreshAll]);
  useEffect(() => {
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void refreshAll(); };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => { window.removeEventListener('focus', refreshWhenVisible); document.removeEventListener('visibilitychange', refreshWhenVisible); };
  }, [refreshAll]);

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
        notifyInvalidation();
      }
      return result;
    } catch (error) {
      if (activeRef.current) {
        setMetadataError(error);
        setWriteStatus('');
        setSnapshotError(undefined); setMetadataBlocked(true);
        if (error instanceof CampaignApiError && error.status === 403) { setPermissionCheckError(undefined); notifyInvalidation(); }
      }
      return undefined;
    } finally { metadataBusyRef.current = false; if (refreshQueuedRef.current && activeRef.current) { refreshQueuedRef.current = false; void refreshAll(); } }
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
      notifyInvalidation();
    } catch (error) {
      if (!activeRef.current) return;
      stopPendingFields();
      setWriteError(error);
      setWriteStatus('');
      if (error instanceof CampaignApiError && error.status === 403) { setPermissionCheckError(undefined); notifyInvalidation(); }
      setSnapshotError(undefined); blockedRef.current = true; setSheetBlocked(true);
    } finally {
      contentBusyRef.current = false;
      if (activeRef.current) setContentBusy(false);
      if (refreshQueuedRef.current && activeRef.current && !processorBusyRef.current) { refreshQueuedRef.current = false; void refreshAll(); }
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
        const [fieldId, item] = pendingFieldWritesRef.current.entries().next().value as [string, PendingFieldWrite];
        pendingFieldWritesRef.current.delete(fieldId);
        if (validityRef.current[fieldId]) { failedFieldWritesRef.current.add(fieldId); continue; }
        const currentField = sheetRef.current?.baseFields.find(field => field.id === fieldId);
        if (!currentField) {
          updateValidity(errors => ({ ...errors, [fieldId]: 'Характеристика больше недоступна.' })); failedFieldWritesRef.current.add(fieldId); continue;
        }
        const originalFingerprint = fieldFingerprintsRef.current[fieldId];
        const currentFingerprint = fieldFingerprint(currentField);
        if (!originalFingerprint || !sameFingerprint(originalFingerprint, item.fingerprint) || !sameFingerprint(currentFingerprint, item.fingerprint)) {
          updateValidity(errors => ({ ...errors, [fieldId]: 'Тип характеристики изменился; проверьте или отмените черновик.' })); failedFieldWritesRef.current.add(fieldId); continue;
        }
        const issue = validateFieldValue({ valueType: item.fingerprint.valueType, options: item.fingerprint.options }, item.value, item.raw);
        if (issue) {
          updateValidity(errors => ({ ...errors, [fieldId]: issue })); failedFieldWritesRef.current.add(fieldId); continue;
        }
        if (stringifyJson(item.value) === stringifyJson(currentField.effectiveValue)) {
          const currentDraft = fieldDraftsRef.current[fieldId];
          const currentRaw = rawDraftsRef.current[fieldId];
          if (currentDraft !== undefined && stringifyJson(currentDraft) === stringifyJson(item.value) && currentRaw === item.raw && !validityRef.current[fieldId]) {
            updateDrafts(drafts => { const next = { ...drafts }; delete next[fieldId]; return next; });
            updateRawDrafts(drafts => { const next = { ...drafts }; delete next[fieldId]; return next; });
            updateFingerprints(drafts => { const next = { ...drafts }; delete next[fieldId]; return next; });
            updateValidity(errors => { const next = { ...errors }; delete next[fieldId]; return next; });
            setResetCounters(counters => ({ ...counters, [fieldId]: (counters[fieldId] ?? 0) + 1 }));
          }
          continue;
        }
        let accepted = false;
        await runContentRef.current?.(
          revision => api.putBaseValue(campaignId, characterId, fieldId, { value: item.value, expectedRevision: revision }),
          result => {
            accepted = true;
            updateSheet(current => current ? { ...current, ...result, virtualFields: current.virtualFields, formulaContentRevisions: current.formulaContentRevisions } : current);
            const current = fieldDraftsRef.current[fieldId];
            const currentRaw = rawDraftsRef.current[fieldId];
            const rawMatches = item.raw === undefined ? currentRaw === undefined : currentRaw === item.raw;
            if (current !== undefined && stringifyJson(current) === stringifyJson(item.value) && rawMatches && !validityRef.current[fieldId]) {
              updateDrafts(drafts => { const next = { ...drafts }; delete next[fieldId]; return next; });
              updateRawDrafts(drafts => { const next = { ...drafts }; delete next[fieldId]; return next; });
              updateFingerprints(drafts => { const next = { ...drafts }; delete next[fieldId]; return next; });
              updateValidity(errors => { const next = { ...errors }; delete next[fieldId]; return next; });
              setResetCounters(counters => ({ ...counters, [fieldId]: (counters[fieldId] ?? 0) + 1 }));
              failedFieldWritesRef.current.delete(fieldId);
            }
            showWriteStatus('Поле сохранено.');
          }
        );
        if (!activeRef.current) return;
        if (!accepted) { failedFieldWritesRef.current.add(fieldId); stopPendingFields(); return; }
      }
    } finally {
      processorBusyRef.current = false;
      if (refreshQueuedRef.current && activeRef.current) { refreshQueuedRef.current = false; void refreshAll(); }
    }
  };
  useEffect(() => {
    if (!canWrite || sheetBlocked) stopPendingFields();
  }, [canWrite, sheetBlocked]);

  const saveField = (fieldId: string) => {
    if (!canWriteRef.current || blockedRef.current || contentBusyRef.current || snapshotBusyRef.current) return;
    const currentField = sheetRef.current?.baseFields.find(field => field.id === fieldId);
    if (!currentField) { failedFieldWritesRef.current.add(fieldId); updateValidity(errors => ({ ...errors, [fieldId]: 'Характеристика больше недоступна.' })); return; }
    const fingerprint = fieldFingerprintsRef.current[fieldId];
    if (!fingerprint || !sameFingerprint(fingerprint, fieldFingerprint(currentField))) {
      updateValidity(errors => ({ ...errors, [fieldId]: 'Тип характеристики изменился; проверьте или отмените черновик.' })); return;
    }
    const value = fieldDraftsRef.current[fieldId];
    const raw = rawDraftsRef.current[fieldId];
    if (value === undefined || validityRef.current[fieldId]) return;
    const issue = validateFieldValue({ valueType: fingerprint.valueType, options: fingerprint.options }, value, raw);
    if (issue) { updateValidity(errors => ({ ...errors, [fieldId]: issue })); return; }
    pendingFieldWritesRef.current.set(fieldId, { value, ...(raw === undefined ? {} : { raw }), fingerprint });
    failedFieldWritesRef.current.delete(fieldId);
    setWriteStatus('');
    void drainFieldWrites();
  };

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

  const cancelDescription = () => {
    if (descriptionDraft !== undefined && descriptionDraft !== sheet?.description && !window.confirm('Отменить черновик описания?')) return;
    setDescriptionDraft(undefined);
  };
  const cancelField = (fieldId: string) => {
    if (contentBusyRef.current) return;
    if ((Object.prototype.hasOwnProperty.call(fieldDraftsRef.current, fieldId) || Object.prototype.hasOwnProperty.call(rawDraftsRef.current, fieldId) || Boolean(validityRef.current[fieldId])) && !window.confirm('Отменить черновик поля?')) return;
    pendingFieldWritesRef.current.delete(fieldId);
    failedFieldWritesRef.current.delete(fieldId);
    updateDrafts(current => { const next = { ...current }; delete next[fieldId]; return next; });
    updateRawDrafts(current => { const next = { ...current }; delete next[fieldId]; return next; });
    updateFingerprints(current => { const next = { ...current }; delete next[fieldId]; return next; });
    updateValidity(current => { const next = { ...current }; delete next[fieldId]; return next; });
    setResetCounters(current => ({ ...current, [fieldId]: (current[fieldId] ?? 0) + 1 }));
  };
  const cancelMetadata = () => {
    if (metadataDirty && !window.confirm('Отменить черновик метаданных?')) return;
    setMetadataDraft(undefined);
  };

  const retrySnapshot = () => { if (!snapshotBusyRef.current) void refreshAll(); };

  const renderValue = (reference: FieldReference, label: string, display?: React.ReactNode): React.ReactNode => {
    if (reference.kind !== 'Base' || !editorAllowed || permissionError) return undefined;
    const field = sheetRef.current?.baseFields.find(item => item.id === reference.fieldId);
    if (!field) return <span role="status">Характеристика недоступна.</span>;
    const inlineDisabled = permissionPending || !canWrite || sheetBlocked || snapshotBusy || contentBusy;
    const fingerprint = fieldFingerprints[field.id];
    const fingerprintMismatch = Boolean(fingerprint && !sameFingerprint(fingerprint, fieldFingerprint(field)));
    const hasDraft = Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) || Object.prototype.hasOwnProperty.call(rawDrafts, field.id) || Boolean(validity[field.id]);
    const value = Object.prototype.hasOwnProperty.call(fieldDrafts, field.id) ? fieldDrafts[field.id]! : fingerprintMismatch ? fingerprint!.baselineValue : field.effectiveValue;
    const raw = Object.prototype.hasOwnProperty.call(rawDrafts, field.id) ? rawDrafts[field.id] : undefined;
    const fieldIssue = validity[field.id] ?? (fingerprintMismatch ? 'Тип характеристики изменился; проверьте или отмените черновик.' : undefined);
    const inputFingerprint = fingerprintMismatch ? fingerprint! : fingerprint ?? fieldFingerprint(field);
    const editor = <div className={characterStyles.valueEditor} onKeyDown={event => {
      if (display !== undefined || event.key !== 'Enter' || event.nativeEvent.isComposing || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return;
      event.preventDefault(); saveField(field.id);
    }}>
      <fieldset className={characterStyles.valueField} disabled={permissionPending || !canWrite || sheetBlocked || snapshotBusy || contentBusy}>
        <ValueInput key={`${field.id}:${resetCounters[field.id] ?? 0}`} label={label} compact field={{ valueType: inputFingerprint.valueType, options: inputFingerprint.options }} value={value} controlledNumericDraft={raw} onRawChange={inputFingerprint.valueType === 'Integer' || inputFingerprint.valueType === 'Number' ? next => {
          captureFingerprint(field); updateRawDrafts(current => ({ ...current, [field.id]: next })); setWriteStatus('');
        } : undefined} onChange={next => { captureFingerprint(field); updateDrafts(current => ({ ...current, [field.id]: next })); setWriteStatus(''); }} onValidityChange={error => {
          if (validityRef.current[field.id] === error) return;
          if (!Object.prototype.hasOwnProperty.call(fieldDraftsRef.current, field.id) && !Object.prototype.hasOwnProperty.call(rawDraftsRef.current, field.id)) {
            if (validityRef.current[field.id]) updateValidity(current => { const next = { ...current }; delete next[field.id]; return next; });
            return;
          }
          updateValidity(current => ({ ...current, [field.id]: error }));
          if (error) pendingFieldWritesRef.current.delete(field.id);
        }} />
      </fieldset>
      {fieldIssue && <span role="alert">{fieldIssue}</span>}
      {display === undefined && hasDraft && <ActionRow>
        <Button type="button" disabled={!canWrite || permissionPending || contentBusy || sheetBlocked || snapshotBusy || Boolean(fieldIssue)} onClick={() => saveField(field.id)}>Сохранить значение {label}</Button>
        <Button variant="secondary" type="button" disabled={contentBusy} onClick={() => cancelField(field.id)}>Отменить</Button>
      </ActionRow>}
    </div>;
    if (display !== undefined) return <InlineValueEditor display={display} label={label} disabled={inlineDisabled} issue={fieldIssue} onCommit={() => { if (Object.prototype.hasOwnProperty.call(fieldDraftsRef.current, field.id) || Object.prototype.hasOwnProperty.call(rawDraftsRef.current, field.id)) saveField(field.id); }}>{editor}</InlineValueEditor>;
    return editor;
  };
  const onVisibleFieldsChange = useCallback((next: string[]) => {
    setVisibleFieldIds(current => current.length === next.length && current.every((id, index) => id === next[index]) ? current : next);
  }, []);
  const recoveryFields = useMemo(() => [...new Set([...Object.keys(fieldDrafts), ...Object.keys(rawDrafts), ...Object.keys(validity)])].filter(id => !visibleFieldIds.includes(id) || !editorAllowed), [fieldDrafts, rawDrafts, validity, visibleFieldIds, editorAllowed]);
  const loadServerSheet = () => {
    if (!serverSheetSnapshot || (hasUnconfirmedDrafts() && !window.confirm('Заменить актуальные данные листа серверной версией? Несохранённые значения будут отменены.'))) return;
    updateSheet(() => serverSheetSnapshot); contentRevisionRef.current = serverSheetSnapshot.contentRevision; setServerSheetSnapshot(undefined); blockedRef.current = false; setSheetBlocked(false);
    updateDrafts(() => ({})); updateRawDrafts(() => ({})); updateFingerprints(() => ({})); updateValidity(() => ({})); setDescriptionDraft(undefined); stopPendingFields();
  };
  const useServerSheetAsBase = () => {
    if (!serverSheetSnapshot || !window.confirm('Оставить вводимые значения и принять актуальную ревизию листа как основу? Сохранение останется отдельным явным действием.')) return;
    updateSheet(() => serverSheetSnapshot); contentRevisionRef.current = serverSheetSnapshot.contentRevision; setServerSheetSnapshot(undefined); blockedRef.current = false; setSheetBlocked(false); setWriteError(undefined);
  };
  const loadServerMetadata = () => {
    if (!serverMetadataSnapshot || (metadataDirty && !window.confirm('Заменить несохранённые метаданные серверной версией?'))) return;
    setMetadata(serverMetadataSnapshot); setMetadataDraft(undefined); setServerMetadataSnapshot(undefined); setMetadataBlocked(false); setMetadataError(undefined);
  };
  const useServerMetadataAsBase = () => {
    if (!serverMetadataSnapshot || !window.confirm('Оставить изменения метаданных и принять серверную ревизию как основу?')) return;
    setMetadata(serverMetadataSnapshot); setServerMetadataSnapshot(undefined); setMetadataBlocked(false); setMetadataError(undefined);
  };
  const presentationPending = presentationResource.loading && !presentation;
  const presentationUnavailable = Boolean(presentationError ?? (!presentation && presentationResource.error));
  const pageNavigable = Boolean(presentation && !presentationPending && !presentationUnavailable && readAllowed);
  useEffect(() => {
    if (!pageNavigable) return;
    const first = pages[0];
    if (!pageKey) {
      if (first && (routeDirty || hasUnconfirmedDrafts())) { setPageRefreshConflict(false); return; }
      if (first) navigate(`${pageBase}/${first.key}`, { replace: true });
      return;
    }
    if (pages.some(page => page.key === pageKey)) { setPageRefreshConflict(false); return; }
    if (routeDirty || hasUnconfirmedDrafts()) { setPageRefreshConflict(true); setVisibleFieldIds([]); return; }
    setPageRefreshConflict(false);
    navigate(first ? `${pageBase}/${first.key}` : pageBase, { replace: true });
  }, [pageNavigable, pages, pageKey, routeDirty, navigate, pageBase]);
  useEffect(() => { setVisibleFieldIds([]); }, [pageKey]);
  const goToPage = (key: string) => navigate(`${pageBase}/${key}`);
  const loadedRecovery = recoveryFields.map(fieldId => {
    const field = sheetRef.current?.baseFields.find(item => item.id === fieldId);
    return <article className={characterStyles.recoveryField} key={fieldId}>
      <div><strong>{field?.title ?? 'Характеристика недоступна'}</strong></div>
      {field && editorAllowed ? renderValue({ kind: 'Base', fieldId }, field.title) : <p role="status">{field ? 'Локальный ввод сохранён, но сейчас нет подтверждённого права записи.' : 'Черновик нельзя безопасно записать: исходная характеристика отсутствует.'}</p>}
      {(!field || !editorAllowed) && <Button variant="secondary" type="button" disabled={contentBusy} onClick={() => cancelField(fieldId)}>Отменить черновик</Button>}
    </article>;
  });
  const retryInitialLoad = () => { metadataResource.reload(); permissionResource.reload(); sheetResource.reload(); presentationResource.reload(); };

  if (!metadata || !sheet) {
    return <section className={characterStyles.sheetSection} aria-busy={!metadataResource.error && !sheetResource.error}>
      {(metadataResource.error || sheetResource.error) ? <ApiError error={metadataResource.error ?? sheetResource.error} onRetry={retryInitialLoad} /> : <div className={characterStyles.loadingOverlay}><StatePanel kind="loading">Загрузка листа персонажа…</StatePanel></div>}
    </section>;
  }
  const ensureMetadataDraft = () => setMetadataDraft(current => current ?? { name: metadata.name, importance: metadata.importance });
  const saveMetadata = async () => { if (metadataDraft) await metadataMutation.run(metadataDraft); };
  const metadataControlsDisabled = permissionPending || !canWrite || metadataMutation.busy || metadataBlocked || snapshotBusy;
  const descriptionControlsDisabled = permissionPending || !canWrite || contentBusy || sheetBlocked || snapshotBusy;
  const handleDescriptionEscape = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && !contentBusy) { event.preventDefault(); cancelDescription(); }
  };
  const handleMetadataEscape = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === 'Escape' && !metadataMutation.busy) { event.preventDefault(); cancelMetadata(); }
  };
  const handleMetadataNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    handleMetadataEscape(event);
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (!metadataControlsDisabled && metadataDirty) void saveMetadata(); }
  };
  const openCurrentPage = () => { if (pages[0]) goToPage(pages[0].key); };
  const baseEntryWithDraft = Boolean(!pageKey && pages[0] && (routeDirty || hasUnconfirmedDrafts()));
  const displayedPageKey = pageKey ?? (baseEntryWithDraft ? pages[0]?.key : undefined);
  const visiblePage = Boolean(displayedPageKey && pages.some(page => page.key === displayedPageKey));
  const shellBusy = presentationPending || snapshotBusy || (permissionResource.loading && !permissionSnapshot);
  return <section className={characterStyles.sheetSection} aria-busy={shellBusy}>
    {shellBusy && <div className={characterStyles.loadingOverlay}><StatePanel kind="loading">Обновляем лист персонажа…</StatePanel></div>}
    {!readAllowed ? <div className={characterStyles.accessState}>
      {Boolean(permissionError || snapshotError) ? <><ApiError error={permissionError ?? snapshotError} onRetry={() => void refreshAll()} /><Button variant="secondary" type="button" onClick={() => void refreshAll()}>Проверить доступ и данные</Button></> : <Notification kind="warning" eventKey={`${scope}:permission`}>Доступ к актуальным данным персонажа не подтверждён.</Notification>}
      {Boolean(writeError) && <ApiError error={writeError} onRetry={() => void refreshAll()} />}{Boolean(metadataError) && <ApiError error={metadataError} onRetry={() => void refreshAll()} />}
    </div> : <List layout="vertical" stretch>
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
          <ActionRow><IconButton icon="check" title="Сохранить описание" ariaLabel="Сохранить описание" size="small" variant="secondary" disabled={descriptionDraft === sheet.description || descriptionControlsDisabled} onClick={saveDescription} /><IconButton icon="close" title="Отменить изменения описания" ariaLabel="Отменить изменения описания" size="small" variant="secondary" disabled={contentBusy} onClick={cancelDescription} /></ActionRow>
        </List> : sheet.description || canWrite ? <List layout="vertical" gap="small" stretch className={characterStyles.description}><List layout="horizontal" gap="small">{sheet.description && <span className={characterStyles.descriptionText}>{sheet.description}</span>}{canWrite && <IconButton icon="edit" title="Изменить описание" ariaLabel="Изменить описание" size="small" variant="secondary" disabled={descriptionControlsDisabled} onClick={() => { setDescriptionDraft(sheet.description); setWriteStatus(''); }} />}</List></List> : undefined}
        actions={<ActionRow justify="end">
          {currentPermissions && !currentPermissions.canWrite && <Badge>Только чтение</Badge>}
          {metadataDraft === undefined && canWrite && <IconButton icon="edit" title="Изменить сведения персонажа" ariaLabel="Изменить сведения персонажа" size="small" variant="secondary" disabled={metadataControlsDisabled} onClick={ensureMetadataDraft} />}
          {metadataDraft !== undefined && <><IconButton icon="check" title="Сохранить сведения персонажа" ariaLabel="Сохранить сведения персонажа" size="small" variant="secondary" disabled={!metadataDirty || metadataControlsDisabled} onClick={() => void saveMetadata()} /><IconButton icon="close" title="Отменить изменения сведений персонажа" ariaLabel="Отменить изменения сведений персонажа" size="small" variant="secondary" disabled={metadataMutation.busy} onClick={cancelMetadata} /></>}
          <LinkButton className={styles.desktopOnly} to={path(`/${campaignId}/${mode}/characters`)} variant="secondary">К персонажам</LinkButton>
        </ActionRow>}
      />
      <TabBar basePath={pageBase} aria-label="Страницы персонажа" tabs={pages.map(page => ({ id: page.key, label: page.title, path: page.key }))} />
      {baseEntryWithDraft && pages.length > 0 && <div className={characterStyles.pageConflict}><Notification kind="info" eventKey={`${scope}:base-entry`}>Черновые значения сохранены. Сейчас показана первая доступная страница без смены адреса.</Notification><Button variant="secondary" type="button" onClick={() => goToPage(pages[0].key)}>Открыть страницу «{pages[0].title}»</Button></div>}
      {presentationUnavailable && <ApiError error={presentationError ?? presentationResource.error} onRetry={() => void refreshAll()} />}
      {!presentationUnavailable && pages.length === 0 && <StatePanel kind="empty" title="Страницы кампании">Для кампании ещё не настроены страницы.{canManageViews && <LinkButton to={path(`/${campaignId}/gm/views`)}>Настроить страницы</LinkButton>}</StatePanel>}
      {!presentationUnavailable && pageRefreshConflict && <div className={characterStyles.pageConflict}><Notification kind="warning" eventKey={`${scope}:${pageKey ?? ''}`}>Текущая страница больше не назначена. Неподтверждённые значения сохранены ниже.</Notification>{pages.length > 0 && <Button type="button" onClick={openCurrentPage}>Перейти к доступной странице «{pages[0].title}»</Button>}</div>}
      {serverSheetSnapshot ? <div className={characterStyles.pageConflict}><Notification kind="warning" eventKey={String(serverSheetSnapshot.contentRevision)}>Лист изменился на сервере. Черновые значения сохранены и не отправлены.</Notification><ActionRow><Button type="button" onClick={useServerSheetAsBase}>Использовать актуальную ревизию</Button><Button variant="secondary" type="button" onClick={loadServerSheet}>Загрузить серверную версию</Button></ActionRow></div> : null}
      {serverMetadataSnapshot ? <div className={characterStyles.pageConflict}><Notification kind="warning" eventKey={String(serverMetadataSnapshot.metadataRevision)}>Метаданные персонажа изменились на сервере.</Notification><ActionRow><Button type="button" onClick={useServerMetadataAsBase}>Использовать актуальную ревизию</Button><Button variant="secondary" type="button" onClick={loadServerMetadata}>Загрузить серверную версию</Button></ActionRow></div> : null}
      {(sheetBlocked || metadataBlocked) && !serverSheetSnapshot && !serverMetadataSnapshot && <div className={characterStyles.pageConflict}><Notification kind="warning" eventKey={`${sheetBlocked}:${metadataBlocked}`}>Проверяем результат сохранения. Повторная запись автоматически не выполняется.</Notification><Button variant="secondary" type="button" disabled={snapshotBusy} onClick={retrySnapshot}>Проверить данные и права</Button></div>}
      {Boolean(snapshotError) && <ApiError error={snapshotError} onRetry={retrySnapshot} />}
      {pageNavigable && visiblePage && !pageRefreshConflict && presentationSheet && <CharacterPresentation campaignId={campaignId} characterId={characterId} pageKey={displayedPageKey!} sheet={presentationSheet} refreshKey={presentationRefreshKey} renderValue={editorAllowed ? renderValue : undefined} onVisibleFieldsChange={onVisibleFieldsChange} />}
      {Boolean(writeError) && <ApiError error={writeError} onRetry={() => void refreshAll()} />}{Boolean(metadataError) && <ApiError error={metadataError} onRetry={() => void refreshAll()} />}
      {writeStatus && <Notification kind={writeStatusKind} eventKey={writeStatusEvent}>{writeStatus}</Notification>}
    </List>}
    {loadedRecovery.length > 0 && <section className={characterStyles.recoveryTray} aria-label="Неподтверждённые значения"><h2>Неподтверждённые значения</h2>{loadedRecovery}</section>}
  </section>;
};

export default CharacterSheet;
