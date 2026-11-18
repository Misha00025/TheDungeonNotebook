import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Views from './Views';
import { CampaignApiError } from './api';
import { parseJson, stringifyJson } from './json';

const api = vi.hoisted(() => ({ listViews: vi.fn(), getView: vi.fn(), getViewContent: vi.fn(), getViewSources: vi.fn(), listCharacters: vi.fn(), createView: vi.fn(), renameView: vi.fn(), putViewContent: vi.fn(), getPresentation: vi.fn(), putPresentation: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: 'session', invalidation: 0, notifyInvalidation: vi.fn() }), useDirtyState: () => false, useDirtyDraft: () => vi.fn() }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ permissions: { canRead: true, canWrite: true, canManageAccess: false }, lastKnownPermissions: { canRead: true, canWrite: true, canManageAccess: false }, permissionsLoading: false, mode: 'gm' }) }));

const view = { id: '11111111-1111-1111-1111-111111111111', key: '11111111111111111111111111111111', campaignId: 4, name: 'Current', metadataRevision: 2 };
const content = { campaignId: 4, resourceId: view.id, contentRevision: 3, data: { roots: [{ kind: 'widget', nodeKey: 'w', title: 'Saved title', params: parseJson('{"future":9007199254740993}'), children: [{ kind: 'layout', nodeKey: 'inner', title: 'Nested', params: null, children: [] }], sources: [], format: 'opaque' }] } };
const characterId = '22222222-2222-2222-2222-222222222222';
const renderPage = () => render(<MemoryRouter initialEntries={['/4/gm/views']}><Routes><Route path=":groupId/gm/views" element={<Views />} /></Routes></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  api.listViews.mockResolvedValue([view]); api.getView.mockResolvedValue(view); api.getViewContent.mockResolvedValue(content);
  api.listCharacters.mockResolvedValue([{ id: characterId, name: 'Hero' }]);
  api.getViewSources.mockResolvedValue({ viewContentRevision: 3, widgets: [{ nodeKey: 'w', sources: [] }] });
  api.getPresentation.mockResolvedValue({ contentRevision: 0, defaults: {}, contextParams: {} });
});

describe('Views workspace', () => {
  it('shows view names in selectors while preserving opaque option values', async () => {
    renderPage();
    const select = await screen.findByLabelText('Выбранное представление') as HTMLSelectElement;
    expect(within(select).getByRole('option', { name: 'Current' })).toHaveValue(view.id);
    expect(document.body.textContent).not.toContain(view.id);
    expect(document.body.textContent).not.toContain(view.key);
  });

  it('renders the nested tree editor and previews only saved content for selected characters', async () => {
    renderPage(); fireEvent.change(await screen.findByLabelText('Выбранное представление'), { target: { value: view.id } });
    expect(await screen.findByDisplayValue('Saved title')).toBeTruthy();
    expect(screen.getAllByLabelText('Заголовок')).toHaveLength(2);
    fireEvent.change(await screen.findByLabelText('Персонаж'), { target: { value: characterId } });
    fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр сохранённой версии' }));
    expect(await screen.findByText('Saved title')).toBeTruthy();
    expect(api.getViewSources).toHaveBeenCalledWith(4, view.id, characterId);
    expect(api.putViewContent).not.toHaveBeenCalled(); expect(api.renameView).not.toHaveBeenCalled();
  });

  it('retains a content draft after revision conflict and requires a fresh snapshot', async () => {
    api.putViewContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'conflict', title: 'Conflict', detail: 'Conflict' }));
    const privateId = '99999999-9999-4999-8999-999999999999';
    api.getViewContent.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, data: { roots: [{ ...content.data.roots[0], title: privateId, params: parseJson(`{"private":"${privateId}"}`) }] } });
    renderPage(); fireEvent.change(await screen.findByLabelText('Выбранное представление'), { target: { value: view.id } });
    fireEvent.change(await screen.findByDisplayValue('Saved title'), { target: { value: 'Draft title' } });
    fireEvent.click(screen.getByText('Сохранить содержимое'));
    expect(await screen.findByText('Перечитать содержимое')).toBeTruthy();
    expect(screen.getByDisplayValue('Draft title')).toBeTruthy();
    fireEvent.click(screen.getByText('Перечитать содержимое'));
    await waitFor(() => expect(api.getViewContent).toHaveBeenCalledTimes(2));
    expect(screen.getByDisplayValue('Draft title')).toBeTruthy();
    expect(screen.getByText('Актуальная версия загружена. Черновик сохранён.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(privateId);
    expect(document.body.textContent).not.toContain('private');
    expect(api.putViewContent).toHaveBeenCalledTimes(1);
  });

  it('saves metadata and tree as independent revisioned sections', async () => {
    api.renameView.mockResolvedValue({ ...view, name: 'Renamed', metadataRevision: 4 });
    api.putViewContent.mockResolvedValue({ ...content, contentRevision: 5 });
    renderPage(); fireEvent.change(await screen.findByLabelText('Выбранное представление'), { target: { value: view.id } });
    fireEvent.change(await screen.findByLabelText('Название', { selector: 'input' }), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByText('Сохранить название'));
    await waitFor(() => expect(api.renameView).toHaveBeenCalledWith(4, view.id, { name: 'Renamed', expectedRevision: 2 }));
    expect(api.putViewContent).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByDisplayValue('Saved title'), { target: { value: 'Tree edit' } });
    fireEvent.click(screen.getByText('Сохранить содержимое'));
    await waitFor(() => expect(api.putViewContent).toHaveBeenCalledWith(4, view.id, expect.objectContaining({ expectedRevision: 3 })));
    expect(stringifyJson(api.putViewContent.mock.calls[0][2].roots[0].params)).toContain('9007199254740993');
  });

  it('saves selector-free Base and Virtual sources and retains the draft after invalid_source', async () => {
    api.putViewContent.mockRejectedValueOnce(new CampaignApiError(400, { code: 'invalid_source', title: 'Invalid source', detail: 'The source is invalid.' }));
    renderPage();
    fireEvent.change(await screen.findByLabelText('Выбранное представление'), { target: { value: view.id } });
    const widget = await screen.findByLabelText('Узел Saved title');
    fireEvent.click(within(widget).getByRole('button', { name: 'Добавить источник' }));
    fireEvent.change(screen.getAllByLabelText('Field ID')[0], { target: { value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } });
    fireEvent.click(within(widget).getByRole('button', { name: 'Добавить источник' }));
    fireEvent.change(screen.getAllByLabelText('Вид')[1], { target: { value: 'Virtual' } });
    fireEvent.change(screen.getAllByLabelText('Field ID')[1], { target: { value: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } });
    fireEvent.change(within(within(widget).getByRole('group', { name: 'Поля узла Saved title' })).getByLabelText('Заголовок'), { target: { value: 'Draft widget' } });
    fireEvent.click(screen.getByText('Сохранить содержимое'));
    expect(await screen.findByText('Проверьте введённые данные.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('invalid_source');
    expect(document.body.textContent).not.toContain('The source is invalid.');
    expect(api.putViewContent).toHaveBeenCalledTimes(1);
    const body = api.putViewContent.mock.calls[0][2];
    expect(body.roots[0].sources).toEqual([{ kind: 'Base', fieldId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, { kind: 'Virtual', fieldId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }]);
    expect(body.roots[0].params).toEqual(parseJson('{"future":9007199254740993}'));
    expect(body.roots[0].sources[0]).not.toHaveProperty('templateId');
    expect(screen.getByDisplayValue('Draft widget')).toBeInTheDocument();
    expect(screen.getByDisplayValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeInTheDocument();
    expect(screen.getByDisplayValue('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBeInTheDocument();
    expect(api.putViewContent).toHaveBeenCalledTimes(1);
    api.putViewContent.mockImplementationOnce(async (_campaignId: number, _viewId: string, submitted: { roots: typeof body.roots }) => ({ ...content, contentRevision: 4, data: { roots: submitted.roots } }));
    fireEvent.change(screen.getAllByLabelText('Field ID')[0], { target: { value: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } });
    fireEvent.click(screen.getByText('Сохранить содержимое'));
    await waitFor(() => expect(api.putViewContent).toHaveBeenCalledTimes(2));
    expect(api.putViewContent.mock.calls[0][2].roots[0].sources).toEqual([{ kind: 'Base', fieldId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, { kind: 'Virtual', fieldId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }]);
    expect(api.putViewContent.mock.calls[1][2].roots[0].sources).toEqual([{ kind: 'Base', fieldId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, { kind: 'Virtual', fieldId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }]);
  });

  it('preserves arbitrary context params, revision zero, and removes a default without deleting params', async () => {
    const params = parseJson('[null,9007199254740993]');
    api.getPresentation.mockResolvedValue({ contentRevision: 0, defaults: { 'future/context': view.key }, contextParams: { 'future/context': params } });
    api.putPresentation.mockResolvedValue({ contentRevision: 1, defaults: {}, contextParams: { 'future/context': params } });
    renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Настройки представления кампании' }));
    const select = await screen.findByLabelText('Представление');
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByText('Сохранить конфигурацию'));
    await waitFor(() => expect(api.putPresentation).toHaveBeenCalled());
    expect(api.putPresentation.mock.calls[0][1]).toMatchObject({ expectedRevision: 0, defaults: {} });
    expect(stringifyJson(api.putPresentation.mock.calls[0][1].contextParams)).toContain('9007199254740993');
  });

  it('blocks invalid raw context JSON from being saved', async () => {
    api.getPresentation.mockResolvedValue({ contentRevision: 0, defaults: {}, contextParams: { odd: null } });
    renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Настройки представления кампании' }));
    fireEvent.change(await screen.findByLabelText('Параметры контекста (JSON)'), { target: { value: '{bad' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Некорректный JSON. Проверьте параметры.');
    expect(screen.getByRole('alert').textContent).not.toContain('position');
    fireEvent.click(screen.getByText('Сохранить конфигурацию'));
    expect(api.putPresentation).not.toHaveBeenCalled();
  });

  it('tracks an unblurred context-key draft and restores it on cancel', async () => {
    api.getPresentation.mockResolvedValue({ contentRevision: 0, defaults: {}, contextParams: { original: null } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Настройки представления кампании' }));
    const key = await screen.findByLabelText('Ключ контекста');
    fireEvent.change(key, { target: { value: 'uncommitted' } });
    const cancel = screen.getByText('Отменить') as HTMLButtonElement;
    expect(cancel.disabled).toBe(false);
    fireEvent.click(cancel);
    await waitFor(() => expect((screen.getByLabelText('Ключ контекста') as HTMLInputElement).value).toBe('original'));
    expect(api.putPresentation).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('commits a context-key rename without dropping its assigned view or exact params', async () => {
    const params = parseJson('[null,9007199254740993]');
    api.getPresentation.mockResolvedValue({ contentRevision: 2, defaults: { original: view.key }, contextParams: { original: params } });
    api.putPresentation.mockResolvedValue({ contentRevision: 3, defaults: { renamed: view.key }, contextParams: { renamed: params } });
    renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Настройки представления кампании' }));
    const key = await screen.findByLabelText('Ключ контекста');
    fireEvent.change(key, { target: { value: 'renamed' } });
    fireEvent.blur(key);
    fireEvent.click(screen.getByText('Сохранить конфигурацию'));
    await waitFor(() => expect(api.putPresentation).toHaveBeenCalled());
    const body = api.putPresentation.mock.calls[0][1];
    expect(body.defaults).toEqual({ renamed: view.key });
    expect(body.contextParams).not.toHaveProperty('original');
    expect(stringifyJson(body.contextParams.renamed)).toContain('9007199254740993');
  });

  it('does not repost uncertain view creation and checks using the original UUID', async () => {
    api.createView.mockRejectedValue(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'Unknown' }, true));
    api.getView.mockRejectedValue(new Error('Not found'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Создать представление' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать представление' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'New view' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await within(dialog).findByRole('button', { name: 'Проверить создание' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(confirm).toHaveBeenCalledWith('Результат создания неизвестен. Отказаться от проверки и оставить созданное представление в списке?');
    expect(screen.getByRole('dialog', { name: 'Создать представление' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Проверить создание' }));
    await waitFor(() => expect(api.createView).toHaveBeenCalledTimes(1));
    const request = api.createView.mock.calls[0][1];
    expect(api.getView).toHaveBeenCalledWith(4, request.requestId);
    expect(api.createView.mock.calls[0][1].roots).toEqual([]);
    expect(screen.getByRole('dialog', { name: 'Создать представление' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('keeps a rejected view modal cancel open and closes after confirmed cancellation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Создать представление' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать представление' });
    const name = within(dialog).getByLabelText('Название');
    fireEvent.change(name, { target: { value: 'Draft view' } });
    const cancelEvent = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith('Отказаться от черновика представления?');
    expect(screen.getByRole('dialog', { name: 'Создать представление' })).toBeInTheDocument();
    expect(name).toHaveValue('Draft view');
    confirm.mockReturnValue(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog', { name: 'Создать представление' })).not.toBeInTheDocument();
    expect(api.createView).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('blocks view modal dismissal while creation is busy and closes after success', async () => {
    let resolveCreate!: (value: typeof view & { contentRevision: number }) => void;
    api.createView.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
    renderPage(); fireEvent.click(await screen.findByRole('button', { name: 'Создать представление' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать представление' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Busy view' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(api.createView).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeDisabled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog', { name: 'Создать представление' })).toBeInTheDocument();
    resolveCreate({ ...view, contentRevision: 3 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Создать представление' })).not.toBeInTheDocument());
    expect(api.createView).toHaveBeenCalledTimes(1);
    expect(api.createView.mock.calls[0][1].roots).toEqual([]);
  });

  it('rejects mixed preview revisions and displays preview errors', async () => {
    api.getViewSources.mockResolvedValue({ viewContentRevision: 1, widgets: [] });
    renderPage(); fireEvent.change(await screen.findByLabelText('Выбранное представление'), { target: { value: view.id } });
    fireEvent.change(await screen.findByLabelText('Персонаж'), { target: { value: characterId } });
    fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр сохранённой версии' }));
    expect(await screen.findByText('Не удалось выполнить операцию. Попробуйте ещё раз.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('ревизии содержимого предпросмотра не совпадают');
    expect(screen.queryByText('Saved title')).toBeNull();
    expect(api.renameView).not.toHaveBeenCalled(); expect(api.putViewContent).not.toHaveBeenCalled();
  });

  it('ignores a preview response after the selected character changes', async () => {
    const secondId = '33333333-3333-3333-3333-333333333333';
    let resolveOld!: (value: unknown) => void;
    const oldResult = new Promise(resolve => { resolveOld = resolve; });
    api.listCharacters.mockResolvedValue([{ id: characterId, name: 'Hero' }, { id: secondId, name: 'Other' }]);
    api.getViewContent.mockResolvedValue({ ...content, data: { roots: [{ ...content.data.roots[0], format: '$1' }] } });
    api.getViewSources.mockImplementation((_campaignId: number, _viewId: string, selected: string) => selected === characterId ? oldResult : Promise.resolve({ viewContentRevision: 3, widgets: [{ nodeKey: 'w', sources: [{ sourceIndex: 0, source: { kind: 'Base', fieldId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, value: 'New character', diagnostic: null }] }] }));
    renderPage(); fireEvent.change(await screen.findByLabelText('Выбранное представление'), { target: { value: view.id } });
    const chooser = await screen.findByLabelText('Персонаж');
    fireEvent.change(chooser, { target: { value: characterId } });
    fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр сохранённой версии' }));
    fireEvent.change(chooser, { target: { value: secondId } });
    fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр сохранённой версии' }));
    expect(await screen.findByText('New character')).toBeTruthy();
    resolveOld({ viewContentRevision: 3, widgets: [{ nodeKey: 'w', sources: [{ source: { kind: 'Base', fieldId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, sourceIndex: 0, value: 'Stale character', diagnostic: null }] }] });
    await waitFor(() => expect(screen.queryByText('Stale character')).toBeNull());
    expect(screen.getByText('New character')).toBeTruthy();
  });
});
