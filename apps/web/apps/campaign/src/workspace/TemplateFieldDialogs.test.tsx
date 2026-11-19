import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VirtualFieldInput } from './types';
import { TemplateChoiceValueDialog, TemplateDescriptionDialog, TemplateOptionsDialog, TemplateVirtualLinksDialog } from './TemplateFieldDialogs';

const state = vi.hoisted(() => ({ api: { getFormulaContent: vi.fn() }, sessionKey: 'session', dirty: {} as Record<string, boolean> }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api: state.api, sessionKey: state.sessionKey }), useDirtyDraft: (owner: string, dirty: boolean) => { state.dirty[owner] = dirty; } }));

const virtualField = (changes: Partial<VirtualFieldInput> = {}): VirtualFieldInput => ({
  key: 'virtual',
  title: 'Virtual',
  description: '',
  resultType: 'Number',
  formulaId: 'formula-1',
  bindings: {},
  ...changes,
});

describe('Template field dialogs', () => {
  beforeEach(() => {
    state.dirty = {};
    state.api.getFormulaContent.mockReset().mockResolvedValue({ data: { parameters: [] } });
  });

  it('keeps multiline description exact and Cancel/Escape do not apply it', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const value = 'line one\n\n  line three  ';
    render(<TemplateDescriptionDialog label="Lore" value="old" disabled={false} onClose={onClose} onApply={onApply} />);
    const dialog = screen.getByRole('dialog', { name: 'Описание поля Lore' });
    const textarea = within(dialog).getByRole('textbox', { name: 'Описание поля' });
    fireEvent.change(textarea, { target: { value } });
    expect(textarea).toHaveValue(value);
    expect(Object.values(state.dirty)).toContain(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith(value);
  });

  it('disables dialog controls and Apply while leaving cancel paths available', () => {
    const onClose = vi.fn();
    render(<TemplateDescriptionDialog label="Disabled" value="text" disabled onClose={onClose} onApply={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Описание поля Disabled' });
    expect(within(dialog).getByRole('textbox', { name: 'Описание поля' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Применить' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Закрыть' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('edits, adds, and removes options without transforming option keys', () => {
    const onApply = vi.fn();
    render(<TemplateOptionsDialog label="Choice" options={[{ optionKey: '', title: 'Empty key' }, { optionKey: 'opaque/key', title: 'Old' }]} disabled={false} onClose={vi.fn()} onApply={onApply} />);
    const dialog = screen.getByRole('dialog', { name: 'Варианты поля Choice' });
    const table = within(dialog).getByRole('table', { name: 'Варианты поля Choice' });
    fireEvent.change(within(table).getByRole('textbox', { name: 'Название варианта 2' }), { target: { value: 'Renamed' } });
    fireEvent.click(within(table).getByRole('button', { name: 'Удалить вариант 1' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить вариант' }));
    fireEvent.change(within(table).getByRole('textbox', { name: 'Ключ варианта 2' }), { target: { value: 'new:key' } });
    fireEvent.change(within(table).getByRole('textbox', { name: 'Название варианта 2' }), { target: { value: 'New' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith([{ optionKey: 'opaque/key', title: 'Renamed' }, { optionKey: 'new:key', title: 'New' }]);
  });

  it('preserves empty and opaque multi-choice keys and blocks applying invalid values', () => {
    const onApply = vi.fn();
    const field = { valueType: 'MultiChoice' as const, options: [{ optionKey: '', title: 'Empty key' }, { optionKey: 'opaque/key', title: 'Opaque key' }] };
    const view = render(<TemplateChoiceValueDialog label="Options" field={field} value={[]} disabled={false} onClose={vi.fn()} onApply={onApply} />);
    const dialog = screen.getByRole('dialog', { name: 'Значения поля Options' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Empty key' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Opaque key' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith(['', 'opaque/key']);

    view.unmount();
    render(<TemplateChoiceValueDialog label="Options" field={field} value={['removed']} disabled={false} onClose={vi.fn()} onApply={onApply} />);
    expect(within(screen.getByRole('dialog', { name: 'Значения поля Options' })).getByRole('button', { name: 'Применить' })).toBeDisabled();
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('edits only declared case-sensitive bindings from saved sources', async () => {
    state.api.getFormulaContent.mockResolvedValue({ data: { parameters: ['value', 'strength', 'parent', 'Parent'] } });
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<TemplateVirtualLinksDialog label="Total" campaignId={7} field={virtualField({ bindings: { parent: { kind: 'Base', fieldId: 'same-id' } } })} sources={[{ id: 'same-id', title: 'Strength', kind: 'Base' }, { id: 'same-id', title: 'Modifier', kind: 'Virtual' }]} disabled={false} onClose={onClose} onApply={onApply} />);
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Total' });
    for (const name of ['value', 'strength', 'parent', 'Parent']) await within(dialog).findByRole('combobox', { name: `Параметр ${name}` });
    const table = within(dialog).getByRole('table', { name: 'Привязки параметров' });
    expect(within(table).getByRole('columnheader', { name: 'Параметр' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Поле' })).toBeInTheDocument();
    const parameterRows = within(table).getAllByRole('row').slice(1);
    expect(parameterRows).toHaveLength(4);
    for (const name of ['value', 'strength', 'parent', 'Parent']) {
      const row = within(table).getByRole('row', { name: new RegExp(name) });
      expect(within(row).getByRole('rowheader', { name })).toBeInTheDocument();
      expect(within(row).getAllByRole('combobox')).toHaveLength(1);
    }
    expect(state.api.getFormulaContent).toHaveBeenCalledWith(7, 'formula-1');
    expect(within(dialog).queryByRole('textbox', { name: 'ID формулы' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox', { name: 'Родитель' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'Новое имя параметра' })).not.toBeInTheDocument();
    const parent = within(dialog).getByRole('combobox', { name: 'Параметр parent' });
    expect(parent).toHaveValue('Base:same-id');
    expect(within(parent).getByRole('group', { name: 'Базовые поля' })).toBeInTheDocument();
    expect(within(parent).getByRole('group', { name: 'Виртуальные поля' })).toBeInTheDocument();
    expect(within(parent).getAllByRole('option', { name: /Strength|Modifier/ })).toHaveLength(2);
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Параметр value' }), { target: { value: 'Virtual:same-id' } });
    fireEvent.change(parent, { target: { value: '' } });
    expect(within(dialog).getByRole('combobox', { name: 'Параметр value' })).toHaveValue('Virtual:same-id');
    expect(parent).toHaveValue('');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(parent, { target: { value: 'Base:same-id' } });
    expect(parent).toHaveValue('Base:same-id');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith({ bindings: { value: { kind: 'Virtual', fieldId: 'same-id' }, parent: { kind: 'Base', fieldId: 'same-id' } } });
    expect(onApply.mock.calls[0][0]).not.toHaveProperty('formulaId');
    expect(onApply.mock.calls[0][0]).not.toHaveProperty('parentBaseFieldId');
  });

  it('preserves unknown declared references until changed and removes undeclared bindings only on apply', async () => {
    state.api.getFormulaContent.mockResolvedValue({ data: { parameters: ['value'] } });
    const field = virtualField({ bindings: { value: { kind: 'Base', fieldId: 'gone' }, legacy: { kind: 'Virtual', fieldId: 'opaque' } } });
    const onApply = vi.fn();
    const view = render(<TemplateVirtualLinksDialog label="Unknown" campaignId={8} field={field} sources={[]} disabled={false} onClose={vi.fn()} onApply={onApply} />);
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Unknown' });
    const select = await within(dialog).findByRole('combobox', { name: 'Параметр value' });
    expect(within(select).getByRole('option', { name: 'Недоступное поле' })).toHaveValue('Base:gone');
    expect(within(dialog).queryByRole('combobox', { name: 'Параметр legacy' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'Имя параметра legacy' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Связи с параметрами, которых нет в формуле, будут убраны при применении.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(field.bindings).toEqual({ value: { kind: 'Base', fieldId: 'gone' }, legacy: { kind: 'Virtual', fieldId: 'opaque' } });
    view.unmount();
    render(<TemplateVirtualLinksDialog label="Unknown" campaignId={8} field={field} sources={[{ id: 'base', title: 'Base title', kind: 'Base' }]} disabled={false} onClose={vi.fn()} onApply={onApply} />);
    const reopened = screen.getByRole('dialog', { name: 'Связи поля Unknown' });
    const sourceSelect = await within(reopened).findByRole('combobox', { name: 'Параметр value' });
    fireEvent.change(sourceSelect, { target: { value: 'Base:base' } });
    fireEvent.click(within(reopened).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith({ bindings: { value: { kind: 'Base', fieldId: 'base' } } });
  });

  it('requires formula metadata, retries failures, allows zero-parameter formulas, and ignores stale resources', async () => {
    const onApply = vi.fn();
    const view = render(<TemplateVirtualLinksDialog label="Calc" campaignId={9} field={virtualField({ formulaId: '' })} sources={[]} disabled={false} onClose={vi.fn()} onApply={onApply} />);
    let dialog = screen.getByRole('dialog', { name: 'Связи поля Calc' });
    expect(within(dialog).getByText('Сначала выберите формулу в строке поля.')).toBeInTheDocument();
    expect(state.api.getFormulaContent).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Применить' })).toBeDisabled();
    state.api.getFormulaContent.mockRejectedValueOnce(new Error('unavailable'));
    view.rerender(<TemplateVirtualLinksDialog label="Calc" campaignId={9} field={virtualField({ bindings: { keep: { kind: 'Base', fieldId: 'id' } } })} sources={[]} disabled={false} onClose={vi.fn()} onApply={onApply} />);
    await screen.findByRole('button', { name: 'Повторить загрузку' });
    dialog = screen.getByRole('dialog', { name: 'Связи поля Calc' });
    expect(within(dialog).getByRole('button', { name: 'Применить' })).toBeDisabled();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('table', { name: 'Привязки параметров' })).not.toBeInTheDocument();
    state.api.getFormulaContent.mockResolvedValueOnce({ data: { parameters: [] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Повторить загрузку' }));
    expect(await within(dialog).findByText('Формула не требует входных полей.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('table', { name: 'Привязки параметров' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith({ bindings: {} });
  });

  it('does not show a previous formula response after the selected row formula changes', async () => {
    let resolveOld!: (result: { data: { parameters: string[] } }) => void;
    state.api.getFormulaContent.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    state.api.getFormulaContent.mockResolvedValueOnce({ data: { parameters: ['current'] } });
    const props = { label: 'Race', campaignId: 3, sources: [], disabled: false, onClose: vi.fn(), onApply: vi.fn() };
    const view = render(<TemplateVirtualLinksDialog {...props} field={virtualField({ formulaId: 'old' })} />);
    view.rerender(<TemplateVirtualLinksDialog {...props} field={virtualField({ formulaId: 'current' })} />);
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Race' });
    expect(within(dialog).queryByRole('table', { name: 'Привязки параметров' })).not.toBeInTheDocument();
    await within(dialog).findByRole('combobox', { name: 'Параметр current' });
    await act(async () => resolveOld({ data: { parameters: ['stale'] } }));
    expect(within(dialog).queryByRole('combobox', { name: 'Параметр stale' })).not.toBeInTheDocument();
  });

  it('gates binding edits and apply when write access is unavailable but keeps cancel available', async () => {
    state.api.getFormulaContent.mockResolvedValue({ data: { parameters: ['value'] } });
    const onClose = vi.fn();
    render(<TemplateVirtualLinksDialog label="Read only" campaignId={2} field={virtualField()} sources={[{ id: 'base', title: 'Base', kind: 'Base' }]} disabled onClose={onClose} onApply={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Read only' });
    expect(await within(dialog).findByRole('combobox', { name: 'Параметр value' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Применить' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('treats prototype-named parameters as ordinary declared names', async () => {
    state.api.getFormulaContent.mockResolvedValue({ data: { parameters: ['constructor', '__proto__', 'toString'] } });
    const onApply = vi.fn();
    const props = { label: 'Names', campaignId: 2, sources: [{ id: 'opaque-id', title: 'Visible source', kind: 'Base' as const }], disabled: false, onClose: vi.fn(), onApply };
    const view = render(<TemplateVirtualLinksDialog {...props} field={virtualField({ bindings: {} })} />);
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Names' });
    const selects = await Promise.all(['constructor', '__proto__', 'toString'].map(name => within(dialog).findByRole('combobox', { name: `Параметр ${name}` })));
    selects.forEach(select => expect(select).toHaveValue(''));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith({ bindings: {} });
    view.unmount();
    render(<TemplateVirtualLinksDialog {...props} field={virtualField({ bindings: {} })} />);
    const selectedDialog = screen.getByRole('dialog', { name: 'Связи поля Names' });
    const constructor = await within(selectedDialog).findByRole('combobox', { name: 'Параметр constructor' });
    expect(within(constructor).getByRole('option', { name: 'Visible source' })).toBeInTheDocument();
    fireEvent.change(constructor, { target: { value: 'Base:opaque-id' } });
    fireEvent.click(within(selectedDialog).getByRole('button', { name: 'Применить' }));
    expect(onApply.mock.calls[1][0].bindings).toEqual({ constructor: { kind: 'Base', fieldId: 'opaque-id' } });
    expect(Object.prototype.hasOwnProperty.call(onApply.mock.calls[1][0].bindings, 'constructor')).toBe(true);
  });
});
