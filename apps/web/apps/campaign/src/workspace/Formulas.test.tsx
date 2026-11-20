import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LosslessNumber } from 'lossless-json';
import Formulas from './Formulas';
import { CampaignApiError } from './api';

const state = vi.hoisted(() => ({ owners: {} as Record<string, boolean>, sessionKey: 'user', canWrite: true, permissionsLoading: false, campaignId: 4, reloadPermissions: vi.fn() }));
const api = vi.hoisted(() => ({ listFormulas: vi.fn(), createFormula: vi.fn(), getFormula: vi.fn(), getFormulaContent: vi.fn(), renameFormula: vi.fn(), putFormulaContent: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: state.sessionKey }), useDirtyDraft: (owner: string, dirty: boolean) => { state.owners[owner] = dirty; return () => { state.owners[owner] = false; }; }, useDirtyState: () => Object.values(state.owners).some(Boolean) }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign: { id: state.campaignId }, permissions: { canWrite: state.canWrite }, permissionsLoading: state.permissionsLoading, reloadPermissions: state.reloadPermissions }) }));

const first = { id: 'formula-a', key: 'key-a', campaignId: 4, name: 'Original', metadataRevision: 3 };
const second = { id: 'formula-b', key: 'key-b', campaignId: 4, name: 'Second', metadataRevision: 8 };
const content = (id = first.id, revision: number | LosslessNumber = 1, expression = 'x + 1', parameters = ['x']) => ({ campaignId: 4, resourceId: id, contentRevision: revision, data: { expression, parameters } });
const formulasTree = () => <MemoryRouter initialEntries={['/4/gm/formulas']}><Routes><Route path=":groupId/gm/formulas" element={<Formulas />} /></Routes></MemoryRouter>;
const renderFormulas = () => render(formulasTree());
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
const openCreate = async () => {
  const button = await screen.findByRole('button', { name: 'Создать формулу' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
};

describe('formula workspace', () => {
  beforeEach(() => {
    state.owners = {}; state.sessionKey = 'user'; state.canWrite = true; state.permissionsLoading = false; state.campaignId = 4; state.reloadPermissions.mockReset();
    Object.values(api).forEach(method => method.mockReset());
    api.listFormulas.mockResolvedValue([first]);
    api.getFormula.mockResolvedValue(first);
    api.getFormulaContent.mockImplementation(async (_campaignId: number, id: string) => content(id));
    api.renameFormula.mockImplementation(async (_campaignId: number, id: string, body: { name: string; expectedRevision: number }) => ({ ...(id === second.id ? second : first), name: body.name, metadataRevision: body.expectedRevision + 1 }));
    api.putFormulaContent.mockImplementation(async (_campaignId: number, id: string, body: { expression: string; parameters: string[]; expectedRevision: number }) => content(id, body.expectedRevision + 1, body.expression, body.parameters));
  });

  it('edits every formula inline, performs no writes until Save, and sends only changed domains with full parameter text', async () => {
    api.listFormulas.mockResolvedValue([first, second]);
    api.getFormulaContent.mockImplementation(async (_campaignId: number, id: string) => content(id, 1, id === first.id ? 'x + 1' : 'y * 2', id === first.id ? ['x'] : ['y']));
    renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    const parameters = screen.getByRole('textbox', { name: 'Параметры формулы Original' });
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Second' })).toHaveValue('y * 2');
    expect(api.getFormula).not.toHaveBeenCalled();
    expect(api.getFormulaContent).toHaveBeenCalledTimes(2);
    fireEvent.change(expression, { target: { value: 'window.__executed = true' } });
    expect((window as Window & { __executed?: boolean }).__executed).toBeUndefined();
    fireEvent.change(parameters, { target: { value: 'one\n\nParent\nparent\n' } });
    fireEvent.blur(parameters);
    expect(api.putFormulaContent).not.toHaveBeenCalled();
    expect(api.renameFormula).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(first.id);
    save();
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenCalledWith(4, first.id, { expression: 'window.__executed = true', parameters: ['one', '', 'Parent', 'parent'], expectedRevision: 1 }));
    expect(api.renameFormula).not.toHaveBeenCalled();
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Second' })).toHaveValue('y * 2');
  });

  it('saves changed name and content domains with their independent returned revisions across saves', async () => {
    api.putFormulaContent.mockImplementation(async (_campaignId: number, id: string, body: { expression: string; parameters: string[]; expectedRevision: number }) => content(id, body.expectedRevision + 1, body.expression, body.parameters));
    renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Название формулы Original' }), { target: { value: 'Renamed' } });
    fireEvent.change(expression, { target: { value: 'x * 3' } });
    save();
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenCalledWith(4, first.id, { expression: 'x * 3', parameters: ['x'], expectedRevision: 1 }));
    expect(api.renameFormula).toHaveBeenCalledWith(4, first.id, { name: 'Renamed', expectedRevision: 3 });
    expect(await screen.findByRole('textbox', { name: 'Название формулы Renamed' })).toHaveValue('Renamed');
    fireEvent.change(screen.getByRole('textbox', { name: 'Выражение формулы Renamed' }), { target: { value: 'x * 4' } });
    save();
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenLastCalledWith(4, first.id, { expression: 'x * 4', parameters: ['x'], expectedRevision: 2 }));
    expect(api.renameFormula).toHaveBeenCalledTimes(1);
  });

  it('preserves large metadata and content revisions without numeric coercion', async () => {
    const metadataRevision = new LosslessNumber('9223372036854775806');
    const contentRevision = new LosslessNumber('9223372036854775805');
    api.listFormulas.mockResolvedValue([{ ...first, metadataRevision }]);
    api.getFormulaContent.mockResolvedValueOnce(content(first.id, contentRevision));
    api.renameFormula.mockResolvedValueOnce({ ...first, name: 'Large revision', metadataRevision: new LosslessNumber('9223372036854775807') });
    api.putFormulaContent.mockResolvedValueOnce(content(first.id, new LosslessNumber('9223372036854775806'), 'changed', ['x']));
    renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Название формулы Original' }), { target: { value: 'Large revision' } });
    fireEvent.change(expression, { target: { value: 'changed' } }); save();
    await waitFor(() => expect(api.renameFormula).toHaveBeenCalledWith(4, first.id, { name: 'Large revision', expectedRevision: metadataRevision }));
    expect(api.putFormulaContent).toHaveBeenCalledWith(4, first.id, { expression: 'changed', parameters: ['x'], expectedRevision: contentRevision });
  });

  it('asks before aggregate cancel and restores confirmed baselines without writes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderFormulas();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Выражение формулы Original' }), { target: { value: 'draft' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Название формулы Original' }), { target: { value: 'Draft name' } });
    expect(Object.values(state.owners).some(Boolean)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(confirm).toHaveBeenCalledWith('Отменить все изменения формул?');
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Original' })).toHaveValue('draft');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(screen.getByRole('textbox', { name: 'Название формулы Original' })).toHaveValue('Original');
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Original' })).toHaveValue('x + 1');
    expect(api.renameFormula).not.toHaveBeenCalled(); expect(api.putFormulaContent).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('keeps formula creation open when native cancellation is declined and closes when accepted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderFormulas();
    await openCreate();
    const dialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Draft create' } });
    const cancelEvent = new Event('cancel', { cancelable: true }); fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith('Отказаться от черновика формулы?');
    expect(screen.getByRole('dialog', { name: 'Создать формулу' })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog', { name: 'Создать формулу' })).not.toBeInTheDocument();
    expect(api.createFormula).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('retains successful rename when content conflicts, blocks retries until reread, then saves with fresh revisions', async () => {
    api.renameFormula.mockResolvedValueOnce({ ...first, name: 'Renamed', metadataRevision: 6 });
    api.putFormulaContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'private detail' }));
    api.getFormula.mockResolvedValueOnce({ ...first, name: 'Server name', metadataRevision: 9 });
    api.getFormulaContent.mockResolvedValueOnce(content(first.id, 1)).mockResolvedValueOnce(content(first.id, 5, 'server expression', ['serverParam']));
    renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Название формулы Original' }), { target: { value: 'Renamed' } });
    fireEvent.change(expression, { target: { value: 'local expression' } });
    save();
    await screen.findByRole('button', { name: 'Перечитать формулу Renamed' });
    expect(await screen.findByText('Часть изменений сохранена. Остальные изменения остались в черновике.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Название формулы Renamed' })).toHaveValue('Renamed');
    expect(expression).toHaveValue('local expression');
    save();
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать формулу Renamed' }));
    await waitFor(() => expect(api.getFormula).toHaveBeenCalledWith(4, first.id));
    expect(await screen.findByRole('textbox', { name: 'Название формулы Server name' })).toHaveValue('Server name');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled());
    expect(expression).toHaveValue('local expression');
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    save();
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenLastCalledWith(4, first.id, { expression: 'local expression', parameters: ['x'], expectedRevision: 5 }));
    expect(api.renameFormula).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('private detail');
  });

  it('writes multiple changed rows with their own revisions and stops the queue after an earlier failure', async () => {
    api.listFormulas.mockResolvedValue([first, second]);
    api.getFormulaContent.mockImplementation(async (_campaignId: number, id: string) => content(id, id === first.id ? 2 : 7, id === first.id ? 'x + 1' : 'y + 1'));
    api.putFormulaContent.mockImplementation(async (_campaignId: number, id: string, body: { expression: string; parameters: string[]; expectedRevision: number }) => {
      if (id === first.id) throw new CampaignApiError(503, { code: 'unavailable', title: 'Unavailable', detail: 'service unavailable' });
      return content(id, body.expectedRevision + 1, body.expression, body.parameters);
    });
    renderFormulas();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Выражение формулы Original' }), { target: { value: 'first draft' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Выражение формулы Second' }), { target: { value: 'second draft' } });
    save();
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenCalledTimes(1));
    expect(api.putFormulaContent).toHaveBeenCalledWith(4, first.id, { expression: 'first draft', parameters: ['x'], expectedRevision: 2 });
    expect(api.putFormulaContent).not.toHaveBeenCalledWith(4, second.id, expect.anything());
  });

  it('does not cancel a confirmed rename when canceling the remaining failed content draft', async () => {
    api.renameFormula.mockResolvedValueOnce({ ...first, name: 'Confirmed', metadataRevision: 4 });
    api.putFormulaContent.mockRejectedValueOnce(new CampaignApiError(503, { code: 'unavailable', title: 'Unavailable', detail: 'service unavailable' }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderFormulas();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Название формулы Original' }), { target: { value: 'Confirmed' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Выражение формулы Original' }), { target: { value: 'content draft' } });
    save();
    await screen.findByRole('button', { name: 'Отменить' });
    await waitFor(() => expect(screen.getByText('Часть изменений сохранена. Остальные изменения остались в черновике.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(screen.getByRole('textbox', { name: 'Название формулы Confirmed' })).toHaveValue('Confirmed');
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Confirmed' })).toHaveValue('x + 1');
    expect(api.renameFormula).toHaveBeenCalledTimes(1);
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('keeps an unknown content outcome blocked through cancel and failed reread, then accepts a matching server value without replay', async () => {
    api.putFormulaContent.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'write outcome unknown' }, true));
    api.getFormulaContent.mockResolvedValueOnce(content(first.id)).mockRejectedValueOnce(new CampaignApiError(503, { code: 'unavailable', title: 'Unavailable', detail: 'service unavailable' })).mockResolvedValueOnce(content(first.id, 8, 'desired', ['x']));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderFormulas();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Выражение формулы Original' }), { target: { value: 'desired' } });
    save();
    await screen.findByRole('button', { name: 'Перечитать формулу Original' });
    save();
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Original' })).toHaveValue('x + 1');
    expect(screen.getByRole('button', { name: 'Перечитать формулу Original' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать формулу Original' }));
    await waitFor(() => expect(api.getFormulaContent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Перечитать формулу Original' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать формулу Original' }));
    await waitFor(() => expect(api.getFormulaContent).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Выражение формулы Original' })).toHaveValue('desired'));
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('retries initial list errors and distinguishes an empty formula list', async () => {
    api.listFormulas.mockRejectedValueOnce(new CampaignApiError(503, { code: 'unavailable', title: 'Unavailable', detail: 'service unavailable' })).mockResolvedValueOnce([]);
    renderFormulas();
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить загрузку' }));
    expect(await screen.findByText('Формул пока нет.')).toBeInTheDocument();
    expect(api.listFormulas).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed content row visible without preventing other rows from being edited and saved', async () => {
    api.listFormulas.mockResolvedValue([first, second]);
    api.getFormulaContent.mockImplementation(async (_campaignId: number, id: string) => {
      if (id === second.id) throw new CampaignApiError(503, { code: 'unavailable', title: 'Unavailable', detail: 'service unavailable' });
      return content(first.id);
    });
    renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    await screen.findByRole('button', { name: 'Перечитать формулу Second' });
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Second' })).toBeDisabled();
    fireEvent.change(expression, { target: { value: 'updated' } });
    save();
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenCalledWith(4, first.id, { expression: 'updated', parameters: ['x'], expectedRevision: 1 }));
  });

  it('preserves table drafts while creation is opened, canceled, and successfully completed', async () => {
    api.listFormulas.mockResolvedValueOnce([first]).mockResolvedValueOnce([first, second]);
    api.createFormula.mockResolvedValueOnce({ ...second, contentRevision: 1 });
    renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    fireEvent.change(expression, { target: { value: 'table draft' } });
    await openCreate();
    expect(expression).toBeDisabled();
    const dialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(await screen.findByRole('textbox', { name: 'Выражение формулы Original' })).toHaveValue('table draft');
    await openCreate();
    const newDialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    fireEvent.change(within(newDialog).getByLabelText('Название'), { target: { value: 'Second' } });
    fireEvent.change(within(newDialog).getByLabelText('Выражение'), { target: { value: '2 + 2' } });
    fireEvent.change(within(newDialog).getByLabelText('Параметры, по одному в строке'), { target: { value: 'left\nright' } });
    fireEvent.click(within(newDialog).getByRole('button', { name: 'Создать' }));
    expect(await screen.findByRole('textbox', { name: 'Выражение формулы Second' })).toHaveValue('x + 1');
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Original' })).toHaveValue('table draft');
    expect(api.createFormula.mock.calls[0][1].requestId).toEqual(expect.any(String));
    expect(api.createFormula.mock.calls[0][1]).toMatchObject({ name: 'Second', expression: '2 + 2', parameters: ['left', 'right'] });
  });

  it('freezes uncertain creation, retains canceled checking, and looks up the original request once', async () => {
    api.createFormula.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'creation outcome unknown' }, true));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderFormulas();
    await openCreate();
    const dialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Unknown' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await within(dialog).findByRole('button', { name: 'Проверить создание' });
    expect(within(dialog).getByLabelText('Название')).toBeDisabled();
    const requestId = api.createFormula.mock.calls[0][1].requestId;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(screen.getByRole('dialog', { name: 'Создать формулу' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Проверить создание' }));
    await waitFor(() => expect(api.getFormula).toHaveBeenCalledWith(4, requestId));
    await waitFor(() => expect(api.getFormulaContent).toHaveBeenCalledWith(4, requestId));
    expect(api.createFormula).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Создать формулу' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('prevents native dialog dismissal while formula creation is busy', async () => {
    let resolveCreate!: (value: typeof first & { contentRevision: number }) => void;
    api.createFormula.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
    renderFormulas();
    await openCreate();
    const dialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Busy' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(api.createFormula).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeDisabled();
    const cancelEvent = new Event('cancel', { cancelable: true }); fireEvent(dialog, cancelEvent);
    expect(screen.getByRole('dialog', { name: 'Создать формулу' })).toBeInTheDocument();
    resolveCreate({ ...first, id: 'new-formula', name: 'Busy', contentRevision: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Создать формулу' })).not.toBeInTheDocument());
  });

  it('does not write while permissions are loading, read-only, or for a different campaign', async () => {
    state.permissionsLoading = true;
    const view = renderFormulas();
    expect(await screen.findByRole('textbox', { name: 'Выражение формулы Original' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Создать формулу' })).toBeDisabled();
    state.permissionsLoading = false; state.canWrite = false; view.rerender(formulasTree());
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Original' })).toBeDisabled();
    state.canWrite = true; state.campaignId = 99; view.rerender(formulasTree());
    expect(screen.getByRole('textbox', { name: 'Название формулы Original' })).toBeDisabled();
    expect(api.renameFormula).not.toHaveBeenCalled(); expect(api.putFormulaContent).not.toHaveBeenCalled();
  });

  it('stops between accepted domain writes when live write permission is revoked', async () => {
    let resolveRename!: (value: typeof first) => void;
    api.renameFormula.mockReturnValueOnce(new Promise(resolve => { resolveRename = resolve; }));
    const view = renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Название формулы Original' }), { target: { value: 'Renamed' } });
    fireEvent.change(expression, { target: { value: 'pending content' } });
    save();
    await waitFor(() => expect(api.renameFormula).toHaveBeenCalledTimes(1));
    state.canWrite = false;
    view.rerender(formulasTree());
    resolveRename({ ...first, name: 'Renamed', metadataRevision: 4 });
    await waitFor(() => expect(screen.getByText('Часть изменений сохранена. Остальные изменения остались в черновике.')).toBeInTheDocument());
    expect(api.putFormulaContent).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Renamed' })).toHaveValue('pending content');
  });

  it('rechecks campaign permissions after a forbidden write', async () => {
    api.putFormulaContent.mockRejectedValueOnce(new CampaignApiError(403, { code: 'forbidden', title: 'Forbidden', detail: 'write forbidden' }));
    renderFormulas();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Выражение формулы Original' }), { target: { value: 'draft' } });
    save();
    await waitFor(() => expect(state.reloadPermissions).toHaveBeenCalledTimes(1));
  });

  it('keeps conflict drafts blocked until explicit row reread', async () => {
    api.putFormulaContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'revision conflict' }));
    api.getFormula.mockResolvedValueOnce({ ...first, name: 'Server name', metadataRevision: 11 });
    api.getFormulaContent.mockResolvedValueOnce(content(first.id)).mockResolvedValueOnce(content(first.id, 9, 'server', ['server']));
    renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    fireEvent.change(expression, { target: { value: 'local draft' } }); save();
    await screen.findByRole('button', { name: 'Перечитать формулу Original' });
    expect(api.listFormulas).toHaveBeenCalledTimes(1);
    expect(api.getFormulaContent).toHaveBeenCalledTimes(1);
    expect(expression).toHaveValue('local draft');
    save();
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Перечитать формулу Original' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать формулу Original' }));
    await waitFor(() => expect(api.getFormula).toHaveBeenCalledWith(4, first.id));
    expect(await screen.findByRole('textbox', { name: 'Название формулы Server name' })).toHaveValue('Server name');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled());
    expect(expression).toHaveValue('local draft');
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Перечитать формулу Server name' })).not.toBeInTheDocument();
  });

  it('prevents duplicate saves and edits while a write is pending', async () => {
    let resolveSave!: (value: ReturnType<typeof content>) => void;
    api.putFormulaContent.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve; }));
    renderFormulas();
    const expression = await screen.findByRole('textbox', { name: 'Выражение формулы Original' });
    fireEvent.change(expression, { target: { value: 'pending' } });
    save();
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenCalledTimes(1));
    expect(expression).toBeDisabled();
    save();
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    resolveSave(content(first.id, 2, 'pending', ['x']));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Выражение формулы Original' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('ignores a pending write result from a previous session identity', async () => {
    let resolveRename!: (value: typeof first) => void;
    api.listFormulas.mockImplementation(async () => state.sessionKey === 'session-b' ? [second] : [first]);
    api.getFormulaContent.mockImplementation(async (_campaignId: number, id: string) => content(id, 1, id === second.id ? 'new session value' : 'old session value'));
    api.renameFormula.mockReturnValueOnce(new Promise(resolve => { resolveRename = resolve; }));
    const view = renderFormulas();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Название формулы Original' }), { target: { value: 'Old session rename' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Выражение формулы Original' }), { target: { value: 'old pending content' } });
    save();
    await waitFor(() => expect(api.renameFormula).toHaveBeenCalledTimes(1));
    state.sessionKey = 'session-b'; view.rerender(formulasTree());
    expect(await screen.findByRole('textbox', { name: 'Выражение формулы Second' })).toHaveValue('new session value');
    resolveRename({ ...first, name: 'Old session rename', metadataRevision: 4 });
    await waitFor(() => expect(api.putFormulaContent).not.toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: 'Выражение формулы Second' })).toHaveValue('new session value');
  });
});
