import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CharacterVirtuals } from './CharacterVirtuals';
import type { Revision, VirtualFieldInput } from './types';

const state = vi.hoisted(() => ({ dirty: false }));
const api = vi.hoisted(() => ({ getCustomVirtualFields: vi.fn(), getOverrides: vi.fn(), listFormulas: vi.fn(), getTemplateVirtualFields: vi.fn(), putCustomVirtualFields: vi.fn(), putOverride: vi.fn(), resetOverride: vi.fn(), getFormulaContent: vi.fn() }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api, sessionKey: 'user-1' }), useDirtyDraft: (_owner: string, dirty: boolean) => { state.dirty = dirty; } }));

const baseFields = [{ id: 'base-id', key: 'base', title: 'Base', description: '', valueType: 'Integer' as const, typeRevision: 1, options: [], effectiveValue: 0, isExplicit: false }];
const templateField = { id: 'template-field', key: 'temp', title: 'Template field', description: '', resultType: 'Number' as const, formulaId: 'formula-id', bindings: { source: { kind: 'Base' as const, fieldId: 'base-id' } } };
const computed = [{ id: 'template-field', key: 'temp', title: 'Template field', description: '', resultType: 'Number' as const, value: 0, diagnostic: null }];
const custom = { contentRevision: 4, virtualFields: [{ id: 'custom-saved', key: 'custom', title: 'Custom field', description: '', resultType: 'Number' as const, formulaId: 'formula-id', bindings: {} }] };
const writeContent = async <T extends { contentRevision: Revision }>(operation: (revision: Revision) => Promise<T>, confirmed: (result: T) => void) => { const result = await operation(7); confirmed(result); };
const renderPanel = (overrides: Partial<React.ComponentProps<typeof CharacterVirtuals>> = {}) => render(<CharacterVirtuals campaignId={12} characterId="char-id" baseFields={baseFields} virtualFields={computed} canWrite={true} busy={false} blocked={false} write={writeContent} {...overrides} />);
const openPanel = async () => { renderPanel(); fireEvent.click(screen.getByRole('button', { name: 'Индивидуальные формулы' })); await screen.findByRole('heading', { name: 'Индивидуальные формулы' }); };

describe('CharacterVirtuals', () => {
  beforeEach(() => {
    state.dirty = false;
    Object.values(api).forEach(method => method.mockReset());
    api.getCustomVirtualFields.mockResolvedValue(custom);
    api.getOverrides.mockResolvedValue({ contentRevision: 4, overrides: [] });
    api.listFormulas.mockResolvedValue([]);
    api.getFormulaContent.mockResolvedValue({ data: { expression: '', parameters: [] } });
    api.getTemplateVirtualFields.mockResolvedValue({ contentRevision: 3, virtualFields: [templateField] });
    api.putCustomVirtualFields.mockImplementation(async (_campaign: number, _character: string, body: { expectedRevision: Revision; virtualFields: VirtualFieldInput[] }) => ({ contentRevision: 8, virtualFields: body.virtualFields.map((field: VirtualFieldInput, index: number) => ({ ...field, id: field.id ?? `created-${index}` })) }));
    api.putOverride.mockResolvedValue({ contentRevision: 8 });
    api.resetOverride.mockResolvedValue({ contentRevision: 8 });
  });

  it('defers custom, override, formula, and template requests until the editor opens', async () => {
    renderPanel();
    expect(api.getCustomVirtualFields).not.toHaveBeenCalled();
    expect(api.getOverrides).not.toHaveBeenCalled();
    expect(api.listFormulas).not.toHaveBeenCalled();
    expect(api.getTemplateVirtualFields).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Индивидуальные формулы' }));
    await screen.findByRole('heading', { name: 'Индивидуальные формулы' });
    await waitFor(() => expect(api.getCustomVirtualFields).toHaveBeenCalledWith(12, 'char-id'));
    expect(api.getTemplateVirtualFields).toHaveBeenCalledTimes(1);
    expect(api.getTemplateVirtualFields).toHaveBeenCalledWith(12);
    expect(api.getTemplateVirtualFields.mock.calls[0]).toEqual([12]);
  });

  it('allows a character writer with a shared revision even when campaign editing is unavailable', async () => {
    api.getTemplateVirtualFields.mockRejectedValue({ status: 403 });
    await openPanel();
    await screen.findByLabelText('Ключ');
    fireEvent.change(screen.getByLabelText('Название', { selector: 'input' }), { target: { value: 'Edited custom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить индивидуальные поля' }));
    await waitFor(() => expect(api.putCustomVirtualFields).toHaveBeenCalled());
    expect(api.putCustomVirtualFields.mock.calls[0][2].expectedRevision).toBe(7);
    expect(api.putCustomVirtualFields.mock.calls[0][2].virtualFields[0].id).toBe('custom-saved');
  });

  it('keeps manual formula and source controls available when definitions are forbidden', async () => {
    api.listFormulas.mockRejectedValue({ status: 403 });
    api.getTemplateVirtualFields.mockRejectedValue({ status: 403 });
    await openPanel();
    expect(await screen.findByText('Добавить связь вручную')).toBeInTheDocument();
    expect(screen.getByLabelText('ID формулы')).toBeInTheDocument();
    expect(screen.getByLabelText('Тип источника')).toBeInTheDocument();
  });

  it('preserves manual Base and Virtual source kinds and parent selectors', async () => {
    api.listFormulas.mockRejectedValue({ status: 403 });
    api.getTemplateVirtualFields.mockRejectedValue({ status: 403 });
    await openPanel();
    const manual = await screen.findByRole('group', { name: 'Добавить связь вручную' });
    fireEvent.change(within(manual).getByLabelText('Имя параметра'), { target: { value: 'baseParam' } });
    fireEvent.change(within(manual).getByLabelText('Тип источника'), { target: { value: 'Base' } });
    fireEvent.change(within(manual).getByLabelText('ID поля'), { target: { value: 'base-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить связь' }));
    const manualAgain = screen.getByRole('group', { name: 'Добавить связь вручную' });
    fireEvent.change(within(manualAgain).getByLabelText('Имя параметра'), { target: { value: 'virtualParam' } });
    fireEvent.change(within(manualAgain).getByLabelText('Тип источника'), { target: { value: 'Virtual' } });
    fireEvent.change(within(manualAgain).getByLabelText('ID поля'), { target: { value: 'template-field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить связь' }));
    expect(screen.getByLabelText('Родитель')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить индивидуальные поля' }));
    await waitFor(() => expect(api.putCustomVirtualFields).toHaveBeenCalled());
    expect(api.putCustomVirtualFields.mock.calls[0][2].virtualFields[0].bindings).toEqual({ baseParam: { kind: 'Base', fieldId: 'base-id' }, virtualParam: { kind: 'Virtual', fieldId: 'template-field' } });
  });

  it('uses lossless structured custom data and updates the saved identity from the PUT result', async () => {
    api.getTemplateVirtualFields.mockRejectedValue({ status: 403 });
    await openPanel();
    await screen.findByLabelText('Ключ');
    fireEvent.click(screen.getByRole('button', { name: 'Добавить виртуальное поле' }));
    fireEvent.change(screen.getAllByLabelText('Ключ')[1], { target: { value: 'new-custom' } });
    fireEvent.change(screen.getAllByLabelText('Название')[1], { target: { value: 'New custom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить индивидуальные поля' }));
    await waitFor(() => expect(api.putCustomVirtualFields).toHaveBeenCalled());
    expect(api.putCustomVirtualFields.mock.calls[0][2].virtualFields[1]).not.toHaveProperty('id');
    expect(screen.getByDisplayValue('new-custom')).toBeDisabled();
    expect(screen.getByDisplayValue('New custom')).toBeInTheDocument();
  });

  it('saves an override expression using the shared revision', async () => {
    await openPanel();
    const override = await screen.findByRole('group', { name: 'Переопределение template-field' });
    const expression = within(override).getByLabelText('Формула');
    fireEvent.change(expression, { target: { value: 'base + 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить формулу' }));
    await waitFor(() => expect(api.putOverride).toHaveBeenCalledWith(12, 'char-id', 'template-field', { expression: 'base + 2', expectedRevision: 7 }));
  });

  it('resets only an existing override and uses the shared revision', async () => {
    api.getOverrides.mockResolvedValue({ contentRevision: 4, overrides: [{ virtualFieldId: 'template-field', expression: 'base + 2' }] });
    await openPanel();
    expect(await screen.findByDisplayValue('base + 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить формулу' }));
    await waitFor(() => expect(api.resetOverride).toHaveBeenCalledWith(12, 'char-id', 'template-field', 7));
  });

  it('does not enable override writes before the override baseline is loaded', async () => {
    let complete: ((value: { contentRevision: number; overrides: { virtualFieldId: string; expression: string }[] }) => void) | undefined;
    api.getOverrides.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    await openPanel();
    const override = await screen.findByRole('group', { name: 'Переопределение template-field' });
    const field = within(override).getByLabelText('Формула');
    expect(field).toBeDisabled();
    complete?.({ contentRevision: 4, overrides: [{ virtualFieldId: 'template-field', expression: 'server formula' }] });
    await waitFor(() => expect(within(override).getByLabelText('Формула')).toHaveValue('server formula'));
  });

  it('preserves custom and override drafts when closing is cancelled', async () => {
    api.getTemplateVirtualFields.mockRejectedValue({ status: 403 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openPanel();
    await screen.findByLabelText('Ключ');
    fireEvent.change(screen.getByLabelText('Название', { selector: 'input' }), { target: { value: 'Unsaved title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByDisplayValue('Unsaved title')).toBeInTheDocument();
    expect(state.dirty).toBe(true);
    confirm.mockRestore();
  });

  it('blocks custom and override writes while the shared writer is blocked or busy', async () => {
    api.getTemplateVirtualFields.mockRejectedValue({ status: 403 });
    renderPanel({ blocked: true });
    fireEvent.click(screen.getByRole('button', { name: 'Индивидуальные формулы' }));
    await screen.findByRole('heading', { name: 'Индивидуальные формулы' });
    await screen.findByLabelText('Ключ');
    fireEvent.change(screen.getByLabelText('Название', { selector: 'input' }), { target: { value: 'Changed' } });
    expect(screen.getByRole('button', { name: 'Сохранить индивидуальные поля' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Сохранить формулу' })).toBeDisabled();
    expect(api.putCustomVirtualFields).not.toHaveBeenCalled();
    expect(api.putOverride).not.toHaveBeenCalled();
  });
});
