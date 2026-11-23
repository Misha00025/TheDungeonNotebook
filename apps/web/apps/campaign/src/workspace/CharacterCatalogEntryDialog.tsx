import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, DataTable, ModalPortal, StatePanel } from '@tdn/shared';
import { compareNumber } from 'lossless-json';
import type { JsonNumber } from './types';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogDiagnostic, CharacterCatalogEntryEnvelope } from './catalogTypes';
import { useCharacterCatalog } from './CharacterCatalogContext';
import { CampaignApiError } from './api';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { ApiError } from './Feedback';
import { CatalogAttributeValuesEditor } from './CatalogAttributeValuesEditor';
import { CharacterQuantityInput } from './CharacterQuantityInput';
import { catalogValueLabel, catalogValueType } from './catalogModel';
import { stringifyJson } from './json';
import { validateFieldValue } from './ValueInput';
import { validateCharacterQuantity, characterQuantityToRaw } from './characterCatalogModel';

type QuantityBaseline = { value: JsonNumber | null; revision: CharacterCatalogEntryEnvelope['record']['metadataRevision'] };
type AttributesBaseline = { values: CatalogAttributeOccurrence[]; revision: CharacterCatalogEntryEnvelope['localContentRevision'] };
type Domain = 'quantity' | 'attributes';
type EntrySnapshot = { entry: CharacterCatalogEntryEnvelope; definitions: CatalogAttributeDefinition[] };
type SnapshotReadResult = { ok: true; snapshot: EntrySnapshot } | { ok: false; source: 'entry' | 'schema'; error: unknown };

export type CharacterCatalogEntryDialogProps = {
  entryId: string;
  readOnly?: boolean;
  onClose: () => void;
};

const diagnosticLabels: Record<string, string> = {
  unknown_attribute: 'Атрибут отсутствует в текущей схеме.',
  incompatible_attribute_type: 'Тип или версия атрибута устарели.',
  invalid_attribute_value: 'Значение не соответствует текущей схеме.',
  attribute_binding_changed: 'Связь собственного значения с атрибутом изменилась; значение не применяется.',
  edit_level_changed: 'Уровень редактирования значения изменился; значение не применяется.',
};

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof CampaignApiError)) return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  if (error.unknownOutcome || error.status === 0) return 'Результат записи неизвестен. Перечитайте запись перед продолжением.';
  if (error.status === 400) return 'Сервер не принял количество или собственные атрибуты. Проверьте введённые данные.';
  if (error.status === 403) return 'Право записи больше недоступно.';
  if (error.status === 404) return 'Личная запись больше недоступна.';
  if (error.status === 409) return 'Данные записи изменились на сервере. Перечитайте актуальную версию.';
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

function isBindingDiagnostic(diagnostic: CatalogDiagnostic): boolean {
  return diagnostic.code === 'attribute_binding_changed' || diagnostic.code === 'edit_level_changed';
}

const CharacterCatalogEntryDialog: React.FC<CharacterCatalogEntryDialogProps> = ({ entryId, readOnly = false, onClose }) => {
  const { api, sessionKey } = useWorkspace();
  const catalog = useCharacterCatalog();
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

  const quantityPolicy = useMemo(() => entry ? ({
    kind: entry.definition.kind,
    quantityUnit: entry.definition.quantityUnit,
    allowNegative: entry.definition.allowNegative,
  }) : undefined, [entry]);
  const quantityValidation = quantityPolicy
    ? validateCharacterQuantity(quantityRaw, quantityPolicy)
    : { value: undefined, issue: undefined };
  const quantityEditable = Boolean(entry && entry.definition.kind === 'Item' && entry.definition.quantityUnit !== 'Single');
  const quantityBaselineRaw = characterQuantityToRaw(quantityBaseline?.value);
  const quantityDirty = Boolean(quantityEditable && quantityBaseline && (
    quantityValidation.issue
      ? quantityRaw !== quantityBaselineRaw
      : quantityValidation.value === null
        ? quantityBaseline.value !== null
        : quantityValidation.value !== undefined
          && (quantityBaseline.value === null || !sameQuantity(quantityValidation.value, quantityBaseline.value))
  ));
  const attributesDirty = Boolean(attributesBaseline
    && stringifyJson(attributesDraft) !== stringifyJson(attributesBaseline.values));
  const dirty = quantityDirty || attributesDirty;
  const invalid = Boolean(quantityDirty && quantityValidation.issue) || attributesInvalid;
  const writeBlocked = blockedDomains.size > 0 || deleteBlocked;
  const controlsDisabled = busy || recovering || deleting || writeBlocked || readOnly || !catalog.canWrite;
  const owner = `character-catalog-entry-${sessionKey}-${catalog.campaignId}-${catalog.characterId}-${entryId}`;
  useDirtyDraft(owner, dirty || invalid || writeBlocked || missingDraft);

  const definitionById = useMemo(() => new Map(definitions.map(definition => [definition.id, definition])), [definitions]);
  const serverExplicitById = useMemo(() => new Map((entry?.explicitAttributes ?? []).map(value => [value.id, value])), [entry?.explicitAttributes]);
  const bindingDiagnosticIds = useMemo(() => new Set((entry?.diagnostics ?? []).filter(isBindingDiagnostic).map(value => value.occurrenceId)), [entry?.diagnostics]);
  const immutableBindingIds = useMemo(() => (entry?.effectiveAttributes ?? []).map(value => value.id), [entry?.effectiveAttributes]);
  const lockedOccurrenceIds = useMemo(() => {
    const locked = attributesDraft.filter(value => value.editLevel !== 'Character').map(value => value.id);
    for (const diagnostic of entry?.diagnostics ?? []) {
      if (isBindingDiagnostic(diagnostic)) locked.push(diagnostic.occurrenceId);
    }
    for (const value of entry?.effectiveAttributes ?? []) {
      if (value.editLevel === 'Definition') locked.push(value.id);
    }
    return [...new Set(locked)];
  }, [attributesDraft, entry?.diagnostics, entry?.effectiveAttributes]);

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
      currentEntry = await api.getCharacterEntry(catalog.campaignId, catalog.characterId, entryId);
    } catch (error) {
      return { ok: false, source: 'entry', error };
    }
    try {
      const schema = await api.getCatalogAttributes(catalog.campaignId);
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

  const close = () => {
    if (busyRef.current || recoveryBusyRef.current || deleting) return;
    if ((dirty || invalid || writeBlocked) && !window.confirm('Есть несохранённые изменения. Закрыть и потерять их?')) return;
    onCloseRef.current();
  };

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
    if (readOnly || !entry || !quantityBaseline || !attributesBaseline || !catalog.canWrite || controlsDisabled || invalid || !dirty) return;
    const quantityWasDirty = quantityDirty;
    const attributesWereDirty = attributesDirty;
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    setFailureDomain(undefined);
    setStatus('');
    let activeDomain: Domain = quantityWasDirty ? 'quantity' : 'attributes';
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
        if (!attributesWereDirty) {
          setAttributesBaseline({ values: updated.explicitAttributes, revision: updated.localContentRevision });
          setAttributesDraft(updated.explicitAttributes);
          setAttributesEditorGeneration(value => value + 1);
        }
        catalog.upsert(updated);
        setStatus('Количество подтверждённо сохранено.');
      }

      if (attributesWereDirty && mountedRef.current) {
        if (!canWriteRef.current) {
          setStatus(quantityWasDirty
            ? 'Количество подтверждённо сохранено. Запись атрибутов остановлена, так как право доступа изменилось.'
            : 'Запись атрибутов остановлена, так как право доступа изменилось.');
          return;
        }
        activeDomain = 'attributes';
        const updated = await catalog.runWrite(() => api.putCharacterEntryAttributes(
          catalog.campaignId,
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
        setStatus(quantityWasDirty
          ? 'Количество и собственные атрибуты подтверждённо сохранены.'
          : 'Собственные атрибуты подтверждённо сохранены.');
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setFailure(error);
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
    if (action === 'accept' && !window.confirm(`Заменить черновик ${domain === 'quantity' ? 'количества' : 'собственных атрибутов'} серверной версией?`)) return;

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
      ? `Принята серверная версия: ${domain === 'quantity' ? 'количества' : 'собственных атрибутов'}.`
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

  const definition = entry?.definition;
  const sourceExplicitIds = new Set((entry?.explicitAttributes ?? []).map(value => value.id));
  const currentExplicitIds = new Set(attributesDraft.map(value => value.id));
  const resetPending = Boolean(attributesBaseline?.values.some(value => !currentExplicitIds.has(value.id)));
  const overrideableSources = (entry?.effectiveAttributes ?? []).filter(value => {
    if (sourceExplicitIds.has(value.id) || currentExplicitIds.has(value.id) || value.editLevel !== 'Character') return false;
    const attribute = definitions.find(candidate => candidate.id === value.attributeId);
    const valueType = attribute ? catalogValueType(attribute.typeKey) : undefined;
    if (!attribute || !attribute.isActive || !valueType || bindingDiagnosticIds.has(value.id)) return false;
    if (attribute.typeKey !== value.typeKey || String(attribute.typeRevision) !== String(value.typeRevision)) return false;
    return validateFieldValue({ valueType, options: attribute.options }, value.value) === undefined;
  });
  const effectiveRows = (entry?.effectiveAttributes ?? []).map(value => {
    const explicit = serverExplicitById.get(value.id);
    const appliesLocally = Boolean(explicit
      && explicit.editLevel === 'Character'
      && explicit.attributeId === value.attributeId
      && !bindingDiagnosticIds.has(value.id));
    return { value, label: appliesLocally ? 'Собственное значение' : 'Из каталога' };
  });

  const handleClose = () => {
    if (busyRef.current || recoveryBusyRef.current || recovering || deleting) return;
    if ((dirty || invalid || blockedDomains.size > 0 || deleteBlocked || missingDraft)
      && !window.confirm('Есть несохранённые изменения или незавершённое восстановление. Закрыть и потерять их?')) return;
    onCloseRef.current();
  };

  const header = catalog.canRead && !notFound ? definition?.name ?? 'Личная запись' : 'Личная запись';
  const visible = catalog.canRead && !notFound;

  return <ModalPortal isOpen onClose={handleClose} title={header} size="wide" dismissDisabled={busy || recovering || deleting}>
    {loading && <StatePanel kind="loading">Загрузка личной записи…</StatePanel>}
    {!loading && Boolean(readError) && <>
      <ApiError error={readError} />
      <p role="alert">{safeReadErrorMessage(readError)}</p>
      <Button type="button" disabled={loading} onClick={() => void loadInitial()}>Повторить чтение</Button>
    </>}
    {!loading && notFound && <>
      <p role="status">Личная запись удалена или больше недоступна. Остальные записи персонажа не затронуты.</p>
      {missingDraft && <p role="alert">Черновик относится к отсутствующей записи и не может быть сохранён.</p>}
      <Button type="button" variant="secondary" onClick={handleClose}>Закрыть</Button>
    </>}
    {!loading && !readError && !notFound && entry && visible ? <>
      {catalog.permissionsPending && <p role="status">Проверка прав. Изменения пока отключены.</p>}
      {(readOnly || !catalog.canWrite) && <p role="status">Доступен просмотр записи; редактирование отключено.</p>}
      <section>
        <h3>{entry.definition.name}</h3>
        <p>{entry.definition.kind === 'Item' ? 'Предмет' : 'Навык'}</p>
        <p>{entry.definitionDescription || 'Описание отсутствует.'}</p>
      </section>

      {entry.definition.kind === 'Item' && <CharacterQuantityInput
        metadata={entry.definition}
        raw={quantityRaw}
        onRawChange={setQuantityRaw}
        required
        readOnly={readOnly || !catalog.canWrite}
        disabled={controlsDisabled}
        serverError={failureDomain === 'quantity' ? failure : undefined}
      />}

      <section>
        <h3>Текущие значения</h3>
        <p>Показаны подтверждённые значения; черновик собственных атрибутов — ниже.</p>
        {effectiveRows.length === 0
          ? <p>Атрибутов пока нет.</p>
          : <DataTable aria-label="Текущие значения" minWidth="24rem">
            <thead><tr><th scope="col">Атрибут</th><th scope="col">Значение</th><th scope="col">Источник</th></tr></thead>
            <tbody>{effectiveRows.map(({ value, label }) => {
              const attribute = definitions.find(candidate => candidate.id === value.attributeId);
              return <tr key={value.id}>
                <th scope="row">{attribute?.title ?? 'Неизвестный атрибут'}</th>
                <td>{catalogValueLabel(value.value, attribute)}</td>
                <td>{label}</td>
              </tr>;
            })}</tbody>
          </DataTable>}
      </section>
      {catalog.canWrite && !readOnly && overrideableSources.length > 0 && <section>
        <h3>Собственные переопределения</h3>
        {overrideableSources.map(value => {
          const attribute = definitions.find(candidate => candidate.id === value.attributeId);
          return <Button
            key={value.id}
            type="button"
            variant="secondary"
            disabled={controlsDisabled}
            onClick={() => setAttributesDraft(current => current.some(row => row.id === value.id) ? current : [...current, {
              ...value,
              editLevel: 'Character',
            }])}
          >Задать собственное значение: {attribute?.title ?? 'атрибут'}</Button>;
        })}
      </section>}

      <section>
        <h3>Собственные атрибуты</h3>
        <CatalogAttributeValuesEditor
          key={attributesEditorGeneration}
          definitions={definitions}
          values={attributesDraft}
          onChange={setAttributesDraft}
          onValidityChange={setAttributesInvalid}
          mode="character"
          readOnly={readOnly || !catalog.canWrite}
          disabled={controlsDisabled}
          diagnostics={entry.diagnostics}
          immutableBindingIds={immutableBindingIds}
          lockedOccurrenceIds={lockedOccurrenceIds}
        />
        {resetPending && <p role="status">После подтверждения будет показано актуальное значение из каталога, если источник существует; старое значение заранее не подставляется.</p>}
      </section>

      {entry.diagnostics.length > 0 && <section>
        <h3>Диагностика</h3>
        <ul>{entry.diagnostics.map((diagnostic, index) => {
          const occurrence = [...entry.effectiveAttributes, ...entry.explicitAttributes].find(value => value.id === diagnostic.occurrenceId);
          const attribute = occurrence ? definitions.find(value => value.id === occurrence.attributeId) : undefined;
          return <li key={`${diagnostic.occurrenceId}-${diagnostic.code}-${index}`}>
            {diagnosticLabels[diagnostic.code] ?? 'Сервер обнаружил проблему в атрибуте.'}
            {attribute ? ` Атрибут: ${attribute.title}.` : ''}
          </li>;
        })}</ul>
      </section>}

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
            <p>{domain === 'quantity' ? 'Количество' : 'Собственные атрибуты'} не сохранены. Перечитайте запись перед продолжением.</p>
            {!snapshot
              ? <Button type="button" disabled={recovering || busy || !catalog.canRead} onClick={() => void readRecovery(domain)}>Перечитать серверные данные</Button>
              : <>
                <p>Выберите, принять прочитанное значение или сохранить свой черновик для следующей явной записи.</p>
                <Button type="button" disabled={recovering || busy} onClick={() => resolveRecovery(domain, 'accept')}>Принять серверную версию</Button>
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

      {catalog.canWrite && !readOnly && <div>
        <Button type="button" disabled={controlsDisabled || invalid || blockedDomains.size > 0 || deleteBlocked || !dirty} onClick={() => void save()}>
          {busy ? 'Сохранение…' : 'Сохранить изменения'}
        </Button>
        <Button type="button" variant="secondary" disabled={controlsDisabled || dirty || invalid || blockedDomains.size > 0 || deleteBlocked} onClick={() => void deleteEntry()}>
          Удалить личную запись
        </Button>
      </div>}
      <Button type="button" variant="secondary" disabled={busy || recovering || deleting} onClick={handleClose}>Отмена</Button>
    </> : null}
    {!loading && !readError && !notFound && !entry && !catalog.canRead && <StatePanel kind="error">Доступ к личной записи недоступен.</StatePanel>}
  </ModalPortal>;
};

export default CharacterCatalogEntryDialog;
