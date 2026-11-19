import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { CampaignApiError } from './api';
import { validateFieldValue } from './ValueInput';
import type { BaseFieldInput, Revision, TemplateContentEnvelope, VirtualFieldInput } from './types';
import { newBaseField, newVirtualField, reconcileRows, rowsAreDirty, projectBaseField } from './templateFieldRows';
import type { FieldRow } from './templateFieldRows';

type State = {
  baseRows: FieldRow<BaseFieldInput>[];
  virtualRows: FieldRow<VirtualFieldInput>[];
  savedBase: BaseFieldInput[];
  savedVirtual: VirtualFieldInput[];
  description: string;
  revision?: Revision;
  loaded: boolean;
  loading: boolean;
  error?: unknown;
  readError?: unknown;
  mutationError?: unknown;
  busy: boolean;
  blocked: boolean;
  pending?: { kind: 'base' | 'virtual'; rowKey: string };
};

const initialState = (): State => ({ baseRows: [], virtualRows: [], savedBase: [], savedVirtual: [], description: '', loaded: false, loading: true, busy: false, blocked: false });
const projectVirtual = (field: VirtualFieldInput): VirtualFieldInput => ({ ...field, bindings: { ...field.bindings } });

export function useTemplateFields(campaignId: number) {
  const { api, sessionKey, invalidation, notifyInvalidation } = useWorkspace();
  const { permissions, permissionsLoading } = useCampaignWorkspace();
  const writable = Boolean(permissions.canWrite && !permissionsLoading);
  const identity = `${sessionKey}:${campaignId}`;
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const mounted = useRef(false);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const identityRef = useRef(identity);
  const apiRef = useRef(api);
  apiRef.current = api;
  const dirty = state.loaded && (rowsAreDirty(state.baseRows) || rowsAreDirty(state.virtualRows));
  useDirtyDraft(`template-fields-${identity}`, dirty);

  const update = useCallback((change: (current: State) => State) => {
    if (!mounted.current) return;
    const next = change(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const applySnapshot = useCallback((envelope: TemplateContentEnvelope, pending?: State['pending'], completedRowKey?: string, deletedRowKey?: string) => {
    const current = stateRef.current;
    const savedBase = envelope.data.baseFields.map(projectBaseField);
    const savedVirtual = (envelope.data.virtualFields ?? []).map(projectVirtual);
    let target: FieldRow<BaseFieldInput | VirtualFieldInput> | undefined;
    if (pending) {
      const rows: FieldRow<BaseFieldInput | VirtualFieldInput>[] = pending.kind === 'base' ? current.baseRows : current.virtualRows;
      target = rows.find(row => row.rowKey === pending.rowKey);
    }
    const pendingRowKey = target && !target.field.id ? target.rowKey : undefined;
    const next: State = {
      ...current,
      baseRows: reconcileRows(current.baseRows, savedBase, pending?.kind === 'base' ? pendingRowKey : undefined),
      virtualRows: reconcileRows(current.virtualRows, savedVirtual, pending?.kind === 'virtual' ? pendingRowKey : undefined),
      savedBase,
      savedVirtual,
      description: envelope.data.description,
      revision: envelope.contentRevision,
      loaded: true,
      loading: false,
      error: undefined,
      readError: undefined,
    };
    if (completedRowKey) {
      next.baseRows = next.baseRows.map(row => {
        if (row.rowKey !== completedRowKey) return row;
        const server = envelope.data.baseFields.find(field => field.id === row.field.id || (!row.field.id && field.key === row.field.key));
        const original = current.baseRows.find(item => item.rowKey === completedRowKey);
        return server ? { ...row, field: projectBaseField(server), baseline: projectBaseField(server), missing: false, resetKey: row.resetKey + (original?.field.id ? 1 : 0), validationError: undefined } : row;
      });
      next.virtualRows = next.virtualRows.map(row => {
        if (row.rowKey !== completedRowKey) return row;
        const server = envelope.data.virtualFields.find(field => field.id === row.field.id || (!row.field.id && field.key === row.field.key));
        const original = current.virtualRows.find(item => item.rowKey === completedRowKey);
        return server ? { ...row, field: projectVirtual(server), baseline: projectVirtual(server), missing: false, resetKey: row.resetKey + (original?.field.id ? 1 : 0), validationError: undefined } : row;
      });
    }
    if (deletedRowKey) {
      next.baseRows = next.baseRows.filter(row => row.rowKey !== deletedRowKey);
      next.virtualRows = next.virtualRows.filter(row => row.rowKey !== deletedRowKey);
    }
    if (pending) {
      const rows: FieldRow<BaseFieldInput | VirtualFieldInput>[] = pending.kind === 'base' ? next.baseRows : next.virtualRows;
      const matched = rows.find(row => row.rowKey === pending.rowKey);
      if (matched?.field.id) next.pending = undefined;
    }
    update(() => next);
  }, [update]);

  const read = useCallback(async (manual = false) => {
    if (!mounted.current || busyRef.current || (!manual && stateRef.current.loaded)) return;
    busyRef.current = true;
    const currentGeneration = ++generation.current;
    update(current => ({ ...current, loading: true, busy: true, error: undefined, ...(manual ? { readError: undefined } : {}) }));
    try {
      const envelope = await apiRef.current.getTemplateContent(campaignId);
      if (!mounted.current || generation.current !== currentGeneration || identityRef.current !== identity) return;
      applySnapshot(envelope, stateRef.current.pending);
      update(current => ({ ...current, blocked: false, mutationError: undefined }));
    } catch (error) {
      if (!mounted.current || generation.current !== currentGeneration || identityRef.current !== identity) return;
      update(current => ({ ...current, loading: false, error: current.loaded ? current.error : error, readError: error }));
    } finally {
      if (mounted.current && generation.current === currentGeneration && identityRef.current === identity) {
        busyRef.current = false;
        update(current => ({ ...current, busy: false }));
      }
    }
  }, [campaignId, identity, applySnapshot, update]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; busyRef.current = false; };
  }, []);
  useEffect(() => {
    if (identityRef.current !== identity) {
      identityRef.current = identity;
      generation.current += 1;
      busyRef.current = false;
      stateRef.current = initialState();
      setState(initialState());
    }
    void read();
  }, [identity, read]);
  const previousInvalidation = useRef(invalidation);
  useEffect(() => {
    if (previousInvalidation.current === invalidation) return;
    previousInvalidation.current = invalidation;
    if (!busyRef.current) void read(true);
  }, [invalidation, read]);

  const addBase = useCallback(() => {
    if (!writable || !stateRef.current.loaded || busyRef.current) return;
    update(current => ({ ...current, baseRows: [...current.baseRows, { rowKey: crypto.randomUUID(), field: newBaseField(), missing: false, resetKey: 0 }] }));
  }, [writable, update]);
  const addVirtual = useCallback(() => {
    if (!writable || !stateRef.current.loaded || busyRef.current) return;
    update(current => ({ ...current, virtualRows: [...current.virtualRows, { rowKey: crypto.randomUUID(), field: newVirtualField(), missing: false, resetKey: 0 }] }));
  }, [writable, update]);
  const changeBase = useCallback((rowKey: string, updater: (field: BaseFieldInput) => BaseFieldInput) => {
    if (!writable || !stateRef.current.loaded || busyRef.current) return;
    update(current => ({ ...current, baseRows: current.baseRows.map(row => {
      if (row.rowKey !== rowKey || row.missing) return row;
      const field = updater(row.field);
      const typeChanged = field.valueType !== row.field.valueType;
      return { ...row, field: row.field.id ? { ...field, id: row.field.id, key: row.field.key } : field, resetKey: row.resetKey + Number(typeChanged), validationError: typeChanged ? undefined : row.validationError };
    }) }));
  }, [writable, update]);
  const changeVirtual = useCallback((rowKey: string, updater: (field: VirtualFieldInput) => VirtualFieldInput) => {
    if (!writable || !stateRef.current.loaded || busyRef.current) return;
    update(current => ({ ...current, virtualRows: current.virtualRows.map(row => {
      if (row.rowKey !== rowKey || row.missing) return row;
      const field = updater(row.field);
      return { ...row, field: row.field.id ? { ...field, id: row.field.id, key: row.field.key } : field };
    }) }));
  }, [writable, update]);
  const setBaseValidity = useCallback((rowKey: string, validationError?: string) => update(current => {
    const row = current.baseRows.find(item => item.rowKey === rowKey);
    if (!row || row.validationError === validationError) return current;
    return { ...current, baseRows: current.baseRows.map(item => item.rowKey === rowKey ? { ...item, validationError } : item) };
  }), [update]);

  const mutate = useCallback(async (kind: 'base' | 'virtual', rowKey: string, operation: 'save' | 'delete') => {
    const before = stateRef.current;
    const rows: FieldRow<BaseFieldInput | VirtualFieldInput>[] = kind === 'base' ? before.baseRows : before.virtualRows;
    const row = rows.find(item => item.rowKey === rowKey);
    if (!row || !writable || !before.loaded || before.blocked || busyRef.current || (row.missing && row.field.id)) return;
    if (operation === 'save' && (row.validationError || (kind === 'base' && validateFieldValue({ valueType: (row.field as BaseFieldInput).valueType, options: (row.field as BaseFieldInput).options }, (row.field as BaseFieldInput).value)))) return;
    if (operation === 'delete' && !row.field.id) {
      update(current => {
        const key = kind === 'base' ? 'baseRows' : 'virtualRows';
        const currentRows: FieldRow<BaseFieldInput | VirtualFieldInput>[] = kind === 'base' ? current.baseRows : current.virtualRows;
        const nextRows = currentRows.filter(item => item.rowKey !== rowKey);
        return { ...current, [key]: nextRows } as State;
      });
      return;
    }
    if (operation === 'save' && !row.field.id && (!row.field.key.trim() || !row.field.title.trim())) return;
    busyRef.current = true;
    const startGeneration = ++generation.current;
    update(current => ({ ...current, busy: true, mutationError: undefined, error: undefined }));
    const payloadRows: Array<BaseFieldInput | VirtualFieldInput> = kind === 'base' ? before.savedBase : before.savedVirtual;
    const payload = operation === 'delete'
      ? payloadRows.filter(field => field.id !== row.field.id)
      : row.field.id
        ? payloadRows.map(field => field.id === row.field.id ? row.field : field)
        : [...payloadRows, row.field];
    try {
      if (kind === 'base') {
        const result = await apiRef.current.putTemplateContent(campaignId, { expectedRevision: before.revision!, description: before.description, baseFields: payload as BaseFieldInput[] });
        if (!mounted.current || identityRef.current !== identity || generation.current !== startGeneration) return;
        const keepPending = operation === 'save' ? { kind, rowKey } as const : undefined;
        applySnapshot(result, keepPending, operation === 'save' ? rowKey : undefined, operation === 'delete' ? rowKey : undefined);
        update(current => ({ ...current, pending: undefined, blocked: false, mutationError: undefined }));
      } else {
        const result = await apiRef.current.putTemplateVirtualFields(campaignId, { expectedRevision: before.revision!, virtualFields: payload as VirtualFieldInput[] });
        if (!mounted.current || identityRef.current !== identity || generation.current !== startGeneration) return;
        const current = stateRef.current;
        const savedVirtual = result.virtualFields.map(projectVirtual);
        const targetRow = current.virtualRows.find(item => item.rowKey === rowKey);
        const pendingRowKey = operation === 'save' && targetRow && !targetRow.field.id ? targetRow.rowKey : undefined;
        let reconciled = reconcileRows(current.virtualRows, savedVirtual, pendingRowKey);
        if (operation === 'save') {
          const savedTarget = reconciled.find(item => item.rowKey === rowKey);
          const server = savedTarget && savedVirtual.find(field => field.id === savedTarget.field.id || (!savedTarget.field.id && field.key === savedTarget.field.key));
          if (server) reconciled = reconciled.map(item => item.rowKey === rowKey ? { ...item, field: projectVirtual(server), baseline: projectVirtual(server), missing: false, resetKey: item.resetKey + (targetRow?.field.id ? 1 : 0), validationError: undefined } : item);
        }
        if (operation === 'delete') reconciled = reconciled.filter(item => item.rowKey !== rowKey);
        update(value => ({
          ...value,
          virtualRows: reconciled,
          savedVirtual,
          revision: result.contentRevision,
          baseRows: value.baseRows,
          pending: undefined,
          blocked: false,
          mutationError: undefined,
        }));
      }
    } catch (error) {
      if (!mounted.current || identityRef.current !== identity || generation.current !== startGeneration) return;
      const uncertain = error instanceof CampaignApiError && (error.conflict || error.unknownOutcome);
      update(current => {
        const key = kind === 'base' ? 'baseRows' : 'virtualRows';
        const rows = current[key] as FieldRow<BaseFieldInput | VirtualFieldInput>[];
        const nextRows = error instanceof CampaignApiError && error.unknownOutcome && operation === 'delete'
          ? rows.map(item => item.rowKey === rowKey ? { ...item, missing: true } : item)
          : rows;
        const pending = error instanceof CampaignApiError && error.unknownOutcome && operation === 'save' && !row.field.id ? { kind, rowKey } : operation === 'delete' ? undefined : current.pending;
        return { ...current, [key]: nextRows, blocked: uncertain ? true : current.blocked, mutationError: error, pending } as State;
      });
      if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation();
    } finally {
      if (identityRef.current === identity && generation.current === startGeneration) {
        busyRef.current = false;
        if (mounted.current) update(current => ({ ...current, busy: false }));
      }
    }
  }, [campaignId, identity, writable, update, applySnapshot, notifyInvalidation]);

  const cancel = useCallback((kind: 'base' | 'virtual', rowKey: string) => {
    if (!writable || !stateRef.current.loaded || busyRef.current) return;
    update(current => {
      const key = kind === 'base' ? 'baseRows' : 'virtualRows';
      const rows = current[key] as FieldRow<BaseFieldInput | VirtualFieldInput>[];
      const row = rows.find(item => item.rowKey === rowKey);
      if (!row) return current;
      const next = row.baseline === undefined || row.missing
        ? rows.filter(item => item.rowKey !== rowKey)
        : rows.map(item => item.rowKey === rowKey ? { ...item, field: item.baseline!, missing: false, validationError: undefined, resetKey: item.resetKey + 1 } : item);
      return { ...current, [key]: next, pending: current.pending?.rowKey === rowKey ? undefined : current.pending } as State;
    });
  }, [writable, update]);
  const saveBase = useCallback((rowKey: string) => mutate('base', rowKey, 'save'), [mutate]);
  const saveVirtual = useCallback((rowKey: string) => mutate('virtual', rowKey, 'save'), [mutate]);
  const deleteBase = useCallback((rowKey: string) => mutate('base', rowKey, 'delete'), [mutate]);
  const deleteVirtual = useCallback((rowKey: string) => mutate('virtual', rowKey, 'delete'), [mutate]);
  const reread = useCallback(() => read(true), [read]);

  return {
    ...state,
    dirty,
    writable,
    status: state.busy ? 'pending' : state.mutationError || state.readError || state.error ? 'error' : 'idle',
    addBase,
    addVirtual,
    changeBase,
    changeVirtual,
    setBaseValidity,
    saveBase,
    saveVirtual,
    cancelBase: (rowKey: string) => cancel('base', rowKey),
    cancelVirtual: (rowKey: string) => cancel('virtual', rowKey),
    deleteBase,
    deleteVirtual,
    reread,
  };
}
