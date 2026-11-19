import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignApiError } from './api';
import type { BaseField, TemplateContentEnvelope, VirtualField } from './types';
import { useTemplateFields } from './useTemplateFields';

const context = vi.hoisted(() => ({ sessionKey: 'session-a', invalidation: 0, canWrite: true, permissionsLoading: false, invalidated: vi.fn(), dirtyOwners: {} as Record<string, boolean> }));
const api = vi.hoisted(() => ({ getTemplateContent: vi.fn(), putTemplateContent: vi.fn(), putTemplateVirtualFields: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: context.sessionKey, invalidation: context.invalidation, notifyInvalidation: context.invalidated }), useDirtyDraft: (owner: string, dirty: boolean) => { context.dirtyOwners[owner] = dirty; } }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ permissions: { canWrite: context.canWrite }, permissionsLoading: context.permissionsLoading }) }));

const base = (id: string, key = id): BaseField => ({ id, key, title: key, description: '', valueType: 'Number', typeRevision: 1, value: 0, options: [] });
const virtual = (id: string, key = id): VirtualField => ({ id, key, title: key, description: '', resultType: 'Number', formulaId: 'formula', bindings: {} });
const envelope = (revision = 1, baseFields: BaseField[] = [base('a'), base('b')], virtualFields: VirtualField[] = [virtual('v1'), virtual('v2')]): TemplateContentEnvelope => ({ campaignId: 4, contentRevision: revision, data: { description: 'passive description\n', baseFields, virtualFields } });

describe('useTemplateFields', () => {
  beforeEach(() => {
    context.sessionKey = 'session-a';
    context.invalidation = 0;
    context.canWrite = true;
    context.permissionsLoading = false;
    context.invalidated.mockReset();
    context.dirtyOwners = {};
    api.getTemplateContent.mockReset().mockResolvedValue(envelope());
    api.putTemplateContent.mockReset().mockImplementation(async (_campaign: number, body: { expectedRevision: number; description: string; baseFields: BaseField[] }) => ({ ...envelope(body.expectedRevision + 1, body.baseFields.map((field, i) => ({ ...field, id: field.id ?? `new-${i}` })), [virtual('v1'), virtual('v2')]), data: { ...envelope().data, description: body.description, baseFields: body.baseFields.map((field, i) => ({ ...field, id: field.id ?? `new-${i}` })), virtualFields: [virtual('v1'), virtual('v2')] } }));
    api.putTemplateVirtualFields.mockReset().mockImplementation(async (_campaign: number, body: { expectedRevision: number; virtualFields: VirtualField[] }) => ({ contentRevision: body.expectedRevision + 1, virtualFields: body.virtualFields.map((field, i) => ({ ...field, id: field.id ?? `virtual-new-${i}` })) }));
  });

  it('writes only the target base row and reconciles its server id while retaining neighboring drafts', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const [a, b] = result.current.baseRows;
    act(() => {
      result.current.changeBase(a.rowKey, field => ({ ...field, title: 'A changed' }));
      result.current.changeBase(b.rowKey, field => ({ ...field, title: 'B draft' }));
      result.current.addBase();
    });
    const newRow = result.current.baseRows[2];
    act(() => result.current.changeBase(newRow.rowKey, field => ({ ...field, key: 'new-c', title: 'C' })));
    await act(async () => result.current.saveBase(a.rowKey));
    const body = api.putTemplateContent.mock.calls[0][1];
    expect(body).toMatchObject({ expectedRevision: 1, description: 'passive description\n' });
    expect(body.baseFields).toEqual([expect.objectContaining({ id: 'a', title: 'A changed' }), expect.objectContaining({ id: 'b', key: 'b', title: 'b' })]);
    expect(body.baseFields[0]).not.toHaveProperty('typeRevision');
    expect(body.baseFields[1]).not.toMatchObject({ title: 'B draft' });
    expect(body.baseFields[2]).toBeUndefined();
    expect(result.current.baseRows[0]).toMatchObject({ rowKey: a.rowKey, field: { id: 'a', title: 'A changed' }, resetKey: 1 });
    expect(result.current.baseRows.find(row => row.rowKey === b.rowKey)?.field.title).toBe('B draft');
    expect(result.current.baseRows.find(row => row.rowKey === newRow.rowKey)?.field.id).toBeUndefined();
    expect(context.dirtyOwners['template-fields-session-a:4']).toBe(true);
  });

  it('keeps invalid neighboring numeric drafts while saving another valid row', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const [a, b] = result.current.baseRows;
    act(() => {
      result.current.changeBase(a.rowKey, field => ({ ...field, title: 'A changed' }));
      result.current.changeBase(b.rowKey, field => ({ ...field, value: 2 }));
      result.current.setBaseValidity(b.rowKey, 'Введите конечное число.');
    });
    await act(async () => result.current.saveBase(a.rowKey));
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    expect(result.current.baseRows.find(row => row.rowKey === b.rowKey)).toMatchObject({ field: { value: 2 }, validationError: 'Введите конечное число.' });
    expect(result.current.baseRows.find(row => row.rowKey === b.rowKey)?.baseline?.value).toBe(0);
  });

  it('serializes base and virtual writes against their shared revision and isolates payloads', async () => {
    api.getTemplateContent.mockResolvedValueOnce(envelope(0));
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const [baseRow] = result.current.baseRows;
    const [v1, v2] = result.current.virtualRows;
    act(() => {
      result.current.changeBase(baseRow.rowKey, field => ({ ...field, title: 'Base draft' }));
      result.current.changeVirtual(v1.rowKey, field => ({ ...field, title: 'V1 changed' }));
      result.current.changeVirtual(v2.rowKey, field => ({ ...field, title: 'V2 draft' }));
    });
    await act(async () => result.current.saveVirtual(v1.rowKey));
    expect(api.putTemplateVirtualFields.mock.calls[0][1]).toMatchObject({ expectedRevision: 0, virtualFields: [expect.objectContaining({ id: 'v1', title: 'V1 changed' }), virtual('v2')] });
    expect(api.putTemplateVirtualFields.mock.calls[0][1].virtualFields).toHaveLength(2);
    expect(result.current.baseRows[0].field.title).toBe('Base draft');
    await act(async () => result.current.saveBase(baseRow.rowKey));
    expect(api.putTemplateContent.mock.calls[0][1]).toMatchObject({ expectedRevision: 1, baseFields: [expect.objectContaining({ title: 'Base draft' }), expect.objectContaining({ id: 'b', title: 'b' })] });
  });

  it('cancels only the target draft and deletes only the target saved row', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const [a, b] = result.current.baseRows;
    act(() => {
      result.current.changeBase(a.rowKey, field => ({ ...field, title: 'A draft' }));
      result.current.changeBase(b.rowKey, field => ({ ...field, title: 'B draft' }));
      result.current.cancelBase(a.rowKey);
    });
    expect(result.current.baseRows.find(row => row.rowKey === a.rowKey)?.field.title).toBe('a');
    expect(result.current.baseRows.find(row => row.rowKey === b.rowKey)?.field.title).toBe('B draft');
    await act(async () => result.current.deleteBase(a.rowKey));
    expect(api.putTemplateContent.mock.calls[0][1].baseFields).toEqual([expect.objectContaining({ id: 'b', title: 'b' })]);
    expect(result.current.baseRows.some(row => row.rowKey === a.rowKey)).toBe(false);
    expect(result.current.baseRows.find(row => row.rowKey === b.rowKey)?.field.title).toBe('B draft');
  });

  it('freezes writes after conflict or unknown outcome and only explicitly rereads', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const row = result.current.baseRows[0];
    act(() => result.current.changeBase(row.rowKey, field => ({ ...field, title: 'Draft retained' })));
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'Conflict' }));
    await act(async () => result.current.saveBase(row.rowKey));
    expect(result.current.blocked).toBe(true);
    expect(api.getTemplateContent).toHaveBeenCalledTimes(1);
    await act(async () => result.current.saveVirtual(result.current.virtualRows[0].rowKey));
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    api.getTemplateContent.mockResolvedValueOnce(envelope(8));
    await act(async () => result.current.reread());
    expect(result.current.revision).toBe(8);
    expect(result.current.description).toBe('passive description\n');
    expect(result.current.baseRows.find(item => item.rowKey === row.rowKey)?.field.title).toBe('Draft retained');
    expect(result.current.blocked).toBe(false);
    await act(async () => result.current.saveBase(row.rowKey));
    expect(api.putTemplateContent.mock.calls[1][1].expectedRevision).toBe(8);
  });

  it('matches uncertain new publication only to its pending row and preserves the other draft', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.addBase());
    const target = result.current.baseRows[2];
    act(() => result.current.changeBase(target.rowKey, field => ({ ...field, key: 'new-key', title: 'New' })));
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(503, { code: 'unknown', title: 'Unknown', detail: 'Unknown' }, true));
    await act(async () => result.current.saveBase(target.rowKey));
    expect(result.current.blocked).toBe(true);
    api.getTemplateContent.mockResolvedValueOnce(envelope(2, [...envelope().data.baseFields, { ...base('published', 'new-key'), title: 'New' }]));
    await act(async () => result.current.reread());
    expect(result.current.baseRows.find(row => row.rowKey === target.rowKey)?.field.id).toBe('published');
    expect(result.current.baseRows.find(row => row.rowKey === target.rowKey)?.field.title).toBe('New');
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
  });

  it('does not recover a conflicted new draft by matching a same-key server field', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.addBase());
    const target = result.current.baseRows[2];
    act(() => result.current.changeBase(target.rowKey, field => ({ ...field, key: 'same-key', title: 'Local' })));
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'Conflict' }));
    await act(async () => result.current.saveBase(target.rowKey));
    api.getTemplateContent.mockResolvedValueOnce(envelope(2, [...envelope().data.baseFields, { ...base('server-copy', 'same-key'), title: 'Server' }]));
    await act(async () => result.current.reread());
    expect(result.current.baseRows.find(row => row.rowKey === target.rowKey)?.field).toMatchObject({ key: 'same-key', title: 'Local' });
    expect(result.current.baseRows.find(row => row.rowKey === target.rowKey)?.field.id).toBeUndefined();
    expect(result.current.baseRows.some(row => row.field.id === 'server-copy')).toBe(true);
  });

  it('blocks all row edits while a write is busy and uses the next revision for a later write', async () => {
    let resolveWrite!: (value: TemplateContentEnvelope) => void;
    api.putTemplateContent.mockReturnValueOnce(new Promise(resolve => { resolveWrite = resolve; }));
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const baseRow = result.current.baseRows[0];
    const virtualRow = result.current.virtualRows[0];
    act(() => { void result.current.saveBase(baseRow.rowKey); });
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(1));
    act(() => {
      result.current.addBase();
      result.current.changeVirtual(virtualRow.rowKey, field => ({ ...field, title: 'Busy edit' }));
      result.current.cancelBase(baseRow.rowKey);
      void result.current.saveVirtual(virtualRow.rowKey);
    });
    expect(result.current.virtualRows[0].field.title).toBe('v1');
    expect(api.putTemplateVirtualFields).not.toHaveBeenCalled();
    await act(async () => resolveWrite(envelope(2)));
    await act(async () => result.current.saveVirtual(virtualRow.rowKey));
    expect(api.putTemplateVirtualFields).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 2 }));
  });

  it('guards edits and writes when permissions are lost and retains a dirty missing saved row until cancel', async () => {
    const { result, rerender } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const row = result.current.baseRows[0];
    act(() => result.current.changeBase(row.rowKey, field => ({ ...field, title: 'Local draft' })));
    api.getTemplateContent.mockResolvedValueOnce(envelope(2, [base('b')]));
    await act(async () => result.current.reread());
    expect(result.current.baseRows.find(item => item.rowKey === row.rowKey)?.missing).toBe(true);
    await act(async () => result.current.saveBase(row.rowKey));
    await act(async () => result.current.deleteBase(row.rowKey));
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    act(() => result.current.cancelBase(row.rowKey));
    expect(result.current.baseRows.some(item => item.rowKey === row.rowKey)).toBe(false);

    context.canWrite = false;
    rerender();
    const before = result.current.baseRows.length;
    const savedOther = result.current.baseRows[0];
    act(() => {
      result.current.addBase();
      result.current.changeBase(savedOther.rowKey, field => ({ ...field, title: 'Denied edit' }));
      void result.current.saveBase(savedOther.rowKey);
      result.current.cancelBase(savedOther.rowKey);
    });
    expect(result.current.baseRows).toHaveLength(before);
    expect(result.current.baseRows[0].field.title).toBe('b');
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(result.current.writable).toBe(false);
    context.canWrite = true;
  });

  it('does not unblock on read failure and notifies on forbidden writes', async () => {
    const { result } = renderHook(() => useTemplateFields(4));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const row = result.current.baseRows[0];
    act(() => result.current.changeBase(row.rowKey, field => ({ ...field, title: 'Draft' })));
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(503, { code: 'unknown', title: 'Unknown', detail: 'Unknown' }, true));
    await act(async () => result.current.saveBase(row.rowKey));
    api.getTemplateContent.mockRejectedValueOnce(new Error('read unavailable'));
    await act(async () => result.current.reread());
    expect(result.current.blocked).toBe(true);
    expect(result.current.readError).toBeInstanceOf(Error);
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'Forbidden' }));
    api.getTemplateContent.mockResolvedValueOnce(envelope(2));
    await act(async () => result.current.reread());
    await act(async () => result.current.saveBase(row.rowKey));
    expect(context.invalidated).toHaveBeenCalled();
    expect(result.current.baseRows.find(item => item.rowKey === row.rowKey)?.field.title).toBe('Draft');
  });

  it('ignores late content reads after session scope changes', async () => {
    let finish!: (data: TemplateContentEnvelope) => void;
    api.getTemplateContent.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ campaign }) => useTemplateFields(campaign), { initialProps: { campaign: 4 } });
    context.sessionKey = 'session-b';
    api.getTemplateContent.mockResolvedValueOnce(envelope(3, [base('new-session', 'fresh')], []));
    rerender({ campaign: 4 });
    await waitFor(() => expect(result.current.baseRows[0]?.field.key).toBe('fresh'));
    await act(async () => finish(envelope(1, [base('old-session', 'stale')], [])));
    expect(result.current.baseRows[0].field.key).toBe('fresh');
  });

  it('restarts the initial read after StrictMode effect cleanup and ignores the first result', async () => {
    let finishFirst!: (data: TemplateContentEnvelope) => void;
    api.getTemplateContent.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    api.getTemplateContent.mockResolvedValueOnce(envelope(7, [base('fresh', 'fresh')], []));
    const { result } = renderHook(() => useTemplateFields(4), { reactStrictMode: true });
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.baseRows[0]?.field.key).toBe('fresh'));
    await act(async () => finishFirst(envelope(1, [base('stale', 'stale')], [])));
    expect(result.current.baseRows[0].field.key).toBe('fresh');
  });
});
