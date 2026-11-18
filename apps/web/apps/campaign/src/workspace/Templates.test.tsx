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

const field = { id: 'field-1', key: 'immutable', title: 'Title', description: '', valueType: 'String', typeRevision: 5, value: '', options: [] };
const virtual: VirtualField = { id: 'opaque', key: 'opaque-key', title: 'Opaque field', description: '', resultType: 'Number', formulaId: 'formula', bindings: { value: { kind: 'Base', fieldId: 'field-1' } } };
const content = { campaignId: 4, contentRevision: 11, data: { description: 'desc', virtualFields: [virtual], baseFields: [field] } };
const emptyContent = { campaignId: 4, contentRevision: 0, data: { description: '', baseFields: [], virtualFields: [] } };
const RouteChange: React.FC = () => { const navigate = useNavigate(); return <button type="button" onClick={() => navigate('/5/gm/templates')}>Другую кампанию</button>; };
const tree = (path = '/4/gm/templates') => <MemoryRouter initialEntries={[path]}><RouteChange /><Routes><Route path=":groupId/gm/templates" element={<Templates />} /></Routes></MemoryRouter>;
const renderTemplates = (path?: string) => render(tree(path));
const baseForm = () => within(screen.getByRole('button', { name: 'Сохранить базовые поля' }).closest('form')!);
const baseTitle = () => within(baseForm().getByDisplayValue('immutable').closest('fieldset')!).getByLabelText('Заголовок');

describe('singleton campaign template editor', () => {
  beforeEach(() => {
    shared.dirty = false;
    shared.canWrite = true;
    shared.permissionsLoading = false;
    shared.invalidation = 0;
    shared.sessionKey = 'user';
    Object.values(api).forEach(method => method.mockReset());
    api.getTemplateContent.mockResolvedValue(content);
    api.listFormulas.mockResolvedValue([{ id: 'formula', key: 'f', campaignId: 4, name: 'Formula', metadataRevision: 1 }]);
    api.getFormulaContent.mockResolvedValue({ campaignId: 4, resourceId: 'formula', contentRevision: 1, data: { expression: '', parameters: [] } });
    api.putTemplateContent.mockImplementation(async (_id: number, body: { expectedRevision: number; description: string; baseFields: typeof field[] }) => ({ ...content, contentRevision: body.expectedRevision + 1, data: { ...content.data, description: body.description, baseFields: body.baseFields.map((item, index) => ({ ...item, id: item.id ?? `created-${index}` })) } }));
    api.putTemplateVirtualFields.mockImplementation(async (_id: number, body: { expectedRevision: number; virtualFields: VirtualField[] }) => ({ contentRevision: body.expectedRevision + 1, virtualFields: body.virtualFields.map((field, index) => ({ ...field, id: field.id ?? `created-${index}` })) }));
  });

  it('loads only template content and displays compact base field controls', async () => {
    renderTemplates();
    expect(await screen.findByRole('heading', { name: 'Шаблон кампании' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('immutable')).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Базовые поля' })).toBeInTheDocument();
    expect(baseForm().getByLabelText('Тип')).toBeInTheDocument();
    expect(baseForm().getByLabelText('Значение по умолчанию')).toHaveAttribute('rows', '1');
    const existingRow = screen.getByRole('group', { name: 'Title' });
    expect(existingRow.parentElement?.className).toMatch(/stretch/);
    expect(existingRow.className).toMatch(/fieldSet/);
    expect(existingRow.querySelector('[class*="formGrid"]')).toBeInTheDocument();
    expect(baseForm().getByRole('button', { name: 'Сохранить базовые поля' })).toBeDisabled();
    expect(api.getTemplate).not.toHaveBeenCalled();
    expect(api.renameTemplate).not.toHaveBeenCalled();
    expect(api.getTemplateContent).toHaveBeenCalledWith(4);
    expect(api).not.toHaveProperty('listTemplates');
    expect(api).not.toHaveProperty('createTemplate');
    expect(screen.queryByText('Выбранный шаблон')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать шаблон' })).not.toBeInTheDocument();
  });

  it('saves populated base content with its current revision and omits field type revisions', async () => {
    renderTemplates();
    await waitFor(() => expect(baseTitle()).toHaveValue('Title'));
    await screen.findByDisplayValue('immutable');
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить поле' }));
    expect(await screen.findByRole('group', { name: 'Новое поле' })).toBeInTheDocument();
    fireEvent.change(baseTitle(), { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 11, description: 'desc' })));
    const payload = api.putTemplateContent.mock.calls[0][1];
    expect(payload.baseFields[0]).toMatchObject({ id: 'field-1', key: 'immutable' });
    expect(payload.baseFields[0]).not.toHaveProperty('typeRevision');
    expect(payload.baseFields[1]).not.toHaveProperty('id');
    expect(payload.baseFields[1]).toMatchObject({ title: '' });
    expect(payload).not.toHaveProperty('virtualFields');
  });

  it('allows the first virtual write at revision zero and saves the pending base draft at revision one', async () => {
    api.getTemplateContent.mockResolvedValue({ ...emptyContent, data: { ...emptyContent.data, baseFields: [{ ...field, title: 'Initial' }] } });
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть виртуальные поля' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить виртуальное поле' }));
    const newVirtual = within(screen.getAllByRole('group', { name: 'Новое виртуальное поле' })[0]);
    fireEvent.change(newVirtual.getByLabelText('Ключ'), { target: { value: 'calc' } });
    fireEvent.change(newVirtual.getByLabelText('Название'), { target: { value: 'Calc' } });
    fireEvent.change(newVirtual.getByLabelText('Формула'), { target: { value: 'formula' } });
    fireEvent.change(baseTitle(), { target: { value: 'Pending base draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить виртуальные поля' }));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 0 })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Содержимое сохранено.'));
    expect(baseTitle()).toHaveValue('Pending base draft');
    fireEvent.change(baseTitle(), { target: { value: 'After virtual write' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 1, description: '' })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Содержимое сохранено.'));
  });

  it('allows the first base write at revision zero without discarding a pending virtual draft', async () => {
    api.getTemplateContent.mockResolvedValue({ ...emptyContent, data: { ...emptyContent.data, baseFields: [{ ...field, title: 'Initial' }] } });
    api.putTemplateContent.mockImplementationOnce(async (_id: number, body: { expectedRevision: number; description: string; baseFields: typeof field[] }) => ({ campaignId: 4, contentRevision: 1, data: { description: body.description, baseFields: body.baseFields, virtualFields: [] } }));
    renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть виртуальные поля' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить виртуальное поле' }));
    const newVirtual = within(screen.getAllByRole('group', { name: 'Новое виртуальное поле' })[0]);
    fireEvent.change(newVirtual.getByLabelText('Ключ'), { target: { value: 'draft-calc' } });
    fireEvent.change(newVirtual.getByLabelText('Название'), { target: { value: 'Draft calculation' } });
    fireEvent.change(newVirtual.getByLabelText('Формула'), { target: { value: 'formula' } });
    fireEvent.change(baseTitle(), { target: { value: 'First base write' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 0, description: '' })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Содержимое сохранено.'));
    expect(newVirtual.getByLabelText('Название')).toHaveValue('Draft calculation');
    expect(baseTitle()).toHaveValue('First base write');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить виртуальные поля' }));
      await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 1 })));
      await api.putTemplateVirtualFields.mock.results[0].value;
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить виртуальные поля' })).toBeDisabled());
    expect(api.putTemplateVirtualFields.mock.calls[0][1].virtualFields[0]).not.toHaveProperty('id');
  });

  it('does not load or expose template metadata or description and roundtrips passive description exactly', async () => {
    api.getTemplateContent.mockResolvedValueOnce({ ...content, data: { ...content.data, description: 'server-only\nunknown\nvalue' } });
    renderTemplates();
    await screen.findByRole('heading', { name: 'Базовые поля' });
    await waitFor(() => expect(baseTitle()).toHaveValue('Title'));
    fireEvent.change(baseTitle(), { target: { value: 'Changed title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ description: 'server-only\nunknown\nvalue' })));
    expect(screen.queryByLabelText('Название')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Описание')).not.toBeInTheDocument();
    expect(baseForm().getByLabelText('Описание поля')).toBeInTheDocument();
    expect(screen.queryByText('server-only')).not.toBeInTheDocument();
    expect(api.getTemplate).not.toHaveBeenCalled();
    expect(api.renameTemplate).not.toHaveBeenCalled();
  });

  it('retains controls and drafts while permission refresh gates mutations', async () => {
    const view = renderTemplates();
    await screen.findByRole('heading', { name: 'Базовые поля' });
    await waitFor(() => {
      expect(baseTitle()).toHaveValue('Title');
      expect(baseTitle()).toBeEnabled();
    });
    fireEvent.change(baseTitle(), { target: { value: 'Draft during refresh' } });
    shared.permissionsLoading = true;
    view.rerender(tree());
    expect(baseTitle()).toHaveValue('Draft during refresh');
    expect(baseTitle()).toBeDisabled();
    fireEvent.submit(baseTitle().closest('form')!);
    expect(api.putTemplateContent).not.toHaveBeenCalled();
    shared.permissionsLoading = false;
    view.rerender(tree());
    expect(baseTitle()).toHaveValue('Draft during refresh');
    expect(baseTitle()).toBeEnabled();
  });

  it('freezes content writes after conflict until an explicit read while preserving the draft', async () => {
    api.putTemplateContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'Conflict' }));
    api.getTemplateContent.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, contentRevision: 14, data: { ...content.data, description: 'fresh\nserver description' } });
    renderTemplates();
    await screen.findByRole('heading', { name: 'Базовые поля' });
    await waitFor(() => expect(baseTitle()).toHaveValue('Title'));
    const title = baseTitle();
    fireEvent.change(title, { target: { value: 'Content draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await screen.findByText('Конфликт версии. Черновик сохранён; перечитайте данные перед повторным сохранением.');
    expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await waitFor(() => expect(api.getTemplateContent).toHaveBeenCalledTimes(2));
    expect(title).toHaveValue('Content draft');
    expect(within(screen.getByRole('heading', { name: 'Актуальная серверная версия (черновик сохранён отдельно)' }).closest('aside')!).getByText('Title')).toBeInTheDocument();
    expect(title).toHaveValue('Content draft');
    expect(screen.queryByText('immutable: Title')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeEnabled());
    expect(api.putTemplateContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
    await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledTimes(2));
    expect(api.putTemplateContent.mock.calls[1][1]).toMatchObject({ expectedRevision: 14, description: 'fresh\nserver description', baseFields: [expect.objectContaining({ title: 'Content draft' })] });
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
    await screen.findByText('Результат операции неизвестен. Проверьте данные перед повторной попыткой.');
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

  it('isolates editor state by campaign and ignores a prior content load completing late', async () => {
    let resolveContent!: (value: typeof content) => void;
    api.getTemplateContent.mockImplementation((id: number) => id === 4 ? new Promise(resolve => { resolveContent = resolve; }) : Promise.resolve({ ...content, campaignId: 5, data: { ...content.data, baseFields: [{ ...field, title: 'Campaign 5' }] } }));
    renderTemplates();
    fireEvent.click(screen.getByRole('button', { name: 'Другую кампанию' }));
    expect(await screen.findByDisplayValue('Campaign 5')).toBeInTheDocument();
    await act(async () => { resolveContent(content); });
    expect(screen.queryByDisplayValue('Title')).not.toBeInTheDocument();
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
    fireEvent.change(baseTitle(), { target: { value: 'base draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить виртуальные поля' }));
    await waitFor(() => expect(api.putTemplateVirtualFields).toHaveBeenCalledTimes(1));
    expect(api.putTemplateVirtualFields.mock.calls[0][1]).toMatchObject({ expectedRevision: 11 });
    expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Сохранить виртуальные поля' })).toBeDisabled();
    resolveWrite({ contentRevision: 13, virtualFields: [virtual] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить базовые поля' })).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить базовые поля' }));
      await waitFor(() => expect(api.putTemplateContent).toHaveBeenCalledWith(4, expect.objectContaining({ expectedRevision: 13, description: 'desc' })));
      await api.putTemplateContent.mock.results[0].value;
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Содержимое сохранено.'));
  });
});
