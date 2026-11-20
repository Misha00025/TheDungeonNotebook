import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace, useDirtyDraft } from './Workspace';
import { useCampaignWorkspace } from './Shell';
import { CampaignApiError } from './api';
import type { FormulaContentEnvelope, FormulaMetadata } from './types';

export type FormulaRow = {
  id: string;
  metadataBaseline: FormulaMetadata;
  name: string;
  contentBaseline?: FormulaContentEnvelope;
  expression: string;
  parametersText: string;
  nameBlocked: boolean;
  contentBlocked: boolean;
  loadError?: unknown;
  nameError?: unknown;
  contentError?: unknown;
  missing: boolean;
};
type Feedback = { kind: 'success' | 'warning'; message: string; event: number };
type State = { rows: FormulaRow[]; loaded: boolean; loading: boolean; busy: boolean; listError?: unknown; feedback?: Feedback };
const initial = (): State => ({ rows: [], loaded: false, loading: true, busy: false });
const params = (text: string) => text.split('\n').filter((item, index, values) => index < values.length - 1 || item.length > 0);
const nameDirty = (row: FormulaRow) => row.name !== row.metadataBaseline.name;
const contentDirty = (row: FormulaRow) => Boolean(row.contentBaseline && (row.expression !== row.contentBaseline.data.expression || row.parametersText !== row.contentBaseline.data.parameters.join('\n')));
export const rowDirty = (row: FormulaRow) => nameDirty(row) || contentDirty(row);

export function useFormulaRows(campaignId: number) {
  const { api, sessionKey } = useWorkspace();
  const { permissions, permissionsLoading, campaign, reloadPermissions } = useCampaignWorkspace();
  const identity = `${sessionKey}:${campaignId}`;
  const writable = Boolean(!permissionsLoading && permissions.canWrite && campaign.id === campaignId);
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef(state); stateRef.current = state;
  const mounted = useRef(false);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const identityRef = useRef(identity);
  const writableRef = useRef(writable);
  const apiRef = useRef(api);
  const pendingReload = useRef(false);
  const feedbackEvent = useRef(0);
  writableRef.current = writable; apiRef.current = api;
  const dirty = state.loaded && state.rows.some(rowDirty);
  useDirtyDraft(`formula-rows-${identity}`, dirty);
  const update = useCallback((fn: (current: State) => State) => {
    if (!mounted.current) return;
    const next = fn(stateRef.current); stateRef.current = next; setState(next);
  }, []);
  const applyMetadata = (row: FormulaRow, metadata: FormulaMetadata): FormulaRow => {
    const preserve = nameDirty(row);
    return { ...row, metadataBaseline: metadata, name: preserve ? row.name : metadata.name, nameBlocked: false, nameError: undefined, missing: false };
  };
  const applyContent = (row: FormulaRow, content: FormulaContentEnvelope): FormulaRow => {
    const preserve = contentDirty(row);
    const text = content.data.parameters.join('\n');
    return { ...row, contentBaseline: content, expression: preserve ? row.expression : content.data.expression, parametersText: preserve ? row.parametersText : text, contentBlocked: false, contentError: undefined, loadError: undefined, missing: false };
  };
  const activeFor = (gen: number, identityAtStart: string) => mounted.current && generation.current === gen && identityRef.current === identityAtStart;

  const load = useCallback(async (manual = false) => {
    if (!mounted.current) return;
    if (busyRef.current) { pendingReload.current = true; return; }
    busyRef.current = true;
    const gen = ++generation.current; const identityAtStart = identity;
    update(value => ({ ...value, loading: true, busy: true, ...(manual ? { listError: undefined } : {}) }));
    try {
      const metadata = await apiRef.current.listFormulas(campaignId);
      if (!activeFor(gen, identityAtStart)) return;
      const previous = stateRef.current.rows;
      const entries = await Promise.all(metadata.map(async item => {
        const prior = previous.find(row => row.id === item.id);
        const seed: FormulaRow = prior ?? { id: item.id, metadataBaseline: item, name: item.name, expression: '', parametersText: '', nameBlocked: false, contentBlocked: false, missing: false };
        if (prior?.nameBlocked || prior?.contentBlocked) return { ...prior, missing: false };
        const result = applyMetadata(seed, item);
        try { return applyContent(result, await apiRef.current.getFormulaContent(campaignId, item.id)); }
        catch (error) { return { ...result, loadError: error }; }
      }));
      if (!activeFor(gen, identityAtStart)) return;
      const next = entries;
      for (const old of previous) if (!metadata.some(item => item.id === old.id) && (rowDirty(old) || old.nameBlocked || old.contentBlocked)) next.push({ ...old, missing: true });
      update(value => ({ ...value, rows: next, loaded: true, loading: false, busy: false, listError: undefined }));
    } catch (error) {
      if (activeFor(gen, identityAtStart)) update(value => ({ ...value, loading: false, busy: false, listError: error }));
    } finally {
      if (activeFor(gen, identityAtStart)) {
        busyRef.current = false;
        update(value => ({ ...value, loading: false, busy: false }));
        if (pendingReload.current) { pendingReload.current = false; void load(true); }
      }
    }
  }, [campaignId, identity, update]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; busyRef.current = false; }; }, []);
  useEffect(() => {
    if (identityRef.current !== identity) { identityRef.current = identity; generation.current++; busyRef.current = false; pendingReload.current = false; stateRef.current = initial(); setState(initial()); }
    void load();
  }, [identity, load]);
  const rereadRow = useCallback(async (id: string) => {
    if (busyRef.current) return;
    const row = stateRef.current.rows.find(item => item.id === id); if (!row) return;
    busyRef.current = true; const gen = ++generation.current; const identityAtStart = identity;
    update(value => ({ ...value, busy: true }));
    try {
      const [metadata, content] = await Promise.all([apiRef.current.getFormula(campaignId, id), apiRef.current.getFormulaContent(campaignId, id)]);
      if (!activeFor(gen, identityAtStart)) return;
      update(value => ({ ...value, rows: value.rows.map(item => item.id === id ? applyContent(applyMetadata(item, metadata), content) : item) }));
    } catch (error) {
      if (activeFor(gen, identityAtStart)) update(value => ({ ...value, rows: value.rows.map(item => item.id === id ? { ...item, loadError: error } : item) }));
    } finally {
      if (activeFor(gen, identityAtStart)) { busyRef.current = false; update(value => ({ ...value, busy: false })); if (pendingReload.current) { pendingReload.current = false; void load(true); } }
    }
  }, [campaignId, identity, load, update]);
  const change = useCallback((id: string, field: 'name' | 'expression' | 'parametersText', value: string) => {
    if (!writableRef.current || busyRef.current) return;
    update(state => ({ ...state, rows: state.rows.map(row => row.id === id && !row.missing && row.contentBaseline ? { ...row, [field]: value, nameError: field === 'name' ? undefined : row.nameError, contentError: field !== 'name' ? undefined : row.contentError } : row) }));
  }, [update]);
  const canSave = state.loaded && dirty && writable && !state.busy && !state.loading && state.rows.filter(rowDirty).every(row => row.contentBaseline && !row.loadError && !row.missing && (!nameDirty(row) || (!row.nameBlocked && Boolean(row.name.trim()))) && (!contentDirty(row) || !row.contentBlocked));
  const saveAll = useCallback(async () => {
    const queue = stateRef.current.rows.filter(rowDirty).map(row => ({ ...row }));
    if (busyRef.current || !writableRef.current || !queue.length || queue.some(row => !row.contentBaseline || row.loadError || row.missing || (nameDirty(row) && (row.nameBlocked || !row.name.trim())) || (contentDirty(row) && row.contentBlocked))) return;
    busyRef.current = true; const gen = ++generation.current; const identityAtStart = identity;
    update(value => ({ ...value, busy: true, feedback: undefined })); let successes = 0;
    try {
      for (const queued of queue) {
        let current = stateRef.current.rows.find(row => row.id === queued.id)!;
        if (nameDirty(current)) {
          if (!activeFor(gen, identityAtStart) || !writableRef.current) throw new Error('permission-lost');
          try {
            const saved = await apiRef.current.renameFormula(campaignId, current.id, { name: current.name.trim(), expectedRevision: current.metadataBaseline.metadataRevision });
            if (!activeFor(gen, identityAtStart)) return;
            current = { ...current, metadataBaseline: saved, name: saved.name, nameError: undefined, nameBlocked: false };
            update(value => ({ ...value, rows: value.rows.map(row => row.id === current.id ? current : row) })); successes++;
          } catch (error) { if (activeFor(gen, identityAtStart)) update(value => ({ ...value, rows: value.rows.map(row => row.id === current.id ? { ...row, nameError: error, nameBlocked: error instanceof CampaignApiError && (error.status === 409 || error.unknownOutcome) } : row) })); throw error; }
        }
        current = stateRef.current.rows.find(row => row.id === queued.id)!;
        if (contentDirty(current)) {
          if (!activeFor(gen, identityAtStart) || !writableRef.current) throw new Error('permission-lost');
          try {
            const saved = await apiRef.current.putFormulaContent(campaignId, current.id, { expression: current.expression, parameters: params(current.parametersText), expectedRevision: current.contentBaseline!.contentRevision });
            if (!activeFor(gen, identityAtStart)) return;
            current = { ...current, contentBaseline: saved, expression: saved.data.expression, parametersText: saved.data.parameters.join('\n'), contentError: undefined, contentBlocked: false };
            update(value => ({ ...value, rows: value.rows.map(row => row.id === current.id ? current : row) })); successes++;
          } catch (error) { if (activeFor(gen, identityAtStart)) update(value => ({ ...value, rows: value.rows.map(row => row.id === current.id ? { ...row, contentError: error, contentBlocked: error instanceof CampaignApiError && (error.status === 409 || error.unknownOutcome) } : row) })); throw error; }
        }
      }
      if (activeFor(gen, identityAtStart)) update(value => ({ ...value, feedback: { kind: 'success', message: 'Формулы сохранены.', event: ++feedbackEvent.current } }));
    } catch (error) {
      if (activeFor(gen, identityAtStart)) {
        if (error instanceof CampaignApiError && error.status === 403) reloadPermissions();
        update(value => ({ ...value, feedback: successes ? { kind: 'warning', message: 'Часть изменений сохранена. Остальные изменения остались в черновике.', event: ++feedbackEvent.current } : error instanceof CampaignApiError ? undefined : { kind: 'warning', message: 'Изменения не сохранены. Проверьте доступ и повторите попытку.', event: ++feedbackEvent.current } }));
      }
    } finally {
      if (activeFor(gen, identityAtStart)) { busyRef.current = false; update(value => ({ ...value, busy: false })); if (pendingReload.current) { pendingReload.current = false; void load(true); } }
    }
  }, [campaignId, identity, load, reloadPermissions, update]);
  const cancelAll = useCallback(() => {
    if (busyRef.current) return;
    update(value => ({ ...value, rows: value.rows.filter(row => !row.missing || row.nameBlocked || row.contentBlocked).map(row => ({ ...row, name: row.metadataBaseline.name, expression: row.contentBaseline?.data.expression ?? row.expression, parametersText: row.contentBaseline?.data.parameters.join('\n') ?? row.parametersText })) }));
  }, [update]);
  const reload = useCallback(() => load(true), [load]);
  const created = useCallback(() => { void load(true); }, [load]);
  return { ...state, dirty, writable, canSave, saveAll, cancelAll, change, rereadRow, reload, created };
}
