import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { CampaignApiError } from './api';
import { validateFieldValue } from './ValueInput';
import { parseJson, stringifyJson } from './json';
import type { BaseFieldInput, Revision, TemplateContentEnvelope, VirtualFieldInput } from './types';
import { acceptRows, moveRow, newBaseField, newVirtualField, reconcileRows, rowsAreDirty, rowsOrderChanged, projectBaseField } from './templateFieldRows';
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
  pending?: {
    kind: 'base' | 'virtual';
    rowKeys: string[];
  };
  feedback?: {
    kind: 'success' | 'warning' | 'info';
    message: string;
    event: number;
  };
};
const initialState = (): State => ({
  baseRows: [],
  virtualRows: [],
  savedBase: [],
  savedVirtual: [],
  description: '',
  loaded: false,
  loading: true,
  busy: false,
  blocked: false,
});
const clone = <T,>(value: T): T => parseJson(stringifyJson(value)) as T;
const projectVirtual = (field: VirtualFieldInput): VirtualFieldInput => ({
  ...field,
  bindings: clone(field.bindings),
});

const validateChangedRows = (state: State) => {
  const valid = <T,>(rows: FieldRow<T>[], check: (row: FieldRow<T>) => boolean) =>
    !rows.some(row => row.missing && !row.deleted) && rows.filter(row => !row.deleted).every(check);
  const baseChanged = rowsAreDirty(state.baseRows) || rowsOrderChanged(state.baseRows, state.savedBase);
  const virtualChanged = rowsAreDirty(state.virtualRows) || rowsOrderChanged(state.virtualRows, state.savedVirtual);
  return (!baseChanged || valid(state.baseRows, row => {
    const field = row.field as BaseFieldInput;
    return Boolean(
      field.key.trim()
      && field.title.trim()
      && !row.validationError
      && !validateFieldValue({ valueType: field.valueType, options: field.options }, field.value),
    );
  })) && (!virtualChanged || valid(state.virtualRows, row => {
    const field = row.field as VirtualFieldInput;
    return Boolean(field.key.trim() && field.title.trim() && field.formulaId.trim());
  }));
};

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
  const writableRef = useRef(writable);
  const apiRef = useRef(api);
  const feedbackEvent = useRef(0);
  writableRef.current = writable;
  apiRef.current = api;
  const dirty = state.loaded && (rowsAreDirty(state.baseRows) || rowsOrderChanged(state.baseRows, state.savedBase) || rowsAreDirty(state.virtualRows) || rowsOrderChanged(state.virtualRows, state.savedVirtual));
  useDirtyDraft(`template-fields-${identity}`, dirty);
  const update = useCallback((change: (current: State) => State) => {
    if (!mounted.current) return;
    const next = change(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);
  const applySnapshot = useCallback((envelope: TemplateContentEnvelope) => {
    const current = stateRef.current;
    const base = envelope.data.baseFields.map(projectBaseField);
    const virtual = (envelope.data.virtualFields ?? []).map(projectVirtual);
    const pendingBase = current.pending?.kind === 'base' ? current.pending.rowKeys : undefined;
    const pendingVirtual = current.pending?.kind === 'virtual' ? current.pending.rowKeys : undefined;
    update(value => ({
      ...value,
      baseRows: reconcileRows(value.baseRows, base, pendingBase, rowsOrderChanged(value.baseRows, value.savedBase)),
      virtualRows: reconcileRows(value.virtualRows, virtual, pendingVirtual, rowsOrderChanged(value.virtualRows, value.savedVirtual)),
      savedBase: base,
      savedVirtual: virtual,
      description: envelope.data.description,
      revision: envelope.contentRevision,
      loaded: true,
      loading: false,
      error: undefined,
      readError: undefined,
      pending: undefined,
    }));
  }, [update]);
  const read = useCallback(async (manual = false) => {
    if (!mounted.current || busyRef.current || (!manual && stateRef.current.loaded)) return;
    busyRef.current = true;
    const gen = ++generation.current;
    update(value => ({
      ...value,
      loading: true,
      busy: true,
      error: undefined,
      ...(manual ? { readError: undefined } : {}),
    }));
    try {
      const result = await apiRef.current.getTemplateContent(campaignId);
      if (!mounted.current || generation.current !== gen || identityRef.current !== identity) return;
      applySnapshot(result);
      update(value => ({ ...value, blocked: false, mutationError: undefined }));
    } catch (error) {
      if (mounted.current && generation.current === gen && identityRef.current === identity) {
        update(value => ({
          ...value,
          loading: false,
          error: value.loaded ? value.error : error,
          readError: error,
        }));
      }
    } finally {
      if (mounted.current && generation.current === gen && identityRef.current === identity) {
        busyRef.current = false;
        update(value => ({ ...value, busy: false }));
      }
    }
  }, [campaignId, identity, applySnapshot, update]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      busyRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (identityRef.current !== identity) {
      identityRef.current = identity;
      generation.current++;
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

  const allowed = () => writableRef.current && stateRef.current.loaded && !busyRef.current && !stateRef.current.blocked;
  const moveBase = useCallback((fromKey: string, toKey: string) => {
    if (!allowed()) return;
    update(value => ({ ...value, baseRows: moveRow(value.baseRows, fromKey, toKey) }));
  }, [update]);
  const moveVirtual = useCallback((fromKey: string, toKey: string) => {
    if (!allowed()) return;
    update(value => ({ ...value, virtualRows: moveRow(value.virtualRows, fromKey, toKey) }));
  }, [update]);
  const addBase = useCallback(() => {
    if (!allowed()) return;
    update(value => ({
      ...value,
      baseRows: [...value.baseRows, {
        rowKey: crypto.randomUUID(),
        field: newBaseField(),
        missing: false,
        resetKey: 0,
      }],
    }));
  }, [update]);
  const addVirtual = useCallback(() => {
    if (!allowed()) return;
    update(value => ({
      ...value,
      virtualRows: [...value.virtualRows, {
        rowKey: crypto.randomUUID(),
        field: newVirtualField(),
        missing: false,
        resetKey: 0,
      }],
    }));
  }, [update]);
  const changeBase = useCallback((key: string, fn: (field: BaseFieldInput) => BaseFieldInput) => {
    if (!allowed()) return;
    update(value => ({
      ...value,
      baseRows: value.baseRows.map(row => {
        if (row.rowKey !== key || row.missing || row.deleted) return row;
        const field = fn(row.field);
        const changed = field.valueType !== row.field.valueType;
        return {
          ...row,
          field: row.field.id ? { ...field, id: row.field.id, key: row.field.key } : field,
          resetKey: row.resetKey + Number(changed),
          validationError: changed ? undefined : row.validationError,
        };
      }),
    }));
  }, [update]);
  const changeVirtual = useCallback((key: string, fn: (field: VirtualFieldInput) => VirtualFieldInput) => {
    if (!allowed()) return;
    update(value => ({
      ...value,
      virtualRows: value.virtualRows.map(row => {
        if (row.rowKey !== key || row.missing || row.deleted) return row;
        const field = fn(row.field);
        return {
          ...row,
          field: row.field.id ? { ...field, id: row.field.id, key: row.field.key } : field,
        };
      }),
    }));
  }, [update]);
  const setBaseValidity = useCallback((key: string, validationError?: string) => update(value => {
    const row = value.baseRows.find(item => item.rowKey === key);
    if (!row || row.deleted || row.validationError === validationError) return value;
    return {
      ...value,
      baseRows: value.baseRows.map(item => item.rowKey === key ? { ...item, validationError } : item),
    };
  }), [update]);
  const deleteRow = useCallback((kind: 'base' | 'virtual', key: string) => {
    if (!allowed()) return;
    update(value => {
      const name = kind === 'base' ? 'baseRows' : 'virtualRows';
      const rows: FieldRow<BaseFieldInput | VirtualFieldInput>[] = kind === 'base'
        ? value.baseRows
        : value.virtualRows;
      const row = rows.find(item => item.rowKey === key);
      if (!row) return value;
      return {
        ...value,
        [name]: row.baseline === undefined
          ? rows.filter(item => item.rowKey !== key)
          : rows.map(item => item.rowKey === key ? { ...item, deleted: true } : item),
      };
    });
  }, [update]);
  const restoreRow = useCallback((kind: 'base' | 'virtual', key: string) => {
    if (!allowed()) return;
    update(value => {
      const name = kind === 'base' ? 'baseRows' : 'virtualRows';
      return {
        ...value,
        [name]: value[name].map(row => row.rowKey === key ? { ...row, deleted: false } : row),
      };
    });
  }, [update]);
  const cancelAll = useCallback(() => {
    if (!stateRef.current.loaded || busyRef.current) return;
    update(value => ({
      ...value,
      baseRows: acceptRows(value.baseRows, value.savedBase),
      virtualRows: acceptRows(value.virtualRows, value.savedVirtual),
      pending: undefined,
    }));
  }, [update]);
  const canSaveAll = state.loaded && dirty && !state.busy && !state.blocked
    && !permissionsLoading && writable && state.revision !== undefined
    && validateChangedRows(state);
  const saveAll = useCallback(async () => {
    const before = stateRef.current;
    if (busyRef.current || !writableRef.current || !before.loaded || before.blocked || before.revision === undefined) return;
    const baseChanged = rowsAreDirty(before.baseRows) || rowsOrderChanged(before.baseRows, before.savedBase);
    const virtualChanged = rowsAreDirty(before.virtualRows) || rowsOrderChanged(before.virtualRows, before.savedVirtual);
    if ((!baseChanged && !virtualChanged) || !validateChangedRows(before)) return;
    busyRef.current = true;
    const gen = ++generation.current;
    const identityAtStart = identity;
    update(value => ({ ...value, busy: true, mutationError: undefined, error: undefined, feedback: undefined }));
    const active = () => mounted.current && identityRef.current === identityAtStart && generation.current === gen;
    let baseConfirmed = false;
    try {
      if (baseChanged) {
        const rows = before.baseRows.filter(row => !row.deleted).map(row => row.field);
        const result = await apiRef.current.putTemplateContent(campaignId, {
          expectedRevision: before.revision,
          description: before.description,
          baseFields: rows,
        });
        if (!active()) return;
        const savedBase = result.data.baseFields.map(projectBaseField);
        const savedVirtual = (result.data.virtualFields ?? []).map(projectVirtual);
        update(value => ({
          ...value,
          savedBase,
          baseRows: acceptRows(value.baseRows, savedBase),
          savedVirtual,
          virtualRows: reconcileRows(value.virtualRows, savedVirtual, undefined, rowsOrderChanged(value.virtualRows, value.savedVirtual)),
          description: result.data.description,
          revision: result.contentRevision,
        }));
        baseConfirmed = true;
      }
      if (virtualChanged) {
        if (!active() || !writableRef.current) {
          if (baseConfirmed) {
            update(value => ({
              ...value,
              feedback: {
                kind: 'warning',
                message: 'Базовые поля сохранены. Изменения виртуальных полей не сохранены.',
                event: ++feedbackEvent.current,
              },
            }));
          }
          return;
        }
        const current = stateRef.current;
        const result = await apiRef.current.putTemplateVirtualFields(campaignId, {
          expectedRevision: current.revision!,
          virtualFields: current.virtualRows.filter(row => !row.deleted).map(row => row.field),
        });
        if (!active()) return;
        const saved = result.virtualFields.map(projectVirtual);
        update(value => ({
          ...value,
          savedVirtual: saved,
          virtualRows: acceptRows(value.virtualRows, saved),
          revision: result.contentRevision,
        }));
      }
      if (active()) {
        update(value => ({
          ...value,
          blocked: false,
          pending: undefined,
          feedback: {
            kind: 'success',
            message: 'Изменения шаблона сохранены.',
            event: ++feedbackEvent.current,
          },
        }));
      }
    } catch (error) {
      if (!active()) return;
      const uncertain = error instanceof CampaignApiError && (error.conflict || error.unknownOutcome);
      const phase = baseConfirmed ? 'virtual' : baseChanged ? 'base' : 'virtual';
      const rows: FieldRow<BaseFieldInput | VirtualFieldInput>[] = phase === 'base'
        ? before.baseRows
        : stateRef.current.virtualRows;
      const pending = error instanceof CampaignApiError && error.unknownOutcome
        ? {
          kind: phase as 'base' | 'virtual',
          rowKeys: rows.filter(row => !row.field.id && !row.deleted).map(row => row.rowKey),
        }
        : stateRef.current.pending;
      update(value => ({
        ...value,
        blocked: uncertain ? true : value.blocked,
        mutationError: error,
        pending,
        feedback: baseConfirmed ? {
          kind: 'warning',
          message: 'Базовые поля сохранены. Изменения виртуальных полей не сохранены.',
          event: ++feedbackEvent.current,
        } : undefined,
      }));
      if (error instanceof CampaignApiError && error.status === 403) notifyInvalidation();
    } finally {
      if (identityRef.current === identityAtStart && generation.current === gen) {
        busyRef.current = false;
        if (mounted.current) update(value => ({ ...value, busy: false }));
      }
    }
  }, [campaignId, identity, update, notifyInvalidation]);
  const reread = useCallback(() => read(true), [read]);
  return {
    ...state,
    dirty,
    writable,
    canSaveAll,
    status: state.busy
      ? 'pending'
      : state.mutationError || state.readError || state.error
        ? 'error'
        : 'idle',
    addBase,
    addVirtual,
    changeBase,
    changeVirtual,
    moveBase,
    moveVirtual,
    setBaseValidity,
    deleteBase: (key: string) => deleteRow('base', key),
    deleteVirtual: (key: string) => deleteRow('virtual', key),
    restoreBase: (key: string) => restoreRow('base', key),
    restoreVirtual: (key: string) => restoreRow('virtual', key),
    saveAll,
    cancelAll,
    reread,
  };
}
