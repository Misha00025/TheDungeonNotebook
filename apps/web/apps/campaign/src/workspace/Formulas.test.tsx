import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Formulas from './Formulas';
import { CampaignApiError } from './api';

const state = vi.hoisted(() => ({ owners: {} as Record<string, boolean> }));
const api = vi.hoisted(() => ({ listFormulas: vi.fn(), createFormula: vi.fn(), getFormula: vi.fn(), getFormulaContent: vi.fn(), renameFormula: vi.fn(), putFormulaContent: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: 'user', invalidation: 0, notifyInvalidation: vi.fn() }), useDirtyDraft: (owner: string, dirty: boolean) => { state.owners[owner] = dirty; return () => { state.owners[owner] = false; }; }, useDirtyState: () => Object.values(state.owners).some(Boolean) }));
vi.mock('./Shell', () => ({ useCampaignWorkspace: () => ({ campaign: { id: 4 }, permissions: { canWrite: true }, permissionsLoading: false }) }));

const formula = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', campaignId: 4, name: 'Original', metadataRevision: 3 };
const content = (revision = 1, expression = 'x + 1', parameters = ['x']) => ({ campaignId: 4, resourceId: formula.id, contentRevision: revision, data: { expression, parameters } });
const formulasTree = () => <MemoryRouter initialEntries={['/4/gm/formulas']}><Routes><Route path=":groupId/gm/formulas" element={<Formulas />} /></Routes></MemoryRouter>;
const renderFormulas = () => render(formulasTree());

describe('formula workspace', () => {
  beforeEach(() => {
    state.owners = {};
    Object.values(api).forEach(method => method.mockReset());
    api.listFormulas.mockResolvedValue([formula]);
    api.getFormula.mockResolvedValue(formula);
    api.getFormulaContent.mockResolvedValue(content());
    api.renameFormula.mockImplementation(async (_campaignId: number, _id: string, body: { name: string; expectedRevision: number }) => ({ ...formula, name: body.name, metadataRevision: body.expectedRevision + 1 }));
    api.putFormulaContent.mockImplementation(async (_campaignId: number, _id: string, body: { expression: string; parameters: string[]; expectedRevision: number }) => content(body.expectedRevision + 1, body.expression, body.parameters));
  });

  it('keeps create drafts independent from selected editor drafts and never evaluates expressions', async () => {
    api.createFormula.mockResolvedValueOnce({ ...formula, name: 'New formula', contentRevision: 1 });
    renderFormulas();
    fireEvent.change(await screen.findByLabelText('Выбранная формула'), { target: { value: formula.id } });
    const expression = await screen.findByLabelText('Выражение');
    fireEvent.change(expression, { target: { value: 'window.__executed = true' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать формулу' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    const createExpression = within(dialog).getByLabelText('Выражение');
    expect(createExpression).not.toBe(expression);
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'New formula' } });
    fireEvent.change(createExpression, { target: { value: '2 + 2' } });
    fireEvent.change(within(dialog).getByLabelText('Параметры, по одному в строке'), { target: { value: 'left\nright' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(api.createFormula).toHaveBeenCalled());
    expect(api.createFormula.mock.calls[0][1]).toMatchObject({ name: 'New formula', expression: '2 + 2', parameters: ['left', 'right'] });
    expect(api.putFormulaContent).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Создать формулу' })).not.toBeInTheDocument());
  });

  it('saves content through revisions independently from metadata', async () => {
    renderFormulas();
    fireEvent.change(await screen.findByLabelText('Выбранная формула'), { target: { value: formula.id } });
    fireEvent.change(await screen.findByLabelText('Выражение'), { target: { value: 'x * 3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить содержимое' }));
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenCalledWith(4, formula.id, { expression: 'x * 3', parameters: ['x'], expectedRevision: 1 }));
    fireEvent.change(screen.getByLabelText('Выражение'), { target: { value: 'x * 4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить содержимое' }));
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenLastCalledWith(4, formula.id, { expression: 'x * 4', parameters: ['x'], expectedRevision: 2 }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить название' }));
    await waitFor(() => expect(api.renameFormula).toHaveBeenCalledWith(4, formula.id, { name: 'Renamed', expectedRevision: 3 }));
    expect(api.putFormulaContent).toHaveBeenCalledTimes(2);
  });

  it('preserves conflict drafts until an explicit latest read and then requires explicit Save', async () => {
    api.putFormulaContent.mockRejectedValueOnce(new CampaignApiError(409, { code: 'content_revision_conflict', title: 'Conflict', detail: 'Conflict' }));
    api.getFormulaContent.mockResolvedValueOnce(content()).mockResolvedValueOnce(content(5, 'server value', ['serverParam']));
    renderFormulas();
    fireEvent.change(await screen.findByLabelText('Выбранная формула'), { target: { value: formula.id } });
    const expression = await screen.findByLabelText('Выражение');
    fireEvent.change(expression, { target: { value: 'my draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить содержимое' }));
    await screen.findByRole('button', { name: 'Перечитать содержимое' });
    expect(expression).toHaveValue('my draft');
    fireEvent.submit(expression.closest('form')!);
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Перечитать содержимое' }));
    await screen.findByText('server value');
    expect(expression).toHaveValue('my draft');
    expect(api.putFormulaContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить содержимое' }));
    await waitFor(() => expect(api.putFormulaContent).toHaveBeenLastCalledWith(4, formula.id, { expression: 'my draft', parameters: ['x'], expectedRevision: 5 }));
  });

  it('freezes uncertain creation until explicit lookup and guards selection changes', async () => {
    api.createFormula.mockRejectedValueOnce(new CampaignApiError(0, { code: 'unknown_outcome', title: 'Unknown', detail: 'Unknown' }, true));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const view = renderFormulas();
    fireEvent.change(await screen.findByLabelText('Выбранная формула'), { target: { value: formula.id } });
    await screen.findByLabelText('Выражение');
    state.owners['fixture-unsaved-draft'] = true;
    view.rerender(formulasTree());
    fireEvent.change(screen.getByLabelText('Выбранная формула'), { target: { value: '' } });
    expect(confirm).toHaveBeenCalled();
    expect((screen.getByLabelText('Выбранная формула') as HTMLSelectElement).value).toBe(formula.id);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Создать формулу' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Unknown result' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await within(dialog).findByRole('button', { name: 'Проверить создание' });
    expect(within(dialog).getByLabelText('Название')).toBeDisabled();
    expect(api.createFormula).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
    expect(confirm).toHaveBeenLastCalledWith('Результат создания формулы неизвестен. Отказаться от проверки? Формула может существовать.');
    expect(screen.getByRole('dialog', { name: 'Создать формулу' })).toBeInTheDocument();
    const requestId = api.createFormula.mock.calls[0][1].requestId;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Проверить создание' }));
    await waitFor(() => expect(api.getFormula).toHaveBeenCalledWith(4, requestId));
    expect(api.getFormulaContent).toHaveBeenCalledWith(4, requestId);
    expect(api.createFormula).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Создать формулу' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('keeps a rejected native cancel open and closes on confirmed cancellation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderFormulas();
    fireEvent.click(await screen.findByRole('button', { name: 'Создать формулу' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    const name = within(dialog).getByLabelText('Название');
    fireEvent.change(name, { target: { value: 'Draft formula' } });
    const cancelEvent = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith('Отказаться от черновика формулы?');
    expect(screen.getByRole('dialog', { name: 'Создать формулу' })).toBeInTheDocument();
    expect(name).toHaveValue('Draft formula');
    confirm.mockReturnValue(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog', { name: 'Создать формулу' })).not.toBeInTheDocument();
    expect(api.createFormula).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('blocks formula modal dismissal while the create request is busy', async () => {
    let resolveCreate!: (value: typeof formula) => void;
    api.createFormula.mockReturnValueOnce(new Promise(resolve => { resolveCreate = resolve; }));
    renderFormulas();
    fireEvent.click(await screen.findByRole('button', { name: 'Создать формулу' }));
    const dialog = await screen.findByRole('dialog', { name: 'Создать формулу' });
    fireEvent.change(within(dialog).getByLabelText('Название'), { target: { value: 'Busy formula' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(api.createFormula).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeDisabled();
    const cancelEvent = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(screen.getByRole('dialog', { name: 'Создать формулу' })).toBeInTheDocument();
    resolveCreate(formula);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Создать формулу' })).not.toBeInTheDocument());
    expect(api.createFormula).toHaveBeenCalledTimes(1);
  });

  it('confirms canceling the formula content draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderFormulas();
    fireEvent.change(await screen.findByLabelText('Выбранная формула'), { target: { value: formula.id } });
    const expression = await screen.findByLabelText('Выражение');
    fireEvent.change(expression, { target: { value: 'draft' } });
    fireEvent.click(within(expression.closest('form')!).getByRole('button', { name: 'Отменить' }));
    expect(confirm).toHaveBeenCalledWith('Отменить черновик содержимого?');
    expect(expression).toHaveValue('draft');
    confirm.mockReturnValue(true);
    fireEvent.click(within(expression.closest('form')!).getByRole('button', { name: 'Отменить' }));
    expect(expression).toHaveValue('x + 1');
    confirm.mockRestore();
  });
});
