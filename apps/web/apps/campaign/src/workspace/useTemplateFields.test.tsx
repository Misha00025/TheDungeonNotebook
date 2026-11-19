import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignApiError } from './api';
import { LosslessNumber } from 'lossless-json';
import type { BaseField, Revision, TemplateContentEnvelope, VirtualField } from './types';
import { useTemplateFields } from './useTemplateFields';

const context = vi.hoisted(() => ({ sessionKey: 'session-a', invalidation: 0, canWrite: true, permissionsLoading: false, invalidated: vi.fn(), dirtyOwners: {} as Record<string, boolean> }));
const api = vi.hoisted(() => ({ getTemplateContent: vi.fn(), putTemplateContent: vi.fn(), putTemplateVirtualFields: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: context.sessionKey, invalidation: context.invalidation, notifyInvalidation: context.invalidated }), useDirtyDraft: (owner: string, dirty: boolean) => { context.dirtyOwners[owner] = dirty; } }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ permissions: { canWrite: context.canWrite }, permissionsLoading: context.permissionsLoading }) }));

const base = (id: string, key = id): BaseField => ({ id, key, title: key, description: '', valueType: 'Number', typeRevision: 1, value: 0, options: [] });
const virtual = (id: string, key = id): VirtualField => ({ id, key, title: key, description: '', resultType: 'Number', formulaId: 'formula', bindings: {} });
const envelope = (revision: Revision = 1, baseFields: BaseField[] = [base('a'), base('b')], virtualFields: VirtualField[] = [virtual('v1'), virtual('v2')]): TemplateContentEnvelope => ({ campaignId: 4, contentRevision: revision, data: { description: 'passive description\n', baseFields, virtualFields } });

describe('useTemplateFields', () => {
  beforeEach(() => {
    context.sessionKey = 'session-a'; context.invalidation = 0; context.canWrite = true; context.permissionsLoading = false; context.invalidated.mockReset(); context.dirtyOwners = {};
    api.getTemplateContent.mockReset().mockResolvedValue(envelope());
    api.putTemplateContent.mockReset().mockImplementation(async (_id: number, body: { expectedRevision: Revision; description: string; baseFields: BaseField[] }) => envelope(Number(body.expectedRevision) + 1, body.baseFields.map((field, i) => ({ ...field, id: field.id ?? `base-new-${i}` })), [virtual('v1'), virtual('v2')]));
    api.putTemplateVirtualFields.mockReset().mockImplementation(async (_id: number, body: { expectedRevision: Revision; virtualFields: VirtualField[] }) => ({ contentRevision: Number(body.expectedRevision) + 1, virtualFields: body.virtualFields.map((field, i) => ({ ...field, id: field.id ?? `virtual-new-${i}` })) }));
  });

  it('saves all changed kinds in order with complete payloads and response revisions', async () => {
    api.getTemplateContent.mockResolvedValueOnce(envelope(0));
    api.putTemplateContent.mockImplementationOnce(async (_id, body) => ({
      ...envelope(new LosslessNumber('9223372036854775806'), body.baseFields.map((field: BaseField, i: number) => ({ ...field, id: field.id ?? `base-new-${i}` })), [virtual('v1'), virtual('v2')]),
      data: { ...envelope().data, description: body.description, baseFields: body.baseFields.map((field: BaseField, i: number) => ({ ...field, id: field.id ?? `base-new-${i}` })), virtualFields: [virtual('v1'), virtual('v2')] },
    }));
    api.putTemplateVirtualFields.mockImplementationOnce(async (_id, body) => ({ contentRevision: new LosslessNumber('9223372036854775807'), virtualFields: body.virtualFields }));
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const baseA = result.current.baseRows[0], virtualA = result.current.virtualRows[0];
    act(() => {
      result.current.changeBase(baseA.rowKey, value => ({ ...value, title: 'changed' }));
      result.current.changeVirtual(virtualA.rowKey, value => ({ ...value, title: 'changed virtual' }));
      result.current.deleteBase(result.current.baseRows[1].rowKey);
      result.current.addBase();
    });
    const added = result.current.baseRows[2];
    act(() => result.current.changeBase(added.rowKey, value => ({ ...value, key: 'new', title: 'New' })));
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1);
    expect(api.putTemplateContent.mock.calls[0][1]).toMatchObject({ expectedRevision: 0, description: 'passive description\n', baseFields: [expect.objectContaining({ id: 'a', title: 'changed' }), expect.objectContaining({ key: 'new', title: 'New' })] });
    for (const field of api.putTemplateContent.mock.calls[0][1].baseFields) {
      expect(field).not.toHaveProperty('typeRevision');
    }
    expect(String(api.putTemplateVirtualFields.mock.calls[0][1].expectedRevision)).toBe('9223372036854775806');
    expect(result.current.revision).toBeInstanceOf(LosslessNumber);
    expect(String(result.current.revision)).toBe('9223372036854775807');
    expect(api.putTemplateVirtualFields.mock.calls[0][1]).toMatchObject({ virtualFields: [expect.objectContaining({ id: 'v1', title: 'changed virtual' }), virtual('v2')] });
    expect(result.current.baseRows.find(row => row.rowKey === added.rowKey)?.field.id).toBe('base-new-1');
    expect(result.current.feedback?.kind).toBe('success');
  });

  it('prevalidates both changed groups and excludes deleted invalid rows', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => {
      result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'changed' }));
      result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, formulaId: '' }));
    });
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).not.toHaveBeenCalled(); expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    act(() => result.current.deleteVirtual(result.current.virtualRows[0].rowKey));
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1);
    expect(api.putTemplateVirtualFields.mock.calls[0][1].virtualFields).toEqual([virtual('v2')]);
  });

  it('keeps deletion and restore local and cancelAll restores both baselines', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const baseRow = result.current.baseRows[0];
    act(() => { result.current.changeBase(baseRow.rowKey, value => ({ ...value, title: 'draft' })); result.current.deleteBase(baseRow.rowKey); result.current.restoreBase(baseRow.rowKey); });
    expect(result.current.baseRows[0].field.title).toBe('draft');
    act(() => { result.current.deleteVirtual(result.current.virtualRows[0].rowKey); result.current.addBase(); });
    const added = result.current.baseRows.at(-1)!;
    act(() => result.current.deleteBase(added.rowKey));
    expect(api.putTemplateContent).not.toHaveBeenCalled(); expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    act(() => result.current.cancelAll());
    expect(result.current.baseRows[0].field.title).toBe('a'); expect(result.current.virtualRows).toHaveLength(2); expect(result.current.baseRows).toHaveLength(2);
  });

  it('retains a confirmed base phase when virtual publication fails and retries only virtual', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => { result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'saved' })); result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, title: 'draft' })); result.current.deleteVirtual(result.current.virtualRows[1].rowKey); });
    api.putTemplateVirtualFields.mockRejectedValueOnce(new CampaignApiError(400, { code: 'bad', title: 'Bad', detail: 'Bad' }));
    await act(async () => result.current.saveAll());
    expect(result.current.baseRows[0].field.title).toBe('saved'); expect(result.current.virtualRows[0].field.title).toBe('draft'); expect(result.current.virtualRows[1].deleted).toBe(true);
    expect(result.current.baseRows[0].baseline).toEqual(result.current.baseRows[0].field);
    expect(result.current.feedback?.kind).toBe('warning'); expect(result.current.blocked).toBe(false);
    act(() => result.current.cancelAll());
    expect(result.current.baseRows[0].field.title).toBe('saved');
    act(() => result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, title: 'retry' })));
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1); expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(2);
    expect(api.putTemplateVirtualFields.mock.calls[1][1].expectedRevision).toBe(2);
  });

  it('blocks uncertain writes until explicit read and only maps pending new rows', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => { result.current.addBase(); result.current.addBase(); });
    const drafts = result.current.baseRows.slice(2);
    act(() => drafts.forEach((row, i) => result.current.changeBase(row.rowKey, value => ({ ...value, key: `new-${i}`, title: `New ${i}` }))));
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(503, { code: 'unknown', title: 'Unknown', detail: 'Unknown' }, true));
    await act(async () => result.current.saveAll());
    expect(result.current.blocked).toBe(true); expect(api.getTemplateContent).toHaveBeenCalledTimes(1);
    api.getTemplateContent.mockResolvedValueOnce(envelope(2, [...envelope().data.baseFields, base('published-1', 'new-0'), base('published-2', 'new-1')]));
    await act(async () => result.current.reread());
    expect(result.current.baseRows.find(row => row.rowKey === drafts[0].rowKey)?.field.id).toBe('published-1');
    expect(result.current.baseRows.find(row => row.rowKey === drafts[1].rowKey)?.field.id).toBe('published-2');
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
  });

  it('does not map same-key rows after conflict and leaves blocked state after a failed read', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.addBase());
    const newRow = result.current.baseRows[2];
    act(() => result.current.changeBase(newRow.rowKey, value => ({ ...value, key: 'same', title: 'Local' })));
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'Conflict' }));
    await act(async () => result.current.saveAll());
    api.getTemplateContent.mockRejectedValueOnce(new Error('read unavailable'));
    await act(async () => result.current.reread());
    expect(result.current.blocked).toBe(true); expect(result.current.readError).toBeInstanceOf(Error);
    api.getTemplateContent.mockResolvedValueOnce(envelope(3, [...envelope().data.baseFields, base('server-copy', 'same')]));
    await act(async () => result.current.reread());
    expect(result.current.baseRows.find(row => !row.field.id && row.field.key === 'same')?.field.title).toBe('Local');
  });

  it('guards dirty missing rows and drops a deleted missing row after read', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const row = result.current.baseRows[0];
    act(() => result.current.changeBase(row.rowKey, value => ({ ...value, title: 'draft' })));
    api.getTemplateContent.mockResolvedValueOnce(envelope(2, [base('b')]));
    await act(async () => result.current.reread());
    expect(result.current.baseRows.find(value => value.rowKey === row.rowKey)?.missing).toBe(true);
    await act(async () => result.current.saveAll()); expect(api.putTemplateContent).not.toHaveBeenCalled();
    act(() => result.current.cancelAll()); expect(result.current.baseRows.some(value => value.rowKey === row.rowKey)).toBe(false);
  });

  it('retains drafts and invalidates permissions on forbidden writes', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'draft' })));
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'Forbidden' }));
    await act(async () => result.current.saveAll());
    expect(context.invalidated).toHaveBeenCalled(); expect(result.current.baseRows[0].field.title).toBe('draft');
  });

  it.each([409, 503])('stops after a failed first phase with status %i until explicit reread', async status => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => {
      result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'base draft' }));
      result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, title: 'virtual draft' }));
    });
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(status, { code: 'failure', title: 'Failure', detail: 'Failure' }, status === 503));
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    expect(result.current.blocked).toBe(true);
    expect(result.current.baseRows[0].field.title).toBe('base draft');
    expect(result.current.virtualRows[0].field.title).toBe('virtual draft');
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.getTemplateContent).toHaveBeenCalledTimes(1);
    api.getTemplateContent.mockResolvedValueOnce(envelope(5));
    await act(async () => result.current.reread());
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).toHaveBeenCalledTimes(2);
    expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1);
  });

  it('does not submit virtual fields after permissions are lost while base publication is pending', async () => {
    let resolveBase!: (value: TemplateContentEnvelope) => void;
    api.putTemplateContent.mockReturnValueOnce(new Promise(resolve => { resolveBase = resolve; }));
    const { result, rerender } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => {
      result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'confirmed' }));
      result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, title: 'retained' }));
      void result.current.saveAll();
    });
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    context.canWrite = false;
    rerender();
    await act(async () => resolveBase(envelope(2, [{ ...base('a'), title: 'confirmed' }, base('b')])));
    expect(result.current.baseRows[0].field.title).toBe('confirmed');
    expect(result.current.baseRows[0].baseline?.title).toBe('confirmed');
    expect(result.current.virtualRows[0].field.title).toBe('retained');
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    expect(result.current.feedback?.kind).toBe('warning');
    act(() => result.current.cancelAll());
    expect(result.current.baseRows[0].field.title).toBe('confirmed');
    expect(result.current.virtualRows[0].field.title).toBe('v1');
    context.canWrite = true;
  });

  it('ignores a base response after scope change and never submits the old virtual phase', async () => {
    let resolveBase!: (value: TemplateContentEnvelope) => void;
    api.putTemplateContent.mockReturnValueOnce(new Promise(resolve => { resolveBase = resolve; }));
    const { result, rerender } = renderHook(({ campaign }) => useTemplateFields(campaign), { initialProps: { campaign: 4 } });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => {
      result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'old base' }));
      result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, title: 'old virtual' }));
      void result.current.saveAll();
    });
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    api.getTemplateContent.mockResolvedValueOnce(envelope(7, [base('fresh', 'fresh')], []));
    rerender({ campaign: 5 });
    await waitFor(() => expect(result.current.baseRows[0]?.field.key).toBe('fresh'));
    await act(async () => resolveBase(envelope(2)));
    expect(result.current.baseRows[0].field.key).toBe('fresh');
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
  });

  it('does not submit a virtual phase when unmounted during the base request', async () => {
    let resolveBase!: (value: TemplateContentEnvelope) => void;
    api.putTemplateContent.mockReturnValueOnce(new Promise(resolve => { resolveBase = resolve; }));
    const { result, unmount } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => {
      result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'base' }));
      result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, title: 'virtual' }));
      void result.current.saveAll();
    });
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => resolveBase(envelope(2)));
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
  });

  it('serializes save and local mutations while busy and skips invalidation reads', async () => {
    let resolveBase!: (value: TemplateContentEnvelope) => void;
    api.putTemplateContent.mockReturnValueOnce(new Promise(resolve => { resolveBase = resolve; }));
    const { result, rerender } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const baseRowsBefore = result.current.baseRows, virtualRowsBefore = result.current.virtualRows;
    act(() => {
      result.current.changeBase(baseRowsBefore[0].rowKey, value => ({ ...value, title: 'base draft' }));
      result.current.changeVirtual(virtualRowsBefore[0].rowKey, value => ({ ...value, title: 'virtual draft' }));
      void result.current.saveAll();
    });
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    act(() => {
      void result.current.saveAll();
      result.current.addBase();
      result.current.changeVirtual(virtualRowsBefore[0].rowKey, value => ({ ...value, title: 'busy edit' }));
      result.current.deleteBase(baseRowsBefore[1].rowKey);
      result.current.restoreBase(baseRowsBefore[1].rowKey);
      result.current.cancelAll();
      context.invalidation++;
    });
    rerender();
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    expect(api.getTemplateContent).toHaveBeenCalledTimes(1);
    expect(result.current.baseRows).toHaveLength(2);
    expect(result.current.baseRows[0].field.title).toBe('base draft');
    expect(result.current.virtualRows[0].field.title).toBe('virtual draft');
    await act(async () => resolveBase(envelope(2)));
    expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1);
    expect(api.putTemplateVirtualFields.mock.calls[0][1].expectedRevision).toBe(2);
  });

  it('maps all pending new virtual fields after an uncertain virtual batch publication', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => { result.current.addVirtual(); result.current.addVirtual(); });
    const drafts = result.current.virtualRows.slice(2);
    act(() => drafts.forEach((row, i) => result.current.changeVirtual(row.rowKey, value => ({ ...value, key: `pending-${i}`, title: `Pending ${i}`, formulaId: `formula-${i}` }))));
    api.putTemplateVirtualFields.mockRejectedValueOnce(new CampaignApiError(503, { code: 'unknown', title: 'Unknown', detail: 'Unknown' }, true));
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1);
    api.getTemplateContent.mockResolvedValueOnce(envelope(3, envelope().data.baseFields, [...envelope().data.virtualFields, virtual('published-v3', 'pending-0'), virtual('published-v4', 'pending-1')]));
    await act(async () => result.current.reread());
    expect(result.current.virtualRows.find(row => row.rowKey === drafts[0].rowKey)?.field.id).toBe('published-v3');
    expect(result.current.virtualRows.find(row => row.rowKey === drafts[1].rowKey)?.field.id).toBe('published-v4');
    expect(result.current.virtualRows.filter(row => row.field.id === 'published-v3')).toHaveLength(1);
    expect(result.current.virtualRows.filter(row => row.field.id === 'published-v4')).toHaveLength(1);
    expect(result.current.virtualRows.some(row => row.field.id === 'v1')).toBe(true);
    expect(result.current.virtualRows.some(row => row.field.id === 'v2')).toBe(true);
  });

  it('drops a deleted row missing from an explicit read', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const key = result.current.baseRows[0].rowKey;
    act(() => result.current.deleteBase(key));
    api.getTemplateContent.mockResolvedValueOnce(envelope(2, [base('b')]));
    await act(async () => result.current.reread());
    expect(result.current.baseRows.some(row => row.rowKey === key)).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it('does not save when clean and saves only the changed kind', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    act(() => result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, title: 'virtual only' })));
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1);
  });

  it('blocks all writes for invalid raw base input and clears validation only through cancelAll', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => {
      result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'changed' }));
      result.current.changeVirtual(result.current.virtualRows[0].rowKey, value => ({ ...value, title: 'changed' }));
      result.current.setBaseValidity(result.current.baseRows[1].rowKey, 'Invalid raw value');
    });
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).not.toHaveBeenCalled(); expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    act(() => result.current.cancelAll());
    expect(result.current.baseRows[1].validationError).toBeUndefined();
  });

  it('blocks saving while permissions are loading but allows local cancel', async () => {
    const { result, rerender } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.changeBase(result.current.baseRows[0].rowKey, value => ({ ...value, title: 'draft' })));
    context.permissionsLoading = true; rerender();
    expect(result.current.canSaveAll).toBe(false);
    await act(async () => result.current.saveAll());
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    act(() => result.current.cancelAll());
    expect(result.current.baseRows[0].field.title).toBe('a');
    context.permissionsLoading = false;
  });

  it('ignores late reads after session changes', async () => {
    let finish!: (value: TemplateContentEnvelope) => void;
    api.getTemplateContent.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    api.getTemplateContent.mockResolvedValueOnce(envelope(3, [base('fresh', 'fresh')], []));
    const { result, rerender } = renderHook(({ campaign }) => useTemplateFields(campaign), { initialProps: { campaign: 4 } });
    context.sessionKey = 'session-b'; rerender({ campaign: 4 });
    await waitFor(() => expect(result.current.baseRows[0]?.field.key).toBe('fresh'));
    await act(async () => finish(envelope(1, [base('stale', 'stale')], [])));
    expect(result.current.baseRows[0].field.key).toBe('fresh');
  });

  it('restarts StrictMode initial reads and ignores the cleaned-up request', async () => {
    let finishFirst!: (value: TemplateContentEnvelope) => void;
    api.getTemplateContent.mockReset()
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockResolvedValueOnce(envelope(7, [base('fresh', 'fresh')], []));
    const { result } = renderHook(() => useTemplateFields(4), { reactStrictMode: true });
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.baseRows[0]?.field.key).toBe('fresh'));
    await act(async () => finishFirst(envelope(1, [base('stale', 'stale')], [])));
    expect(result.current.baseRows[0].field.key).toBe('fresh');
  });
});
