import React, { useEffect, useId, useRef, useState } from 'react';
import { Button, IconButton, Input } from '@tdn/shared';
import { compareNumber } from 'lossless-json';
import type { JsonNumber } from './types';
import type { CharacterCatalogEntryEnvelope } from './catalogTypes';
import { CampaignApiError } from './api';
import { useCharacterCatalog } from './CharacterCatalogContext';
import { useDirtyDraft, useWorkspace } from './Workspace';
import { characterQuantityToRaw, validateCharacterQuantity } from './characterCatalogModel';
import type { CharacterQuantityIssue } from './characterCatalogModel';
import { ApiError } from './Feedback';
import styles from './CharacterCatalogQuantity.module.css';

export type CharacterCatalogQuantityProps = {
  entry: CharacterCatalogEntryEnvelope;
  readOnly?: boolean;
  preview?: boolean;
  onStateChange: (id: string, active: boolean) => void;
  onSaved?: (updated: CharacterCatalogEntryEnvelope) => void;
};

const issueMessages: Record<CharacterQuantityIssue, string> = {
  required: 'Введите число.',
  invalid_number: 'Введите число.',
  whole_required: 'Нужно целое число.',
  negative_not_allowed: 'Отрицательное запрещено.',
  invalid_definition: 'Формат количества недоступен.',
};

const canEditPolicy = (entry: CharacterCatalogEntryEnvelope) => entry.definition.kind === 'Item'
  && (entry.definition.quantityUnit === 'Whole' || entry.definition.quantityUnit === 'Fractional');

const CharacterCatalogQuantity: React.FC<CharacterCatalogQuantityProps> = ({ entry, readOnly = false, preview = false, onStateChange, onSaved }) => {
  const catalog = useCharacterCatalog();
  const { api, sessionKey } = useWorkspace();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const blockedRef = useRef(false);
  const armedRef = useRef(false);
  const focusOnEditRef = useRef(false);
  const baselineRef = useRef<CharacterCatalogEntryEnvelope | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryEntry, setRecoveryEntry] = useState<CharacterCatalogEntryEnvelope>();
  const [recoveryError, setRecoveryError] = useState<unknown>();
  const [failure, setFailure] = useState<unknown>();
  const [unavailable, setUnavailable] = useState(false);
  const active = editing || busy || blocked;
  const writable = catalog.canWrite && !catalog.permissionsPending && !readOnly && !preview;
  const policyEntry = baselineRef.current ?? entry;
  const valid = validateCharacterQuantity(raw, {
    kind: 'Item',
    quantityUnit: policyEntry.definition.quantityUnit,
    allowNegative: policyEntry.definition.allowNegative,
  });
  const owner = `character-catalog-quantity-${sessionKey}-${catalog.campaignId}-${catalog.characterId}-${entry.record.id}-${id}`;

  useDirtyDraft(owner, active);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      onStateChange(entry.record.id, false);
    };
  }, [entry.record.id, onStateChange]);

  useEffect(() => {
    onStateChange(entry.record.id, active);
  }, [entry.record.id, active, onStateChange]);

  useEffect(() => {
    if (editing && !blocked && !busy && focusOnEditRef.current) {
      focusOnEditRef.current = false;
      inputRef.current?.focus();
    }
  }, [editing, blocked, busy]);

  const begin = () => {
    if (!writable || !canEditPolicy(entry) || editing) return;
    baselineRef.current = entry;
    setRaw(characterQuantityToRaw(entry.record.quantity));
    setFailure(undefined);
    setRecoveryError(undefined);
    setRecoveryEntry(undefined);
    setUnavailable(false);
    setEditing(true);
    armedRef.current = true;
    focusOnEditRef.current = true;
  };

  const cancel = () => {
    if (busyRef.current || blockedRef.current && !unavailable) return;
    setEditing(false);
    setBlocked(false);
    blockedRef.current = false;
    setFailure(undefined);
    setRecoveryError(undefined);
    setRecoveryEntry(undefined);
    setUnavailable(false);
    baselineRef.current = undefined;
  };

  const unchanged = () => {
    const baseline = baselineRef.current;
    if (!baseline || valid.issue || valid.value === undefined) return false;
    if (valid.value === null || baseline.record.quantity === null) return valid.value === baseline.record.quantity;
    return compareNumber(String(valid.value), String(baseline.record.quantity)) === 0;
  };

  const save = async () => {
    const baseline = baselineRef.current;
    if (!baseline || busyRef.current || blockedRef.current || !editing || !writable || !canEditPolicy(baseline)) return;
    if (raw === characterQuantityToRaw(baseline.record.quantity)) {
      setEditing(false);
      baselineRef.current = undefined;
      return;
    }
    if (valid.issue || valid.value === undefined || valid.value === null) return;
    if (unchanged()) {
      setEditing(false);
      baselineRef.current = undefined;
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFailure(undefined);
    try {
      const updated = await catalog.runWrite(() => api.putCharacterEntryQuantity(catalog.campaignId, catalog.characterId, baseline.record.id, {
        expectedRevision: baseline.record.metadataRevision,
        quantity: valid.value as JsonNumber,
      }));
      if (!mountedRef.current) return;
      catalog.upsert(updated);
      onSaved?.(updated);
      baselineRef.current = undefined;
      setEditing(false);
      setFailure(undefined);
    } catch (error) {
      if (!mountedRef.current) return;
      setFailure(error);
      const status = (error as { status?: number })?.status;
      const unknown = error instanceof CampaignApiError && (error.conflict || error.unknownOutcome || error.status === 0) || status === 409 || status === 0;
      if (unknown) {
        blockedRef.current = true;
        setBlocked(true);
      }
      if (status === 404) {
        blockedRef.current = true;
        setBlocked(true);
        setUnavailable(true);
      }
      if (status === 403) catalog.reportAccessFailure(error);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const reconcile = async () => {
    if (busyRef.current || recoveryBusy || !blockedRef.current) return;
    busyRef.current = true;
    setRecoveryBusy(true);
    setRecoveryError(undefined);
    setUnavailable(false);
    try {
      const latest = await api.getCharacterEntry(catalog.campaignId, 'Item', catalog.characterId, entry.record.id);
      if (!mountedRef.current) return;
      setRecoveryEntry(latest);
    } catch (error) {
      if (!mountedRef.current) return;
      setRecoveryError(error);
      if ((error as { status?: number })?.status === 404) setUnavailable(true);
      if ((error as { status?: number })?.status === 403) catalog.reportAccessFailure(error);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setRecoveryBusy(false);
    }
  };

  const useLatest = () => {
    if (!recoveryEntry || busyRef.current) return;
    catalog.upsert(recoveryEntry);
    baselineRef.current = undefined;
    setRaw(characterQuantityToRaw(recoveryEntry.record.quantity));
    setRecoveryEntry(undefined);
    setBlocked(false);
    blockedRef.current = false;
    setEditing(false);
    setFailure(undefined);
  };

  const keepDraft = () => {
    if (!recoveryEntry || busyRef.current) return;
    catalog.upsert(recoveryEntry);
    baselineRef.current = recoveryEntry;
    setRecoveryEntry(undefined);
    setBlocked(false);
    blockedRef.current = false;
    setFailure(undefined);
    armedRef.current = false;
  };

  const displayed = entry.definition.quantityUnit === 'Single' ? '1' : characterQuantityToRaw(entry.record.quantity) || '—';
  if (!editing && (!writable || !canEditPolicy(entry))) return <span className={styles.value}>{displayed}</span>;
  if (!editing) return <Button className={styles.value} type="button" size="small" variant="ghost" aria-label={`Изменить количество: ${entry.definition.name}`} onClick={begin}>{displayed}</Button>;

  const newPolicyCanEdit = canEditPolicy(policyEntry);
  const errorMessage = valid.issue ? issueMessages[valid.issue] : blocked ? 'Требуется сверка с сервером.' : failure ? failure instanceof CampaignApiError && failure.status === 403 ? 'Право записи недоступно.' : failure instanceof CampaignApiError && failure.status === 404 ? 'Запись недоступна.' : 'Не удалось сохранить количество.' : undefined;

  return <div className={styles.editor}>
    <div ref={editorRef} className={styles.controls} onMouseDown={event => {
      if ((event.target as HTMLElement).closest('button[aria-label="Отменить изменение количества"]')) event.preventDefault();
    }}>
      <Input ref={inputRef} className={styles.input} aria-label={`Количество: ${entry.definition.name}`} inputMode="decimal" value={raw} disabled={busy || !writable || !newPolicyCanEdit || blocked} aria-invalid={Boolean(errorMessage) || undefined} onFocus={() => { armedRef.current = true; }} onChange={event => { setRaw(event.target.value); setFailure(undefined); armedRef.current = true; }} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); void save(); }
        if (event.key === 'Escape' && !blockedRef.current && !busyRef.current) { event.preventDefault(); cancel(); }
      }} onBlur={event => {
        if (event.relatedTarget instanceof Node && editorRef.current?.contains(event.relatedTarget) || blockedRef.current || !armedRef.current) return;
        void save();
      }} />
      {!blocked && <IconButton icon="close" size="small" variant="secondary" title="Отменить изменение количества" ariaLabel="Отменить изменение количества" disabled={busy} onClick={cancel} />}
    </div>
    <small className={styles.status} role={errorMessage || busy ? 'status' : undefined}>{busy ? 'Сохранение…' : errorMessage ?? ' '}</small>
    {!newPolicyCanEdit && <div className={styles.recovery}><small>Формат количества изменился. Черновик нельзя сохранить.</small><Button type="button" size="small" variant="secondary" disabled={blocked || busy} onClick={cancel}>Отменить черновик</Button></div>}
    {blocked && <div className={styles.recovery}>
      {unavailable && <small>Запись недоступна; черновик сохранён до отмены.</small>}
      {Boolean(recoveryError) && !unavailable && <ApiError error={recoveryError} />}
      {Boolean(recoveryError) && <Button type="button" size="small" variant="secondary" disabled={recoveryBusy} onClick={() => void reconcile()}>Повторить сверку</Button>}
      {!unavailable && !recoveryEntry && !recoveryError && <Button type="button" size="small" variant="secondary" disabled={recoveryBusy} onClick={() => void reconcile()}>{recoveryBusy ? 'Сверка…' : 'Сверить'}</Button>}
      {recoveryEntry && <>
        <small>На сервере: {characterQuantityToRaw(recoveryEntry.record.quantity) || '—'}; черновик: {raw || '—'}</small>
        <Button type="button" size="small" variant="secondary" onClick={useLatest}>Использовать актуальное</Button>
        <Button type="button" size="small" variant="secondary" onClick={keepDraft}>Оставить черновик</Button>
      </>}
      {unavailable && <Button type="button" size="small" variant="secondary" onClick={cancel}>Отменить черновик</Button>}
    </div>}
  </div>;
};

export default CharacterCatalogQuantity;
