import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, ModalPortal, StatePanel, useAuth } from '@tdn/shared';
import { compareNumber } from 'lossless-json';
import type { JsonNumber } from './types';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CharacterCatalogEntryEnvelope } from './catalogTypes';
import { useCharacterCatalog } from './CharacterCatalogContext';
import { CampaignApiError } from './api';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { ApiError } from './Feedback';
import CharacterCatalogAttributes from './CharacterCatalogAttributes';
import { CharacterQuantityInput } from './CharacterQuantityInput';
import CatalogDefinitionDialog from './CatalogDefinitionDialog';
import { stringifyJson } from './json';
import { characterQuantityToRaw, supportsCharacterAttributes, validateCharacterQuantity } from './characterCatalogModel';
import { CatalogAttributeReadout } from './CatalogAttributeReadout';
import styles from './CharacterCatalogDialog.module.css';

type QuantityBaseline = { value: JsonNumber | null; revision: CharacterCatalogEntryEnvelope['record']['metadataRevision'] };
type AttributesBaseline = { values: CatalogAttributeOccurrence[]; revision: CharacterCatalogEntryEnvelope['localContentRevision'] };
type Domain = 'quantity' | 'attributes';
type EntrySnapshot = { entry: CharacterCatalogEntryEnvelope; definitions: CatalogAttributeDefinition[] };
type SnapshotReadResult = { ok: true; snapshot: EntrySnapshot } | { ok: false; source: 'entry' | 'schema'; error: unknown };

export type CharacterCatalogEntryDialogProps = {
  entryId: string;
  readOnly?: boolean;
  preview?: boolean;
  characterName?: string;
  audience?: 'gm' | 'player';
  canAdminDefinition?: boolean;
  definitionPermissionsPending?: boolean;
  onDefinitionForbidden?: () => void;
  onClose: () => void;
};

const noop = () => {};

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof CampaignApiError)) return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  if (error.unknownOutcome || error.status === 0) return 'Не удалось подтвердить сохранение. Проверьте актуальные данные перед продолжением.';
  if (error.status === 400 && error.problem.code === 'stack_state_not_supported') return 'Личные характеристики доступны только для навыков и предметов с количеством «Единичный».';
  if (error.status === 400) return 'Сервер не принял количество или характеристики. Проверьте введённые данные.';
  if (error.status === 403) return 'Право записи больше недоступно.';
  if (error.status === 404) return 'Личная запись больше недоступна.';
  if (error.status === 409) return 'Данные изменились на сервере. Проверьте актуальные данные перед продолжением.';
  if (error.status === 503) return 'Сервис временно недоступен.';
  return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
}

function safeReadErrorMessage(error: unknown): string {
  if (!(error instanceof CampaignApiError)) return 'Не удалось загрузить личную запись. Попробуйте ещё раз.';
  if (error.status === 403) return 'Доступ к личной записи больше недоступен.';
  if (error.status === 404) return 'Личная запись удалена или больше недоступна.';
  if (error.status === 503) return 'Содержимое записи или схема временно недоступны.';
  return 'Не удалось загрузить личную запись. Попробуйте ещё раз.';
}

function isRecoverableWriteFailure(error: unknown): boolean {
  return error instanceof CampaignApiError && (error.conflict || error.unknownOutcome || error.status === 0);
}

function sameQuantity(left: JsonNumber | null, right: JsonNumber | null): boolean {
  if (left === null || right === null) return left === right;
  return compareNumber(String(left), String(right)) === 0;
}

const CharacterCatalogEntryDialog: React.FC<CharacterCatalogEntryDialogProps> = ({ entryId, readOnly = false, preview = false, characterName, audience = 'player', canAdminDefinition = false, definitionPermissionsPending = false, onDefinitionForbidden = noop, onClose }) => {
  const { api, sessionKey } = useWorkspace();
  const catalog = useCharacterCatalog();
  const auth = useAuth();
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const recoveryBusyRef = useRef(false);
  const initialReadBusyRef = useRef(false);
  const initialLoadStartedRef = useRef(false);
  const generationRef = useRef(0);
  const canWriteRef = useRef(catalog.canWrite);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  canWriteRef.current = catalog.canWrite;

  const [entry, setEntry] = useState<CharacterCatalogEntryEnvelope>();
  const entryRef = useRef<CharacterCatalogEntryEnvelope | undefined>(undefined);
  const [definitions, setDefinitions] = useState<CatalogAttributeDefinition[]>([]);
  const [quantityBaseline, setQuantityBaseline] = useState<QuantityBaseline>();
  const [attributesBaseline, setAttributesBaseline] = useState<AttributesBaseline>();
  const [quantityRaw, setQuantityRaw] = useState('');
  const [attributesDraft, setAttributesDraft] = useState<CatalogAttributeOccurrence[]>([]);
  const [attributesInvalid, setAttributesInvalid] = useState(false);
  const [attributesEditorGeneration, setAttributesEditorGeneration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<unknown>();
  const [notFound, setNotFound] = useState(false);
  const [missingDraft, setMissingDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [failureDomain, setFailureDomain] = useState<Domain | 'delete'>();
  const [status, setStatus] = useState('');
  const [blockedDomains, setBlockedDomains] = useState<Set<Domain>>(() => new Set());
  const [recoverySnapshots, setRecoverySnapshots] = useState<Partial<Record<Domain, EntrySnapshot>>>({});
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
  const definitionChangedRef = useRef(false);

  const quantityPolicy = useMemo(() => entry ? ({
    kind: entry.definition.kind,
    quantityUnit: entry.definition.quantityUnit,
    allowNegative: entry.definition.allowNegative,
  }) : undefined, [entry]);
  const quantityValidation = quantityPolicy
    ? validateCharacterQuantity(quantityRaw, quantityPolicy)
    : { value: undefined, issue: undefined };
  const supportsLocalAttributes = Boolean(entry && supportsCharacterAttributes(entry.definition));
  const quantityEditable = Boolean(entry && entry.definition.kind === 'Item' && (entry.definition.quantityUnit === 'Whole' || entry.definition.quantityUnit === 'Fractional'));
  const quantityBaselineRaw = characterQuantityToRaw(quantityBaseline?.value);
  const quantityDirty = Boolean(quantityEditable && quantityBaseline && (
    quantityValidation.issue
      ? quantityRaw !== quantityBaselineRaw
      : quantityValidation.value === null
        ? quantityBaseline.value !== null
        : quantityValidation.value !== undefined
          && (quantityBaseline.value === null || !sameQuantity(quantityValidation.value, quantityBaseline.value))
  ));
  const attributesDirty = Boolean(supportsLocalAttributes && attributesBaseline
    && stringifyJson(attributesDraft) !== stringifyJson(attributesBaseline.values));
  const dirty = quantityDirty || attributesDirty;
  const invalid = Boolean(quantityDirty && quantityValidation.issue) || attributesInvalid;
  const writeBlocked = blockedDomains.size > 0 || deleteBlocked;
  const controlsDisabled = busy || recovering || deleting || writeBlocked || readOnly || !catalog.canWrite || catalog.permissionsPending;
  const owner = `character-catalog-entry-${sessionKey}-${catalog.campaignId}-${catalog.kind}-${catalog.characterId}-${entryId}`;
  useDirtyDraft(owner, dirty || invalid || writeBlocked || missingDraft);

  const lockedOccurrenceIds = useMemo(() => {
    const locked = attributesDraft.filter(value => value.editLevel !== 'Character').map(value => value.id);
    for (const value of entry?.effectiveAttributes ?? []) {
      if (value.editLevel === 'Definition') locked.push(value.id);
    }
    return [...new Set(locked)];
  }, [attributesDraft, entry?.effectiveAttributes]);

  const adoptInitialSnapshot = (snapshot: EntrySnapshot) => {
    entryRef.current = snapshot.entry;
    setEntry(snapshot.entry);
    setDefinitions(snapshot.definitions);
    setQuantityBaseline({ value: snapshot.entry.record.quantity, revision: snapshot.entry.record.metadataRevision });
    setAttributesBaseline({ values: snapshot.entry.explicitAttributes, revision: snapshot.entry.localContentRevision });
    setQuantityRaw(characterQuantityToRaw(snapshot.entry.record.quantity));
    setAttributesDraft(snapshot.entry.explicitAttributes);
    setAttributesInvalid(false);
    setAttributesEditorGeneration(value => value + 1);
    catalog.upsert(snapshot.entry);
  };

  const readSnapshot = async (): Promise<SnapshotReadResult> => {
    let currentEntry: CharacterCatalogEntryEnvelope;
    try {
      currentEntry = await api.getCharacterEntry(catalog.campaignId, catalog.kind, catalog.characterId, entryId);
    } catch (error) {
      return { ok: false, source: 'entry', error };
    }
    try {
      const schema = await api.getCatalogAttributes(catalog.campaignId, catalog.kind);
      return { ok: true, snapshot: { entry: currentEntry, definitions: schema.data.definitions } };
    } catch (error) {
      return { ok: false, source: 'schema', error };
    }
  };

  const markMissing = () => {
    setMissingDraft(dirty || invalid || blockedDomains.size > 0);
    catalog.remove(entryId);
    entryRef.current = undefined;
    setEntry(undefined);
    setNotFound(true);
    setBlockedDomains(new Set());
    setRecoverySnapshots({});
    setDeleteBlocked(false);
    setReadError(undefined);
    setFailure(undefined);
    setFailureDomain(undefined);
    setStatus('Личная запись удалена или больше недоступна.');
  };

  const loadInitial = useCallback(async () => {
    if (initialReadBusyRef.current) return;
    initialReadBusyRef.current = true;
    const generation = ++generationRef.current;
    setLoading(true);
    setReadError(undefined);
    setNotFound(false);
    try {
      if (!catalog.canRead) {
        if (!catalog.permissionsPending) setReadError(new CampaignApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'Character access is unavailable.' }));
        return;
      }
      const result = await readSnapshot();
      if (!mountedRef.current || generation !== generationRef.current) return;
      if (!result.ok) {
        if (result.source === 'entry' && (result.error as { status?: number })?.status === 404) {
          markMissing();
        } else {
          if ((result.error as { status?: number })?.status === 403
            || result.source === 'schema' && (result.error as { status?: number })?.status === 404) {
            catalog.reportAccessFailure(result.error);
          }
          setReadError(result.error);
        }
      } else {
        adoptInitialSnapshot(result.snapshot);
        setFailure(undefined);
      }
    } catch (error) {
      if (mountedRef.current && generation === generationRef.current) setReadError(error);
    } finally {
      initialReadBusyRef.current = false;
      if (mountedRef.current && generation === generationRef.current) setLoading(false);
    }
  }, [api, catalog.canRead, catalog.permissionsPending, catalog.campaignId, catalog.characterId, catalog.reportAccessFailure, catalog.upsert, entryId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (entryRef.current || notFound || initialLoadStartedRef.current || catalog.permissionsPending) return;
    initialLoadStartedRef.current = true;
    void loadInitial();
  }, [loadInitial, catalog.permissionsPending, notFound]);

  const acceptEntrySnapshot = (snapshot: EntrySnapshot) => {
    entryRef.current = snapshot.entry;
    setEntry(snapshot.entry);
    setDefinitions(snapshot.definitions);
    setQuantityBaseline({ value: snapshot.entry.record.quantity, revision: snapshot.entry.record.metadataRevision });
    setAttributesBaseline({ values: snapshot.entry.explicitAttributes, revision: snapshot.entry.localContentRevision });
    setQuantityRaw(characterQuantityToRaw(snapshot.entry.record.quantity));
    setAttributesDraft(snapshot.entry.explicitAttributes);
    setAttributesInvalid(false);
    setAttributesEditorGeneration(value => value + 1);
    setNotFound(false);
    setMissingDraft(false);
    catalog.upsert(snapshot.entry);
  };

  const save = async () => {
    if (busyRef.current || recoveryBusyRef.current) return;
    if (!editing || readOnly || !entry || !quantityBaseline || !attributesBaseline || !catalog.canWrite || controlsDisabled || invalid || !dirty) return;
    const quantityWasDirty = quantityDirty;
    const attributesWereDirty = attributesDirty;
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    setFailureDomain(undefined);
    setStatus('');
    let activeDomain: Domain = quantityWasDirty ? 'quantity' : 'attributes';
    let quantityConfirmed = false;
    try {
      if (quantityWasDirty) {
        if (quantityValidation.value === undefined || quantityValidation.value === null) return;
        const updated = await catalog.runWrite(() => api.putCharacterEntryQuantity(
          catalog.campaignId,
          catalog.characterId,
          entryId,
          { expectedRevision: quantityBaseline.revision, quantity: quantityValidation.value as JsonNumber },
        ));
        if (!mountedRef.current) return;
        entryRef.current = updated;
        setEntry(updated);
        setQuantityBaseline({ value: updated.record.quantity, revision: updated.record.metadataRevision });
        setQuantityRaw(characterQuantityToRaw(updated.record.quantity));
        quantityConfirmed = true;
        if (!attributesWereDirty) {
          setAttributesBaseline({ values: updated.explicitAttributes, revision: updated.localContentRevision });
          setAttributesDraft(updated.explicitAttributes);
          setAttributesEditorGeneration(value => value + 1);
        }
        catalog.upsert(updated);
        setStatus('Количество сохранено.');
      }

      if (attributesWereDirty && mountedRef.current) {
        if (!supportsCharacterAttributes(entry.definition)) {
          setStatus(quantityWasDirty
            ? 'Количество сохранено. Личные характеристики недоступны для этого типа предмета; черновик характеристик не отправлен.'
            : 'Личные характеристики недоступны для этого типа предмета; черновик характеристик не отправлен.');
          return;
        }
        if (!canWriteRef.current) {
          setStatus(quantityWasDirty
            ? 'Количество сохранено. Запись характеристик остановлена, так как право доступа изменилось.'
            : 'Запись характеристик остановлена, так как право доступа изменилось.');
          return;
        }
        activeDomain = 'attributes';
        const updated = await catalog.runWrite(() => api.putCharacterEntryAttributes(
          catalog.campaignId,
          catalog.kind,
          catalog.characterId,
          entryId,
          { expectedRevision: attributesBaseline.revision, attributes: attributesDraft },
        ));
        if (!mountedRef.current) return;
        entryRef.current = updated;
        setEntry(updated);
        setAttributesBaseline({ values: updated.explicitAttributes, revision: updated.localContentRevision });
        setAttributesDraft(updated.explicitAttributes);
        setAttributesEditorGeneration(value => value + 1);
        setQuantityBaseline({ value: updated.record.quantity, revision: updated.record.metadataRevision });
        setQuantityRaw(characterQuantityToRaw(updated.record.quantity));
        catalog.upsert(updated);
        setStatus(quantityWasDirty ? 'Изменения сохранены.' : 'Характеристики сохранены.');
      }
      if (mountedRef.current) setEditing(false);
    } catch (error) {
      if (!mountedRef.current) return;
      setFailure(error);
      if (quantityConfirmed) setStatus('Количество сохранено. Характеристики сохранить не удалось; черновик остался.');
      const statusCode = (error as { status?: number })?.status;
      if (statusCode === 403) {
        setFailureDomain(activeDomain);
        catalog.reportAccessFailure(error);
      } else if (statusCode === 404) markMissing();
      else {
        setFailureDomain(activeDomain);
        if (isRecoverableWriteFailure(error)) setBlockedDomains(current => new Set(current).add(activeDomain));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const readRecovery = async (domain: Domain) => {
    if (busyRef.current || recoveryBusyRef.current || recovering) return;
    recoveryBusyRef.current = true;
    setRecovering(true);
    setFailure(undefined);
    setFailureDomain(undefined);
    setRecoverySnapshots(current => {
      const next = { ...current };
      delete next[domain];
      return next;
    });
    try {
      const result = await readSnapshot();
      if (!mountedRef.current) return;
      if (!result.ok) {
        if (result.source === 'entry' && (result.error as { status?: number })?.status === 404) markMissing();
        else {
          if ((result.error as { status?: number })?.status === 403
            || result.source === 'schema' && (result.error as { status?: number })?.status === 404) catalog.reportAccessFailure(result.error);
          setFailure(result.error);
        }
        return;
      }
      setRecoverySnapshots(current => ({ ...current, [domain]: result.snapshot }));
      catalog.upsert(result.snapshot.entry);
    } finally {
      recoveryBusyRef.current = false;
      if (mountedRef.current) setRecovering(false);
    }
  };

  const resolveRecovery = (domain: Domain, action: 'accept' | 'keep') => {
    const snapshot = recoverySnapshots[domain];
    if (!snapshot || !blockedDomains.has(domain)) return;
    if (action === 'accept' && !window.confirm(`Заменить черновик ${domain === 'quantity' ? 'количества' : 'характеристик'} актуальными значениями?`)) return;

    entryRef.current = snapshot.entry;
    setEntry(snapshot.entry);
    setDefinitions(snapshot.definitions);
    if (domain === 'quantity') {
      setQuantityBaseline({ value: snapshot.entry.record.quantity, revision: snapshot.entry.record.metadataRevision });
      if (action === 'accept') setQuantityRaw(characterQuantityToRaw(snapshot.entry.record.quantity));
      if (!attributesDirty && !attributesInvalid) {
        setAttributesBaseline({ values: snapshot.entry.explicitAttributes, revision: snapshot.entry.localContentRevision });
        setAttributesDraft(snapshot.entry.explicitAttributes);
        setAttributesEditorGeneration(value => value + 1);
      }
    } else {
      setAttributesBaseline({ values: snapshot.entry.explicitAttributes, revision: snapshot.entry.localContentRevision });
      if (action === 'accept') {
        setAttributesDraft(snapshot.entry.explicitAttributes);
        setAttributesInvalid(false);
        setAttributesEditorGeneration(value => value + 1);
      }
      if (!quantityDirty) {
        setQuantityBaseline({ value: snapshot.entry.record.quantity, revision: snapshot.entry.record.metadataRevision });
        setQuantityRaw(characterQuantityToRaw(snapshot.entry.record.quantity));
      }
    }
    setBlockedDomains(current => {
      const next = new Set(current);
      next.delete(domain);
      return next;
    });
    setRecoverySnapshots(current => {
      const next = { ...current };
      delete next[domain];
      return next;
    });
    setFailure(undefined);
    setFailureDomain(undefined);
    setMissingDraft(false);
    setStatus(action === 'accept'
      ? `Использованы актуальные значения: ${domain === 'quantity' ? 'количества' : 'характеристик'}.`
      : 'Черновик оставлен. Для сохранения нажмите «Сохранить изменения».');
    catalog.upsert(snapshot.entry);
  };

  const recoverDelete = async () => {
    if (busyRef.current || recoveryBusyRef.current || recovering) return;
    recoveryBusyRef.current = true;
    setRecovering(true);
    setFailure(undefined);
    setFailureDomain(undefined);
    try {
      const result = await readSnapshot();
      if (!mountedRef.current) return;
      if (!result.ok) {
        if (result.source === 'entry' && (result.error as { status?: number })?.status === 404) {
          catalog.remove(entryId);
          entryRef.current = undefined;
          onCloseRef.current();
        }
        else {
          if ((result.error as { status?: number })?.status === 403
            || result.source === 'schema' && (result.error as { status?: number })?.status === 404) catalog.reportAccessFailure(result.error);
          setFailure(result.error);
          setFailureDomain('delete');
        }
        return;
      }
      acceptEntrySnapshot(result.snapshot);
      setDeleteBlocked(false);
      setStatus('Запись не удалена. Проверьте её данные и подтвердите удаление ещё раз.');
    } finally {
      recoveryBusyRef.current = false;
      if (mountedRef.current) setRecovering(false);
    }
  };

  const deleteEntry = async () => {
    if (busyRef.current || recoveryBusyRef.current) return;
    if (readOnly || !entry || !quantityBaseline || !catalog.canWrite || dirty || invalid || controlsDisabled || deleteBlocked) return;
    if (!window.confirm('Удалить личную запись? Предмет или навык в каталоге останется.')) return;
    busyRef.current = true;
    setDeleting(true);
    setFailure(undefined);
    setFailureDomain(undefined);
    try {
      await catalog.runWrite(() => api.deleteCharacterEntry(
        catalog.campaignId,
        catalog.kind,
        catalog.characterId,
        entryId,
        quantityBaseline.revision,
      ));
      if (!mountedRef.current) return;
      catalog.remove(entryId);
      entryRef.current = undefined;
      onCloseRef.current();
    } catch (error) {
      if (!mountedRef.current) return;
      const statusCode = (error as { status?: number })?.status;
      if (statusCode === 403) {
        catalog.reportAccessFailure(error);
        setFailure(error);
        setFailureDomain('delete');
      } else if (statusCode === 404) {
        markMissing();
      } else {
        setFailure(error);
        setFailureDomain('delete');
        if (isRecoverableWriteFailure(error)) setDeleteBlocked(true);
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setDeleting(false);
    }
  };

  const handleClose = () => {
    if (busyRef.current || recoveryBusyRef.current || recovering || deleting || definitionDialogOpen) return;
    if ((dirty || invalid || blockedDomains.size > 0 || deleteBlocked || missingDraft)
      && !window.confirm('Есть несохранённые изменения или незавершённое восстановление. Закрыть и потерять их?')) return;
    onCloseRef.current();
  };

  const cancelEditing = () => {
    if (busyRef.current || recoveryBusyRef.current || recovering || deleting || writeBlocked) return;
    if ((dirty || invalid) && !window.confirm('Отменить несохранённые изменения?')) return;
    if (quantityBaseline) setQuantityRaw(characterQuantityToRaw(quantityBaseline.value));
    if (attributesBaseline) setAttributesDraft(attributesBaseline.values);
    setAttributesInvalid(false);
    setAttributesEditorGeneration(value => value + 1);
    setFailure(undefined);
    setFailureDomain(undefined);
    setStatus('');
    setEditing(false);
  };

  const definition = entry?.definition;
  const userId = Number(auth.userId);
  const isDefinitionOwner = Boolean(definition && definition.creatorUserId !== null && definition.creatorUserId === userId);
  const canEditDefinition = !definitionPermissionsPending && (canAdminDefinition || isDefinitionOwner);
  const canOpenDefinition = Boolean(!preview && catalog.canRead && !loading && !readError && !notFound && entry && !editing && canEditDefinition && !dirty && !invalid && !busy && !recovering && !deleting
    && blockedDomains.size === 0 && !deleteBlocked && !missingDraft);
  const subtitle = definition
    ? `${definition.kind === 'Item' ? 'Предмет' : 'Навык'}${characterName ? ` · У персонажа «${characterName}»` : ''}`
    : undefined;

  const footer = <div className={styles.footer}>
    <div className={styles.footerLeft}>
      {!loading && !readError && !notFound && entry && !editing && catalog.canWrite && !readOnly && <Button type="button" variant="secondary" disabled={controlsDisabled || dirty || invalid || blockedDomains.size > 0 || deleteBlocked} onClick={() => void deleteEntry()}>Убрать у персонажа</Button>}
      {canOpenDefinition && <Button type="button" variant="secondary" onClick={() => { definitionChangedRef.current = false; setDefinitionDialogOpen(true); }}>{audience === 'gm' ? `Изменить ${definition?.kind === 'Skill' ? 'навык' : 'предмет'} в каталоге` : `Изменить мой ${definition?.kind === 'Skill' ? 'навык' : 'предмет'}`}</Button>}
    </div>
    <ActionRow className={styles.footerActions} justify="end">
      {!loading && !readError && !notFound && entry && editing
        ? <>
          <Button type="button" variant="secondary" disabled={busy || recovering || deleting || writeBlocked} onClick={cancelEditing}>Отменить изменения</Button>
          {catalog.canWrite && !readOnly && <Button type="button" disabled={controlsDisabled || invalid || !dirty} onClick={() => void save()}>{busy ? 'Сохранение…' : 'Сохранить изменения'}</Button>}
        </>
        : <>
          <Button type="button" variant="secondary" disabled={busy || recovering || deleting} onClick={handleClose}>Закрыть</Button>
          {!loading && !readError && !notFound && entry && catalog.canWrite && !catalog.permissionsPending && !readOnly && <Button type="button" onClick={() => setEditing(true)}>Изменить</Button>}
        </>}
    </ActionRow>
  </div>;

  const header = catalog.canRead && !notFound ? definition?.name ?? 'Личная запись' : 'Личная запись';
  const visible = catalog.canRead && !notFound;

  return <ModalPortal isOpen onClose={handleClose} title={header} subtitle={subtitle} footer={footer} size="wide" dismissDisabled={busy || recovering || deleting || definitionDialogOpen}>
    {loading && <StatePanel kind="loading">Загрузка личной записи…</StatePanel>}
    {!loading && Boolean(readError) && <>
      <ApiError error={readError} />
      <p role="alert">{safeReadErrorMessage(readError)}</p>
      <Button type="button" disabled={loading} onClick={() => void loadInitial()}>Повторить чтение</Button>
    </>}
    {!loading && notFound && <>
      <p role="status">Личная запись удалена или больше недоступна. Остальные записи персонажа не затронуты.</p>
      {missingDraft && <p role="alert">Черновик относится к отсутствующей записи и не может быть сохранён.</p>}
    </>}
    {!loading && !readError && !notFound && entry && visible ? <>
      <div className={styles.content}>
        <p className={styles.description}>{entry.definitionDescription || 'Описание отсутствует.'}</p>
        {entry.definition.kind === 'Item' && <section className={styles.section}>
          <CharacterQuantityInput
            metadata={entry.definition}
            raw={quantityRaw}
            onRawChange={setQuantityRaw}
            required
            readOnly={!editing || !quantityEditable || readOnly || !catalog.canWrite}
            disabled={editing && controlsDisabled}
            serverError={failureDomain === 'quantity' ? failure : undefined}
          />
        </section>}
        <section className={styles.section}>
          <h3>Характеристики</h3>
          {supportsLocalAttributes ? <CharacterCatalogAttributes
            key={attributesEditorGeneration}
            definitions={definitions}
            sourceValues={entry.effectiveAttributes}
            values={editing ? attributesDraft : entry.explicitAttributes}
            savedValues={editing ? attributesBaseline?.values ?? [] : entry.explicitAttributes}
            effectiveValues={entry.effectiveAttributes}
            lockedOccurrenceIds={lockedOccurrenceIds}
            readOnly={!editing || readOnly || !catalog.canWrite}
            disabled={editing && controlsDisabled}
            onChange={setAttributesDraft}
            onValidityChange={setAttributesInvalid}
          /> : <CatalogAttributeReadout definitions={definitions} values={entry.effectiveAttributes} />}
        </section>
      </div>

      {Boolean(failure) && <>
        <ApiError error={failure} />
        <p role="alert">{safeErrorMessage(failure)}</p>
      </>}
      {status && <p role="status">{status}</p>}

      {blockedDomains.size > 0 && !readOnly && <section>
        <h3>Восстановление записи</h3>
        {[...blockedDomains].map(domain => {
          const snapshot = recoverySnapshots[domain];
          return <div key={domain}>
            <p>{domain === 'quantity' ? 'Количество' : 'Характеристики'} не сохранены. Проверьте актуальные данные перед продолжением.</p>
            {!snapshot
              ? <Button type="button" disabled={recovering || busy || !catalog.canRead} onClick={() => void readRecovery(domain)}>Проверить актуальные данные</Button>
              : <>
                <p>Выберите, использовать актуальные значения или оставить свой черновик.</p>
                <Button type="button" disabled={recovering || busy} onClick={() => resolveRecovery(domain, 'accept')}>Использовать актуальные значения</Button>
                <Button type="button" variant="secondary" disabled={recovering || busy} onClick={() => resolveRecovery(domain, 'keep')}>Оставить мой черновик</Button>
              </>}
          </div>;
        })}
      </section>}

      {deleteBlocked && !readOnly && <section>
        <h3>Проверка удаления</h3>
        <p>Удаление не будет повторено автоматически. Перечитайте запись; если она существует, удаление потребует нового явного подтверждения.</p>
        <Button type="button" disabled={recovering || busy || !catalog.canRead} onClick={() => void recoverDelete()}>Проверить запись</Button>
      </section>}

    </> : null}
    {!loading && !readError && !notFound && !entry && !catalog.canRead && <StatePanel kind="error">Доступ к личной записи недоступен.</StatePanel>}
    {definitionDialogOpen && definition && <CatalogDefinitionDialog
      campaignId={catalog.campaignId}
      entryId={definition.id}
      initialMode="edit"
      initialKind={definition.kind}
      canAdmin={canAdminDefinition}
      audience={audience}
      permissionsPending={definitionPermissionsPending}
      onSaved={() => { definitionChangedRef.current = true; }}
      onForbidden={onDefinitionForbidden}
      onClose={() => {
        setDefinitionDialogOpen(false);
        if (definitionChangedRef.current) {
          definitionChangedRef.current = false;
          void loadInitial();
        }
      }}
    />}
  </ModalPortal>;
};

export default CharacterCatalogEntryDialog;
