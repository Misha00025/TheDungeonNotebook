import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import iconButtonStyles from '@tdn/shared/ui/Buttons/IconButton/IconButton.module.css';
import type { VirtualFieldInput } from './types';
import { TemplateChoiceValueDialog, TemplateDescriptionDialog, TemplateOptionsDialog, TemplateVirtualLinksDialog } from './TemplateFieldDialogs';

const state = vi.hoisted(() => ({ api: { getFormulaContent: vi.fn() }, dirty: {} as Record<string, boolean> }));
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api: state.api }), useDirtyDraft: (owner: string, dirty: boolean) => { state.dirty[owner] = dirty; } }));

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
    expect(within(table).getByRole('button', { name: 'Удалить вариант 1' })).toHaveClass(iconButtonStyles.danger);
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

  it('keeps known parameter bindings and unknown stored references while applying parent exclusivity', async () => {
    state.api.getFormulaContent.mockResolvedValue({ data: { parameters: ['amount'] } });
    const onApply = vi.fn();
    const field = virtualField({
      bindings: { amount: { kind: 'Base', fieldId: 'unavailable-base' }, legacy: { kind: 'Virtual', fieldId: 'unavailable-virtual' } },
      parentBaseFieldId: 'base-source',
      parentVirtualFieldId: null,
    });
    render(<TemplateVirtualLinksDialog
      label="Total"
      campaignId={7}
      field={field}
      sources={[{ id: 'base-source', title: 'Strength', kind: 'Base' }, { id: 'virtual-source', title: 'Modifier', kind: 'Virtual' }]}
      disabled={false}
      onClose={vi.fn()}
      onApply={onApply}
    />);
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Total' });
    await waitFor(() => expect(state.api.getFormulaContent).toHaveBeenCalledWith(7, 'formula-1'));
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Параметр amount' })).toBeInTheDocument());
    const parentSelect = within(dialog).getByRole('combobox', { name: 'Родитель' });
    const amountSelect = within(dialog).getByRole('combobox', { name: 'Параметр amount' });
    expect(within(amountSelect).getByRole('option', { name: 'Недоступный источник' })).toHaveValue('Base:unavailable-base');
    expect(within(parentSelect).getByRole('option', { name: 'Базовое: Strength' })).toHaveValue('Base:base-source');
    expect(within(parentSelect).getByRole('option', { name: 'Виртуальное: Modifier' })).toHaveValue('Virtual:virtual-source');
    expect(parentSelect).toHaveValue('Base:base-source');
    expect(amountSelect).toHaveValue('Base:unavailable-base');
    expect(within(dialog).getByRole('textbox', { name: 'ID поля legacy' })).toHaveValue('unavailable-virtual');
    fireEvent.change(parentSelect, { target: { value: 'Virtual:virtual-source' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith({
      formulaId: 'formula-1',
      bindings: { amount: { kind: 'Base', fieldId: 'unavailable-base' }, legacy: { kind: 'Virtual', fieldId: 'unavailable-virtual' } },
      parentBaseFieldId: null,
      parentVirtualFieldId: 'virtual-source',
    });
  });

  it('allows manual binding edits after formula read failure and retains opaque formula ids', async () => {
    state.api.getFormulaContent.mockRejectedValue(new Error('unavailable'));
    const onApply = vi.fn();
    render(
      <TemplateVirtualLinksDialog
        label="Calc"
        campaignId={9}
        field={virtualField({
          formulaId: 'unknown-formula',
          bindings: { kept: { kind: 'Virtual', fieldId: 'opaque-id' } },
        })}
        sources={[]}
        disabled={false}
        onClose={vi.fn()}
        onApply={onApply}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Calc' });
    expect(within(dialog).getByRole('textbox', { name: 'ID формулы' })).toHaveValue('unknown-formula');
    expect(await within(dialog).findByText('Определения недоступны для чтения; сохранённые связи можно редактировать вручную.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Удалить связь kept' })).toHaveClass(iconButtonStyles.danger);
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'ID поля kept' }), { target: { value: 'edited-id' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Новое имя параметра' }), { target: { value: 'manual' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Новый ID поля' }), { target: { value: 'new-opaque' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить связь' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    expect(onApply).toHaveBeenCalledWith({
      formulaId: 'unknown-formula',
      bindings: { kept: { kind: 'Virtual', fieldId: 'edited-id' }, manual: { kind: 'Base', fieldId: 'new-opaque' } },
      parentBaseFieldId: undefined,
      parentVirtualFieldId: undefined,
    });
  });

  it('ignores stale formula parameter responses after selection changes', async () => {
    let resolveOld!: (result: { data: { parameters: string[] } }) => void;
    state.api.getFormulaContent.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    state.api.getFormulaContent.mockResolvedValueOnce({ data: { parameters: ['current'] } });
    render(<TemplateVirtualLinksDialog label="Race" campaignId={3} field={virtualField({ formulaId: 'old' })} sources={[]} disabled={false} onClose={vi.fn()} onApply={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Связи поля Race' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'ID формулы' }), { target: { value: 'current' } });
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Параметр current' })).toBeInTheDocument());
    await act(async () => resolveOld({ data: { parameters: ['stale'] } }));
    expect(within(dialog).getByRole('combobox', { name: 'Параметр current' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox', { name: 'Параметр stale' })).not.toBeInTheDocument();
  });
});
