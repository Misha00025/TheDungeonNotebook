import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, Button, FieldSet, ModalPortal, SearchBar, StatePanel, Toolbar } from '@tdn/shared';
import { compareNumber } from 'lossless-json';
import { useResource } from './hooks';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCharacterCatalog } from './CharacterCatalogContext';
import { CampaignApiError } from './api';
import { ApiError } from './Feedback';
import CatalogGroupTree from './CatalogGroupTree';
import { CatalogAttributeValuesEditor } from './CatalogAttributeValuesEditor';
import { CatalogDefinitionBasics, CatalogDefinitionSettings, createCatalogDefinitionDraft } from './CatalogDefinitionFields';
import type { CatalogDefinitionDraft } from './CatalogDefinitionFields';
import { CharacterQuantityInput } from './CharacterQuantityInput';
import { catalogValueType } from './catalogModel';
import { validateCharacterQuantity } from './characterCatalogModel';
import { validateFieldValue } from './ValueInput';
import { stringifyJson } from './json';
import CharacterCatalogAttributes from './CharacterCatalogAttributes';
import styles from './CharacterCatalogDialog.module.css';
import type { CatalogAttributeOccurrence, CatalogKind, CatalogMetadata, CatalogContentEnvelope, CatalogGroupEntriesEnvelope, CharacterCatalogAddRequest, CharacterCatalogCreateRequest, CharacterCatalogEntryEnvelope } from './catalogTypes';
import type { JsonNumber } from './types';

type Mode = 'catalog' | 'own';
type PickerData = Pick<CatalogGroupEntriesEnvelope, 'entries' | 'diagnostics'>;

export type CharacterCatalogAddDialogProps = {
  kind: CatalogKind;
  canPublishDefinition?: boolean;
  characterName?: string;
  definitionPermissionsPending?: boolean;
  onClose: () => void;
};

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof CampaignApiError)) return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  if (error.unknownOutcome || error.status === 0) return 'Не удалось подтвердить добавление. Сначала проверьте результат, чтобы не добавить повторно.';
  if (error.status === 400) return 'Проверьте количество и характеристики предмета или навыка.';
  if (error.status === 403) return 'Право записи персонажа больше недоступно.';
  if (error.status === 404) return 'Запись каталога больше недоступна.';
  if (error.status === 409) return 'Не удалось подтвердить добавление. Проверьте результат, прежде чем продолжить.';
  if (error.status === 503) return 'Сервис временно недоступен.';
  return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
}

function isUncertainOrDuplicate(error: unknown): boolean {
  return error instanceof CampaignApiError && (
    error.unknownOutcome
    || error.status === 0
    || ['addition_already_applied', 'already_published', 'content_already_prepared'].includes(error.problem.code)
  );
}

function isQuantityServerError(error: unknown): boolean {
  return error instanceof CampaignApiError
    && error.status === 400
    && ['invalid_quantity', 'invalid_quantity_unit', 'quantity_overflow'].includes(error.problem.code);
}

function defaultQuantityRaw(metadata: Pick<CatalogMetadata, 'kind' | 'quantityUnit'>): string {
  return metadata.kind === 'Skill' ? '' : '1';
}

function makeOwnDraft(kind: CatalogKind, canPublishDefinition: boolean): CatalogDefinitionDraft {
  const draft = createCatalogDefinitionDraft(kind);
  return { ...draft, isHidden: !canPublishDefinition };
}

function sameNumericValue(left: JsonNumber | null | undefined, right: JsonNumber | null | undefined): boolean {
  if (left === null || left === undefined || right === null || right === undefined) return left === right;
  return compareNumber(String(left), String(right)) === 0;
}

const CharacterCatalogAddDialog: React.FC<CharacterCatalogAddDialogProps> = ({
  kind,
  canPublishDefinition = false,
  characterName,
  definitionPermissionsPending = false,
  onClose,
}) => {
  const { api, sessionKey } = useWorkspace();
  const catalog = useCharacterCatalog();
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const sourceReadGeneration = useRef(0);
  const requestIdRef = useRef<string | null>(null);
  const canWriteRef = useRef(catalog.canWrite);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  canWriteRef.current = catalog.canWrite;
  if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();

  const [mode, setMode] = useState<Mode>('catalog');
  const [choosing, setChoosing] = useState(true);
  const [groupId, setGroupId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [selectedSource, setSelectedSource] = useState<{ metadata: CatalogMetadata; content: CatalogContentEnvelope }>();
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<unknown>();
  const [sourceRetry, setSourceRetry] = useState(0);
  const [ownDraft, setOwnDraft] = useState<CatalogDefinitionDraft>(() => makeOwnDraft(kind, canPublishDefinition));
  const [ownBaseline, setOwnBaseline] = useState<CatalogDefinitionDraft>(() => makeOwnDraft(kind, canPublishDefinition));
  const [localAttributes, setLocalAttributes] = useState<CatalogAttributeOccurrence[]>([]);
  const [quantityRaw, setQuantityRaw] = useState(defaultQuantityRaw({ kind, quantityUnit: kind === 'Item' ? 'Whole' : null }));
  const [quantityInitialRaw, setQuantityInitialRaw] = useState(defaultQuantityRaw({ kind, quantityUnit: kind === 'Item' ? 'Whole' : null }));
  const [sourceFieldsInvalid, setSourceFieldsInvalid] = useState(false);
  const [ownBaseInvalid, setOwnBaseInvalid] = useState(false);
  const [localAttributesInvalid, setLocalAttributesInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [confirmedRemoved, setConfirmedRemoved] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [verificationError, setVerificationError] = useState<unknown>();
  const [verificationMessage, setVerificationMessage] = useState('');

  const scope = `${sessionKey}:${catalog.campaignId}:${catalog.characterId}:${kind}`;
  const pickerEnabled = mode === 'catalog' && catalog.canRead && !blocked && !confirmedRemoved;
  const picker = useResource<PickerData>(
    `${scope}:add-picker:${groupId || 'ungrouped'}`,
    () => groupId
      ? api.getCatalogGroupEntries(catalog.campaignId, groupId).then(result => ({ entries: result.entries, diagnostics: result.diagnostics }))
      : api.listCatalog(catalog.campaignId, kind).then(entries => ({ entries, diagnostics: [] })),
    pickerEnabled,
  );
  const groups = useResource(`${scope}:add-groups`, () => api.getCatalogGroups(catalog.campaignId), pickerEnabled);
  const definitions = catalog.definitions ?? [];
  const schemaReady = catalog.definitions !== undefined && !catalog.schemaLoading;
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sourceReadGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'catalog' || !selectedEntryId || blocked || confirmedRemoved) {
      setSourceLoading(false);
      return;
    }
    const generation = ++sourceReadGeneration.current;
    setSourceLoading(true);
    setSourceError(undefined);
    setSelectedSource(undefined);
    Promise.all([
      api.getCatalogEntry(catalog.campaignId, selectedEntryId),
      api.getCatalogContent(catalog.campaignId, selectedEntryId),
    ]).then(([metadata, content]) => {
      if (!mountedRef.current || generation !== sourceReadGeneration.current) return;
      if (metadata.kind !== kind) {
        setSourceError(new CampaignApiError(404, { code: 'not_found', title: 'Not found', detail: 'Definition type changed.' }));
        return;
      }
      const selected = { metadata, content };
      setSelectedSource(selected);
      const initial = defaultQuantityRaw(metadata);
      setQuantityInitialRaw(initial);
      setQuantityRaw(initial);
    }).catch(error => {
      if (mountedRef.current && generation === sourceReadGeneration.current) setSourceError(error);
    }).finally(() => {
      if (mountedRef.current && generation === sourceReadGeneration.current) setSourceLoading(false);
    });
    return () => {
      sourceReadGeneration.current += 1;
    };
  }, [mode, selectedEntryId, blocked, confirmedRemoved, sourceRetry, api, catalog.campaignId, kind]);

  const ownDraftDirty = stringifyJson(ownDraft) !== stringifyJson(ownBaseline);
  const localAttributesDirty = localAttributes.length > 0;
  const quantityPolicy = mode === 'own' ? ownDraft : selectedSource?.metadata;
  const quantityValidation = quantityPolicy
    ? validateCharacterQuantity(quantityRaw, quantityPolicy)
    : undefined;
  const initialQuantityValidation = quantityPolicy
    ? validateCharacterQuantity(quantityInitialRaw, quantityPolicy)
    : undefined;
  const quantityEditable = quantityPolicy?.kind === 'Item' && quantityPolicy.quantityUnit !== 'Single';
  const quantityDirty = Boolean(quantityEditable && (
    quantityValidation?.issue
      ? quantityRaw !== quantityInitialRaw
      : quantityValidation?.value !== undefined && initialQuantityValidation?.value !== undefined
        && !sameNumericValue(quantityValidation.value, initialQuantityValidation.value)
  ));
  const sourceBindingRows = mode === 'own' ? ownDraft.attributes : selectedSource?.content.data.attributes ?? [];
  const sourceRowById = useMemo(() => new Map(sourceBindingRows.map(value => [value.id, value])), [sourceBindingRows]);
  const localBindingMismatches = localAttributes.filter(local => {
    const source = sourceRowById.get(local.id);
    return Boolean(source && source.attributeId !== local.attributeId);
  });
  const localEditLevelMismatches = localAttributes.filter(local => {
    const source = sourceRowById.get(local.id);
    return local.editLevel !== 'Character' || Boolean(source && source.editLevel !== 'Character');
  });
  const localRowsInvalid = localAttributes.some(value => {
    if (value.editLevel !== 'Character') return true;
    const attribute = definitions.find(definition => definition.id === value.attributeId);
    const valueType = attribute ? catalogValueType(attribute.typeKey) : undefined;
    if (!attribute || !attribute.isActive || !valueType) return true;
    if (attribute.typeKey !== value.typeKey || String(attribute.typeRevision) !== String(value.typeRevision)) return true;
    if (validateFieldValue({ valueType, options: attribute.options }, value.value) !== undefined) return true;
    return localBindingMismatches.some(mismatch => mismatch.id === value.id);
  });
  const ownSourceRowsInvalid = mode === 'own' && ownDraft.attributes.some(value => {
    const attribute = definitions.find(definition => definition.id === value.attributeId);
    const valueType = attribute ? catalogValueType(attribute.typeKey) : undefined;
    if (!attribute || !attribute.isActive || !valueType) return true;
    if (attribute.typeKey !== value.typeKey || String(attribute.typeRevision) !== String(value.typeRevision)) return true;
    return validateFieldValue({ valueType, options: attribute.options }, value.value) !== undefined;
  });
  const invalid = (mode === 'own' && (sourceFieldsInvalid || ownBaseInvalid))
    || localAttributesInvalid
    || localRowsInvalid
    || Boolean(quantityDirty && quantityValidation?.issue)
    || Boolean(ownSourceRowsInvalid);
  const ownDirty = mode === 'own' && (ownDraftDirty || localAttributesDirty || quantityDirty);
  const sourceDirty = mode === 'catalog' && Boolean(selectedEntryId) && (localAttributesDirty || quantityDirty);
  const dirty = !confirmedRemoved && (ownDirty || sourceDirty);

  const sourceDiagnostics = mode === 'catalog' ? selectedSource?.content.diagnostics ?? [] : [];
  const lockedOccurrenceIds = [...new Set([
    ...localBindingMismatches.map(value => value.id),
    ...localEditLevelMismatches.map(value => value.id),
  ])];
  const localDiagnostics = [
    ...localBindingMismatches.map(value => ({ occurrenceId: value.id, code: 'attribute_binding_changed' })),
    ...localEditLevelMismatches.map(value => ({ occurrenceId: value.id, code: 'edit_level_changed' })),
  ];
  const visibleEntries = (picker.data?.entries ?? []).filter(entry =>
    entry.kind === kind && entry.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const fieldsDisabled = busy || blocked || confirmedRemoved || !canWriteRef.current || catalog.permissionsPending || definitionPermissionsPending;
  const canPublish = canPublishDefinition && canWriteRef.current && !catalog.permissionsPending && !definitionPermissionsPending;
  useDirtyDraft(`character-catalog-add-${scope}-${requestIdRef.current}`, dirty || blocked && !confirmedRemoved);

  const acceptConfirmedEntry = (entry: CharacterCatalogEntryEnvelope) => {
    catalog.upsert(entry);
    setBlocked(false);
    setVerificationError(undefined);
    setVerificationMessage('');
    onCloseRef.current();
  };

  const checkReceipt = async () => {
    const requestId = requestIdRef.current;
    if (!requestId || !mountedRef.current) return;
    setVerificationError(undefined);
    setVerificationMessage('');
    try {
      const receipt = await api.getCharacterAddition(catalog.campaignId, catalog.characterId, requestId);
      if (!mountedRef.current) return;
      if (receipt.requestId !== requestId || receipt.campaignId !== catalog.campaignId || receipt.characterId !== catalog.characterId) {
        setVerificationError(new Error('Receipt did not match this operation.'));
        return;
      }
      try {
        const entry = await api.getCharacterEntry(catalog.campaignId, catalog.characterId, receipt.entryId);
        if (!mountedRef.current) return;
        if (entry.record.id !== receipt.entryId || entry.record.catalogEntryId !== receipt.catalogEntryId) {
          setVerificationError(new Error('Receipt entry did not match the operation.'));
          return;
        }
        acceptConfirmedEntry(entry);
      } catch (error) {
        if (!mountedRef.current) return;
        if ((error as { status?: number })?.status === 404) {
          catalog.remove(receipt.entryId);
          setBlocked(false);
          setConfirmedRemoved(true);
          setSelectedEntryId(undefined);
          setSelectedSource(undefined);
          setVerificationMessage('Добавление подтверждено, но запись уже удалена.');
          return;
        }
        if ((error as { status?: number })?.status === 403) catalog.reportAccessFailure(error);
        setVerificationError(error);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if ((error as { status?: number })?.status === 403) catalog.reportAccessFailure(error);
      if ((error as { status?: number })?.status === 404) {
          setVerificationMessage('Добавление пока не подтверждено. Проверку можно повторить.');
      } else setVerificationError(error);
    }
  };

  const submit = async () => {
    if (busyRef.current || blocked || confirmedRemoved || !canWriteRef.current || catalog.permissionsPending || definitionPermissionsPending || invalid || !schemaReady) return;
    if (mode === 'own' && !ownDraft.name.trim()) return;
    const requestId = requestIdRef.current;
    if (!requestId) return;
    const quantity = kind === 'Skill' ? null : quantityValidation?.value;
    if (kind === 'Item' && (quantity === undefined || quantity === null)) return;
    let payload: CharacterCatalogAddRequest | CharacterCatalogCreateRequest;
    if (mode === 'catalog') {
      if (!selectedSource || !selectedEntryId) return;
      payload = {
        requestId,
        catalogEntryId: selectedSource.metadata.id,
        quantity: quantity ?? null,
        attributes: localAttributes,
      } satisfies CharacterCatalogAddRequest;
    } else {
      const definition = {
        ...ownDraft,
        kind,
        isHidden: canPublish ? ownDraft.isHidden : true,
        quantityUnit: kind === 'Item' ? ownDraft.quantityUnit ?? 'Whole' : null,
        allowNegative: kind === 'Item' && ownDraft.allowNegative,
      };
      payload = {
        requestId,
        definition,
        quantity: quantity ?? null,
        attributes: localAttributes,
      } satisfies CharacterCatalogCreateRequest;
    }

    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    setVerificationError(undefined);
    try {
      const response = mode === 'catalog'
        ? await catalog.runWrite(() => api.addCharacterEntry(catalog.campaignId, catalog.characterId, payload as CharacterCatalogAddRequest))
        : await catalog.runWrite(() => api.createOwnCharacterEntry(catalog.campaignId, catalog.characterId, payload as CharacterCatalogCreateRequest));
      if (!mountedRef.current) return;
      if (response.requestId !== requestId) {
        const mismatch = new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown outcome', detail: 'The publication response did not match the submitted operation.' }, true);
        setBlocked(true);
        setFailure(mismatch);
        await checkReceipt();
        return;
      }
      acceptConfirmedEntry(response.entry);
    } catch (error) {
      if (!mountedRef.current) return;
      const status = (error as { status?: number })?.status;
      if (status === 403) catalog.reportAccessFailure(error);
      if (isUncertainOrDuplicate(error)) {
        setBlocked(true);
        setFailure(error);
        await checkReceipt();
      } else setFailure(error);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const startNewOwnMode = () => {
    const next = makeOwnDraft(kind, canPublishDefinition);
    setOwnDraft(next);
    setOwnBaseline(next);
  };

  const resetForModeChange = (nextMode: Mode) => {
    sourceReadGeneration.current += 1;
    requestIdRef.current = crypto.randomUUID();
    setFailure(undefined);
    setVerificationError(undefined);
    setVerificationMessage('');
    setConfirmedRemoved(false);
    setBlocked(false);
    setSelectedEntryId(undefined);
    setSelectedSource(undefined);
    setSourceError(undefined);
    setSourceLoading(false);
    setGroupId('');
    setSearch('');
    setLocalAttributes([]);
    setLocalAttributesInvalid(false);
    setSourceFieldsInvalid(false);
    setOwnBaseInvalid(false);
    setChoosing(true);
    const initialQuantity = defaultQuantityRaw({ kind, quantityUnit: kind === 'Item' ? 'Whole' : null });
    setQuantityRaw(initialQuantity);
    setQuantityInitialRaw(initialQuantity);
    if (nextMode === 'own') startNewOwnMode();
    setMode(nextMode);
  };

  const changeMode = (nextMode: Mode) => {
    if (nextMode === mode || busyRef.current || blocked || confirmedRemoved || !canWriteRef.current) return;
    if (dirty && !window.confirm('Отменить черновик текущего способа добавления?')) return;
    resetForModeChange(nextMode);
  };

  const chooseEntry = (metadata: CatalogMetadata) => {
    if (busyRef.current || blocked || confirmedRemoved || !canWriteRef.current || catalog.permissionsPending || definitionPermissionsPending) return;
    if (selectedEntryId === metadata.id) {
      setChoosing(false);
      return;
    }
    if (dirty && !window.confirm('Отменить черновик выбранной записи и выбрать другую?')) return;
    sourceReadGeneration.current += 1;
    requestIdRef.current = crypto.randomUUID();
    setFailure(undefined);
    setVerificationError(undefined);
    setVerificationMessage('');
    setConfirmedRemoved(false);
    setSelectedSource(undefined);
    setSourceError(undefined);
    setLocalAttributes([]);
    setLocalAttributesInvalid(false);
    setSourceFieldsInvalid(false);
    setOwnBaseInvalid(false);
    const initialQuantity = defaultQuantityRaw(metadata);
    setQuantityRaw(initialQuantity);
    setQuantityInitialRaw(initialQuantity);
    setSourceLoading(true);
    setSelectedEntryId(metadata.id);
    setChoosing(false);
  };

  const changeSourceRetry = () => setSourceRetry(value => value + 1);

  const close = () => {
    if (busyRef.current) return;
    if (confirmedRemoved) {
      onCloseRef.current();
      return;
    }
    if (blocked) {
      if (!window.confirm('Результат добавления неизвестен. Закрыть без проверки? Черновик и возможность проверки будут потеряны.')) return;
      onCloseRef.current();
      return;
    }
    if (dirty && !window.confirm('Закрыть и потерять несохранённые изменения?')) return;
    onCloseRef.current();
  };

  const title = kind === 'Item' ? 'Добавить предмет' : 'Добавить навык';
  const footer = <div className={styles.footer}>
    <span />
    <ActionRow className={styles.footerActions} justify="end">
      {confirmedRemoved
        ? <Button type="button" variant="secondary" onClick={close}>Закрыть</Button>
        : <>
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>Отмена</Button>
          <Button
            type="button"
            disabled={busy || blocked || !catalog.canWrite || catalog.permissionsPending || definitionPermissionsPending
              || !schemaReady || invalid || (mode === 'catalog' ? !selectedSource || choosing : !ownDraft.name.trim())}
            onClick={() => void submit()}
          >{busy ? 'Добавление…' : mode === 'catalog' ? 'Добавить персонажу' : 'Создать и добавить'}</Button>
        </>}
    </ActionRow>
  </div>;
  const subtitle = characterName ? `У персонажа «${characterName}»` : undefined;

  return <ModalPortal isOpen onClose={close} title={title} subtitle={subtitle} footer={footer} size="wide" dismissDisabled={busy}>
    {confirmedRemoved
      ? <section>
        <p role="status">{verificationMessage}</p>
      </section>
      : <div className={styles.content}>
        <ActionRow className={styles.modeActions}>
          <Button type="button" size="small" variant={mode === 'catalog' ? 'primary' : 'secondary'} disabled={busy || blocked || confirmedRemoved || !canWriteRef.current} onClick={() => changeMode('catalog')}>Из каталога</Button>
          <Button type="button" size="small" variant={mode === 'own' ? 'primary' : 'secondary'} disabled={busy || blocked || confirmedRemoved || !canWriteRef.current} onClick={() => changeMode('own')}>Создать своё</Button>
        </ActionRow>

        {catalog.permissionsPending && <p role="status">Проверка прав. Запись до её завершения отключена.</p>}
        {definitionPermissionsPending && <p role="status">Проверка прав каталога. Добавление пока недоступно.</p>}
        {!catalog.canRead && <StatePanel kind="error">Нет доступа к записям этого персонажа.</StatePanel>}
        {Boolean(catalog.schemaError) && <>
          <ApiError error={catalog.schemaError} />
          <Button type="button" disabled={busy || blocked || definitionPermissionsPending} onClick={catalog.reload}>Повторить чтение схемы</Button>
        </>}

        {mode === 'catalog' && catalog.canRead && !blocked && choosing && <section className={styles.section}>
          <Toolbar><SearchBar searchTerm={search} onSearchChange={setSearch} compact aria-label="Поиск по названию" /></Toolbar>
          {groups.loading && !groups.data && <StatePanel kind="loading">Загрузка групп каталога…</StatePanel>}
          {Boolean(groups.error) && <ApiError error={groups.error} onRetry={groups.reload} />}
          {groups.data && <CatalogGroupTree groups={groups.data.groups} selectedId={groupId} onSelect={setGroupId} />}
          {groupId && <Button type="button" size="small" variant="secondary" disabled={busy} onClick={() => setGroupId('')}>Сбросить группу</Button>}
          {selectedSource && <Button type="button" size="small" variant="secondary" onClick={() => setChoosing(false)}>К выбранному {kind === 'Item' ? 'предмету' : 'навыку'}</Button>}
          {picker.loading && !picker.data && <StatePanel kind="loading">Загрузка {kind === 'Item' ? 'предметов' : 'навыков'}…</StatePanel>}
          {Boolean(picker.error) && <ApiError error={picker.error} onRetry={picker.reload} />}
          {picker.data?.diagnostics.length ? <p className={styles.warning} role="status">Часть записей группы может быть недоступна. Можно повторить поиск в общем каталоге.</p> : null}
          {picker.data && !picker.error && visibleEntries.length === 0 && <StatePanel kind="empty">Ничего не найдено</StatePanel>}
          {picker.data && visibleEntries.length > 0 && <ul className={styles.pickerList}>
            {visibleEntries.map(item => <li key={item.id}>
              <Button type="button" size="small" variant="ghost" disabled={busy || blocked || confirmedRemoved || !canWriteRef.current || definitionPermissionsPending} onClick={() => chooseEntry(item)}>{item.name}</Button>
            </li>)}
          </ul>}
        </section>}

        {mode === 'catalog' && selectedEntryId && !choosing && <section className={styles.section}>
          <Button type="button" size="small" variant="secondary" disabled={busy || blocked} onClick={() => setChoosing(true)}>Выбрать другой {kind === 'Item' ? 'предмет' : 'навык'}</Button>
          {sourceLoading && <StatePanel kind="loading">Загрузка {kind === 'Item' ? 'предмета' : 'навыка'}…</StatePanel>}
          {Boolean(sourceError) && <>
            <ApiError error={sourceError} />
            <p role="alert">{safeErrorMessage(sourceError)}</p>
            <Button type="button" disabled={busy || blocked} onClick={changeSourceRetry}>Повторить загрузку {kind === 'Item' ? 'предмета' : 'навыка'}</Button>
          </>}
          {!sourceLoading && !sourceError && selectedSource && (!schemaReady
            ? catalog.schemaError
              ? <p role="alert">Схема характеристик недоступна. Добавление невозможно.</p>
              : <StatePanel kind="loading">Загрузка {kind === 'Item' ? 'предмета' : 'навыка'}…</StatePanel>
            : <>
              <div className={styles.selectedHeader}>
                <h3>{selectedSource.metadata.name}</h3>
                <p className={styles.description}>{selectedSource.content.data.description || 'Описание отсутствует.'}</p>
              </div>
              {selectedSource.metadata.kind === 'Item' && <CharacterQuantityInput metadata={selectedSource.metadata} raw={quantityRaw} onRawChange={setQuantityRaw} required disabled={fieldsDisabled} serverError={isQuantityServerError(failure) ? failure : undefined} />}
              <section className={styles.section}>
                <h3>Характеристики</h3>
                <CharacterCatalogAttributes
                  definitions={definitions}
                  sourceValues={selectedSource.content.data.attributes}
                  values={localAttributes}
                  savedValues={[]}
                  diagnostics={[...selectedSource.content.diagnostics, ...localDiagnostics]}
                  lockedOccurrenceIds={lockedOccurrenceIds}
                  readOnly={!catalog.canWrite}
                  disabled={fieldsDisabled}
                  onChange={setLocalAttributes}
                  onValidityChange={setLocalAttributesInvalid}
                />
              </section>
            </>)}
        </section>}

        {mode === 'own' && <section className={styles.section}>
          {!schemaReady
            ? catalog.schemaError
              ? <p role="alert">Схема характеристик недоступна. Создание невозможно.</p>
              : <StatePanel kind="loading">Загрузка {kind === 'Item' ? 'предмета' : 'навыка'}…</StatePanel>
            : <>
              <CatalogDefinitionBasics draft={ownDraft} onChange={setOwnDraft} readOnly={!catalog.canWrite} disabled={fieldsDisabled} onValidityChange={setSourceFieldsInvalid} />
              {kind === 'Item' && <CharacterQuantityInput metadata={ownDraft} raw={quantityRaw} onRawChange={setQuantityRaw} required disabled={fieldsDisabled} serverError={isQuantityServerError(failure) ? failure : undefined} />}
              {!canPublishDefinition && <p className={styles.context}>Не публикуется в общем каталоге</p>}
              <section className={styles.section}>
                <h3>Характеристики</h3>
                <CharacterCatalogAttributes
                  definitions={definitions}
                  sourceValues={ownDraft.attributes}
                  values={localAttributes}
                  savedValues={[]}
                  diagnostics={localDiagnostics}
                  lockedOccurrenceIds={lockedOccurrenceIds}
                  readOnly={!catalog.canWrite}
                  disabled={fieldsDisabled}
                  onChange={setLocalAttributes}
                  onValidityChange={setLocalAttributesInvalid}
                />
              </section>
              <details className={styles.advanced}>
                <summary>Настройки {kind === 'Item' ? 'предмета' : 'навыка'}</summary>
                <div className={styles.advancedBody}>
                  <p>{kind === 'Item' ? 'Базовые характеристики относятся к самому предмету; личные значения выше — к этому персонажу.' : 'Базовые характеристики относятся к самому навыку; личные значения выше — к этому персонажу.'}</p>
                  <CatalogDefinitionSettings draft={ownDraft} onChange={setOwnDraft} canPublish={canPublish} readOnly={!catalog.canWrite} disabled={fieldsDisabled} />
                  <FieldSet legend="Базовые характеристики">
                    <CatalogAttributeValuesEditor definitions={definitions} values={ownDraft.attributes} onChange={attributes => setOwnDraft(current => ({ ...current, attributes }))} onValidityChange={setOwnBaseInvalid} disabled={fieldsDisabled} readOnly={!catalog.canWrite} />
                  </FieldSet>
                </div>
              </details>
            </>}
        </section>}

        {Boolean(failure) && <><ApiError error={failure} /><p role="alert">{safeErrorMessage(failure)}</p></>}
        {Boolean(verificationError) && <><ApiError error={verificationError} /><p role="alert">{safeErrorMessage(verificationError)}</p></>}
        {verificationMessage && <p role="status">{verificationMessage}</p>}
        {blocked && <section className={styles.section}>
          <h3>Проверка добавления</h3>
          <p>Не удалось подтвердить добавление. Сначала проверьте результат, чтобы не добавить повторно.</p>
          <Button type="button" disabled={busy} onClick={() => {
            if (busyRef.current) return;
            busyRef.current = true;
            setBusy(true);
            void checkReceipt().finally(() => {
              busyRef.current = false;
              if (mountedRef.current) setBusy(false);
            });
          }}>Проверить результат добавления</Button>
        </section>}
      </div>}
  </ModalPortal>;
};

export default CharacterCatalogAddDialog;
