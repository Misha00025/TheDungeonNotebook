import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Templates from './Templates';
import { CampaignApiError } from './api';

const shared = vi.hoisted(() => ({ dirty: false, canWrite: true, permissionsLoading: false, invalidation: 0 }));
const api = vi.hoisted(() => ({ listTemplates: vi.fn(), getTemplate: vi.fn(), getTemplateContent: vi.fn(), createTemplate: vi.fn(), renameTemplate: vi.fn(), putTemplateContent: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: 'user', invalidation: shared.invalidation, notifyInvalidation: vi.fn() }), useDirtyDraft: (_owner: string, dirty: boolean) => { shared.dirty = dirty; return () => { shared.dirty = false; }; }, useDirtyState: () => shared.dirty }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ permissions: { canWrite: shared.canWrite }, permissionsLoading: shared.permissionsLoading }) }));

const first = { id: 'template-1', key: 'key-1', campaignId: 4, name: 'First', metadataRevision: 3 };
const second = { id: 'template-2', key: 'key-2', campaignId: 4, name: 'Second', metadataRevision: 7 };
const content = { campaignId: 4, resourceId: first.id, contentRevision: 11, data: { description: 'desc', virtualFields: [{ id: 'opaque', formulaId: 'formula' }], baseFields: [{ id: 'field-1', key: 'immutable', title: 'Title', description: '', valueType: 'String', typeRevision: 5, value: '', options: [] }] } };
const tree = () => <MemoryRouter initialEntries={['/4/gm/templates']}><Routes><Route path=":groupId/gm/templates" element={<Templates />} /></Routes></MemoryRouter>;
const renderTemplates = () => render(tree());

describe('base template editor', () => {
  beforeEach(() => {
    shared.dirty = false; shared.canWrite = true; shared.permissionsLoading = false; shared.invalidation = 0;
    Object.values(api).forEach(method => method.mockReset());
    api.listTemplates.mockResolvedValue([first, second]);
    api.getTemplate.mockImplementation(async (_id: number, id: string) => id === second.id ? second : first);
    api.getTemplateContent.mockResolvedValue(content);
    api.createTemplate.mockResolvedValue({ ...first, contentRevision: 1 });
    api.renameTemplate.mockResolvedValue({ ...first, name: 'Renamed', metadataRevision: 4 });
    api.putTemplateContent.mockResolvedValue({ ...content, contentRevision: 12, data: { ...content.data, description: 'updated' } });
  });

  it('requires explicit selection and sends base content without field type revisions', async () => {
    renderTemplates();
    const select = await screen.findByLabelText('Выбранный шаблон');
    expect(select).toHaveValue('');
    fireEvent.change(select, { target: { value: second.id } });
    expect(await screen.findByDisplayValue('immutable')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле' }));
    fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'updated description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalled());
    const payload = api.putTemplateContent.mock.calls[0][2];
    expect(payload.expectedRevision).toBe(11);
    expect(payload.baseFields[0]).toMatchObject({ id: 'field-1', key: 'immutable' });
    expect(payload.baseFields[1]).not.toHaveProperty('id');
    expect(payload.baseFields[0]).not.toHaveProperty('typeRevision');
    expect(payload).not.toHaveProperty('virtualFields');
  });

  it('keeps metadata and content revisions independent and preserves drafts across conflict refresh', async () => {
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'Conflict' }));
    renderTemplates();
    fireEvent.change(await screen.findByLabelText('Выбранный шаблон'), { target: { value: first.id } });
    fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'Metadata draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить название' }));
    await waitFor(() => expect(api.renameTemplate).toHaveBeenCalledWith(4, first.id, { name: 'Metadata draft', expectedRevision: 3 }));
    const description = await screen.findByLabelText('Описание');
    fireEvent.change(description, { target: { value: 'Content draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await screen.findByText('Conflict');
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(2));
    expect(description).toHaveValue('Content draft');
    expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeEnabled();
    expect(api.putTemplateContent).toHaveBeenCalledWith(4, first.id, expect.objectContaining({ expectedRevision: 11, description: 'Content draft' }));
  });

  it('keeps a content draft while metadata saves independently', async () => {
    renderTemplates();
    fireEvent.change(await screen.findByLabelText('Выбранный шаблон'), { target: { value: first.id } });
    fireEvent.change(await screen.findByLabelText('Описание'), { target: { value: 'Unsaved content draft' } });
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить название' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Название сохранено.');
    expect(screen.getByLabelText('Описание')).toHaveValue('Unsaved content draft');
    expect(api.putTemplateContent).not.toHaveBeenCalled();
  });

  it('retains editor controls and draft during permission refresh', async () => {
    const view = renderTemplates();
    fireEvent.change(await screen.findByLabelText('Выбранный шаблон'), { target: { value: first.id } });
    const description = await screen.findByLabelText('Описание');
    fireEvent.change(description, { target: { value: 'Draft during refresh' } });
    shared.permissionsLoading = true;
    view.rerender(tree());
    expect(screen.getByLabelText('Описание')).toHaveValue('Draft during refresh');
    expect(screen.getByLabelText('Описание')).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('Описание').closest('form')!);
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByLabelText('Название').closest('form')!);
    expect(api.renameTemplate).not.toHaveBeenCalled();
    shared.permissionsLoading = false;
    view.rerender(tree());
    expect(screen.getByLabelText('Описание')).toHaveValue('Draft during refresh');
    expect(screen.getByLabelText('Описание')).toBeEnabled();
  });

  it('uses the request GUID for creation lookup and omits new field IDs', async () => {
    api.getTemplate.mockResolvedValue(first);
    api.getTemplateContent.mockResolvedValue(content);
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Создать шаблон' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(api.createTemplate).toHaveBeenCalled());
    expect(api.createTemplate.mock.calls[0][1]).toMatchObject({ name: 'New', baseFields: [] });
    expect(api.createTemplate.mock.calls[0][1].requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('tracks a new-template draft and confirms before abandoning it', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Создать шаблон' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Draft' } });
    expect(shared.dirty).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(confirm).toHaveBeenCalledWith('Отказаться от черновика шаблона?');
    expect(screen.getByLabelText('Название')).toHaveValue('Draft');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(await screen.findByRole('button', { name: 'Создать шаблон' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('does not select a creation response after switching away while it is pending', async () => {
    let resolveCreate!: (value: typeof first & { contentRevision: number }) => void;
    api.createTemplate.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = renderTemplates();
    const selector = await screen.findByLabelText('Выбранный шаблон');
    fireEvent.click(screen.getByRole('button', { name: 'Создать шаблон' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Pending' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(api.createTemplate).toHaveBeenCalledTimes(1));
    view.rerender(tree());
    fireEvent.change(selector, { target: { value: second.id } });
    expect(await screen.findByDisplayValue('immutable')).toBeInTheDocument();
    resolveCreate({ ...first, id: 'late-created', contentRevision: 1 });
    await waitFor(() => expect(selector).toHaveValue(second.id));
    expect(api.getTemplate).toHaveBeenCalledWith(4, second.id);
    expect(api.getTemplate).not.toHaveBeenCalledWith(4, 'late-created');
    confirm.mockRestore();
  });
});
