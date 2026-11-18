import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Templates from './Templates';
import { CampaignApiError } from './api';
import type { VirtualField, VirtualFieldsEnvelope } from './types';

const shared = vi.hoisted(() => ({ dirty: false, canWrite: true, permissionsLoading: false, invalidation: 0, sessionKey: 'user' }));
const api = vi.hoisted(() => ({ listFormulas: vi.fn(), getFormulaContent: vi.fn(), getTemplate: vi.fn(), getTemplateContent: vi.fn(), renameTemplate: vi.fn(), putTemplateContent: vi.fn(), putTemplateVirtualFields: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: shared.sessionKey, invalidation: shared.invalidation, notifyInvalidation: vi.fn() }), useDirtyDraft: (_owner: string, dirty: boolean) => { shared.dirty = dirty; return () => { shared.dirty = false; }; } }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign: { id: 4 }, permissions: { canWrite: shared.canWrite }, lastKnownPermissions: { canWrite: shared.canWrite }, permissionsLoading: shared.permissionsLoading }) }));

const metadata = { campaignId: 4, name: 'Campaign', metadataRevision: 3 };
const field = { id: 'field-1', key: 'immutable', title: 'Title', description: '', valueType: 'String', typeRevision: 5, value: '', options: [] };
const virtual: VirtualField = { id: 'opaque', key: 'opaque-key', title: 'Opaque field', description: '', resultType: 'Number', formulaId: 'formula', bindings: { value: { kind: 'Base', fieldId: 'field-1' } } };
const content = { campaignId: 4, contentRevision: 11, data: { description: 'desc', virtualFields: [virtual], baseFields: [field] } };
const emptyContent = { campaignId: 4, contentRevision: 0, data: { description: '', baseFields: [], virtualFields: [] } };
const RouteChange: React.FC = () => { const navigate = useNavigate(); return <button type="button" onClick={() => navigate('/5/gm/templates')}>Другую кампанию</button>; };
const tree = (path = '/4/gm/templates') => <MemoryRouter initialEntries={[path]}><RouteChange /><Routes><Route path=":groupId/gm/templates" element={<Templates />} /></Routes></MemoryRouter>;
const renderTemplates = (path?: string) => render(tree(path));
const baseForm = () => within(screen.getByRole('heading', { name: 'Базовое содержимое' }).closest('form')!);
const baseDescription = () => baseForm().getByLabelText('Описание');

describe('singleton campaign template editor', () => {
  beforeEach(() => {
    shared.dirty = false;
    shared.canWrite = true;
    shared.permissionsLoading = false;
    shared.invalidation = 0;
    shared.sessionKey = 'user';
    Object.values(api).forEach(method => method.mockReset());
    api.getTemplate.mockResolvedValue(metadata);
    api.getTemplateContent.mockResolvedValue(content);
    api.listFormulas.mockResolvedValue([{ id: 'formula', key: 'f', campaignId: 4, name: 'Formula', metadataRevision: 1 }]);
    api.getFormulaContent.mockResolvedValue({ campaignId: 4, resourceId: 'formula', contentRevision: 1, data: { expression: '', parameters: [] } });
    api.renameTemplate.mockImplementation(async (_id: number, body: { name: string; expectedRevision: number }) => ({ ...metadata, name: body.name, metadataRevision: body.expectedRevision + 1 }));
    api.putTemplateContent.mockImplementation(async (_id: number, body: { expectedRevision: number; description: string }) => ({ ...content, contentRevision: body.expectedRevision + 1, data: { ...content.data, description: body.description } }));
    api.putTemplateVirtualFields.mockImplementation(async (_id: number, body: { expectedRevision: number; virtualFields: VirtualField[] }) => ({ contentRevision: body.expectedRevision + 1, virtualFields: body.virtualFields.map((field, index) => ({ ...field, id: field.id ?? `created-${index}` })) }));
  });

  it('automatically displays one template and reads metadata and content using only the campaign ID', async () => {
    renderTemplates();
    expect(await screen.findByRole('heading', { name: 'Шаблон кампании' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('immutable')).toBeDisabled();
    expect(api.getTemplate).toHaveBeenCalledWith(4);
    expect(api.getTemplateContent).toHaveBeenCalledWith(4);
    expect(api).not.toHaveProperty('listTemplates');
    expect(api).not.toHaveProperty('createTemplate');
    expect(screen.queryByText('Выбранный шаблон')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать шаблон' })).not.toBeInTheDocument();
  });

  it('saves populated base content with its current revision and omits field type revisions', async () => {
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить поле' }));
    fireEvent.change(baseDescription(), { target: { value: 'updated description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 11, description: 'updated description' })));
    const payload = api.putTemplateContent.mock.calls[0][1];
    expect(payload.baseFields[0]).toMatchObject({ id: 'field-1', key: 'immutable' });
    expect(payload.baseFields[0]).not.toHaveProperty('typeRevision');
    expect(payload.baseFields[1]).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('virtualFields');
  });

  it('allows the first virtual write at revision zero and saves the pending base draft at revision one', async () => {
    api.getTemplateContent.mockResolvedValue(emptyContent);
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть виртуальные поля' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить виртуальное поле' }));
    const newVirtual = within(screen.getAllByRole('group', { name: 'Новое виртуальное поле' })[0]);
    fireEvent.change(newVirtual.getByLabelText('Ключ'), { target: { value: 'calc' } });
    fireEvent.change(newVirtual.getByLabelText('Название'), { target: { value: 'Calc' } });
    fireEvent.change(newVirtual.getByLabelText('Формула'), { target: { value: 'formula' } });
    fireEvent.change(baseDescription(), { target: { value: 'pending base draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить виртуальные поля' }));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 0 })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Содержимое сохранено.'));
    expect(baseDescription()).toHaveValue('pending base draft');
    fireEvent.change(baseDescription(), { target: { value: 'after virtual write' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 1, description: 'after virtual write' })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Содержимое сохранено.'));
  });

  it('allows the first base write at revision zero without discarding a pending virtual draft', async () => {
    api.getTemplateContent.mockResolvedValue(emptyContent);
    api.putTemplateContent.mockResolvedValueOnce({ campaignId: 4, contentRevision: 1, data: { description: 'first base write', baseFields: [], virtualFields: [] } });
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть виртуальные поля' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить виртуальное поле' }));
    const newVirtual = within(screen.getAllByRole('group', { name: 'Новое виртуальное поле' })[0]);
    fireEvent.change(newVirtual.getByLabelText('Ключ'), { target: { value: 'draft-calc' } });
    fireEvent.change(newVirtual.getByLabelText('Название'), { target: { value: 'Draft calculation' } });
    fireEvent.change(newVirtual.getByLabelText('Формула'), { target: { value: 'formula' } });
    fireEvent.change(baseDescription(), { target: { value: 'first base write' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 0, description: 'first base write' })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Содержимое сохранено.'));
    expect(newVirtual.getByLabelText('Название')).toHaveValue('Draft calculation');
    expect(baseDescription()).toHaveValue('first base write');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить виртуальные поля' }));
      await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 1 })));
      await api.putTemplateVirtualFields.mock.results[0].value;
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить виртуальные поля' })).toBeDisabled());
    expect(api.putTemplateVirtualFields.mock.calls[0][1].virtualFields[0]).not.toHaveProperty('id');
  });

  it('keeps metadata and content revisions independent and preserves a content draft on metadata save', async () => {
    renderTemplates();
    await screen.findByRole('heading', { name: 'Базовое содержимое' });
    fireEvent.change(baseDescription(), { target: { value: 'Unsaved content draft' } });
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить название' }));
    await waitFor(() => expect(api.renameTemplate).toHaveBeenCalledWith(4, { name: 'Renamed', expectedRevision: 3 }));
    expect(await screen.findByRole('status')).toHaveTextContent('Название сохранено.');
    expect(baseDescription()).toHaveValue('Unsaved content draft');
    expect(api.putTemplateContent).not.toHaveBeenCalled();
  });

  it('retains controls and drafts while permission refresh gates mutations', async () => {
    const view = renderTemplates();
    await screen.findByRole('heading', { name: 'Базовое содержимое' });
    fireEvent.change(baseDescription(), { target: { value: 'Draft during refresh' } });
    shared.permissionsLoading = true;
    view.rerender(tree());
    expect(baseDescription()).toHaveValue('Draft during refresh');
    expect(baseDescription()).toBeDisabled();
    fireEvent.submit(baseDescription().closest('form')!);
    fireEvent.submit(screen.getByLabelText('Название').closest('form')!);
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    expect(api.renameTemplate).not.toHaveBeenCalled();
    shared.permissionsLoading = false;
    view.rerender(tree());
    expect(baseDescription()).toHaveValue('Draft during refresh');
    expect(baseDescription()).toBeEnabled();
  });

  it('freezes content writes after conflict until an explicit read while preserving the draft', async () => {
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'Conflict' }));
    api.getTemplateContent.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, contentRevision: 14 });
    renderTemplates();
    await screen.findByRole('heading', { name: 'Базовое содержимое' });
    const description = baseDescription();
    fireEvent.change(description, { target: { value: 'Content draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await screen.findByText('Conflict');
    expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(2));
    expect(description).toHaveValue('Content draft');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeEnabled());
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(2));
    expect(api.putTemplateContent.mock.calls[1][1]).toMatchObject({ expectedRevision: 14, description: 'Content draft' });
  });

  it('freezes unknown content outcomes and only unblocks after explicit content read', async () => {
    api.putTemplateVirtualFields.mockRejectedValueOnce(new CampaignApiError(503, { code: 'content_write_outcome_unknown', title: 'Unknown', detail: 'Unknown' }, true));
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть виртуальные поля' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить виртуальное поле' }));
    const newVirtual = within(screen.getAllByRole('group', { name: 'Новое виртуальное поле' })[0]);
    fireEvent.change(newVirtual.getByLabelText('Ключ'), { target: { value: 'calc' } });
    fireEvent.change(newVirtual.getByLabelText('Название'), { target: { value: 'Calc' } });
    fireEvent.change(newVirtual.getByLabelText('Формула'), { target: { value: 'formula' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить виртуальные поля' }));
    await screen.findByText('Unknown');
    expect(screen.getByRole('button', { name: 'Сохранить виртуальные поля' })).toBeDisabled();
    expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Перечитать содержимое' })[1]);
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(2));
    expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить виртуальные поля' })).toBeEnabled());
    expect(screen.getByDisplayValue('Calc')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить виртуальные поля' }));
      await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(2));
      await api.putTemplateVirtualFields.mock.results[1].value;
    });
    expect(api.putTemplateVirtualFields.mock.calls[1][1].expectedRevision).toBe(11);
  });

  it('isolates editor state by campaign and ignores a prior campaign load completing late', async () => {
    let resolveMetadata!: (value: typeof metadata) => void;
    api.getTemplate.mockImplementation((id: number) => id === 4 ? new Promise(resolve => { resolveMetadata = resolve; }) : Promise.resolve({ ...metadata, campaignId: 5, name: 'Campaign 5' }));
    api.getTemplateContent.mockImplementation((id: number) => Promise.resolve({ ...content, campaignId: id, data: { ...content.data, description: id === 5 ? 'Campaign 5 content' : content.data.description } }));
    renderTemplates();
    await waitFor(() => expect(api.getTemplate).toHaveBeenCalledWith(4));
    fireEvent.click(screen.getByRole('button', { name: 'Другую кампанию' }));
    await waitFor(() => expect(api.getTemplate).toHaveBeenCalledWith(5));
    expect(await screen.findByDisplayValue('Campaign 5')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Campaign 5 content')).toBeInTheDocument();
    await act(async () => { resolveMetadata({ ...metadata, campaignId: 4, name: 'Stale campaign' }); });
    expect(screen.queryByDisplayValue('Stale campaign')).not.toBeInTheDocument();
    expect(api.getTemplateContent).toHaveBeenCalledWith(5);
  });

  it('coordinates shared base and virtual revisions while preserving the opposite draft', async () => {
    let resolveWrite!: (value: VirtualFieldsEnvelope) => void;
    api.putTemplateVirtualFields.mockReturnValueOnce(new Promise(resolve => { resolveWrite = resolve; }));
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть виртуальные поля' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить виртуальное поле' }));
    const newVirtual = within(screen.getAllByRole('group', { name: 'Новое виртуальное поле' })[0]);
    fireEvent.change(newVirtual.getByLabelText('Ключ'), { target: { value: 'calc' } });
    fireEvent.change(newVirtual.getByLabelText('Название'), { target: { value: 'Calc' } });
    fireEvent.change(newVirtual.getByLabelText('Формула'), { target: { value: 'formula' } });
    fireEvent.change(baseDescription(), { target: { value: 'base draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить виртуальные поля' }));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
    expect(api.putTemplateVirtualFields.mock.calls[0][1]).toMatchObject({ expectedRevision: 11 });
    expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Сохранить виртуальные поля' })).toBeDisabled();
    resolveWrite({ contentRevision: 13, virtualFields: [virtual] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
      await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 13, description: 'base draft' })));
      await api.putTemplateContent.mock.results[0].value;
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Содержимое сохранено.'));
  });
});
