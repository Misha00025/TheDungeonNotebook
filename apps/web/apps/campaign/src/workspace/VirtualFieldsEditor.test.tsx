import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { VirtualFieldsEditor } from './VirtualFieldsEditor';
import type { VirtualFieldInput } from './types';

const api = vi.hoisted(() => ({ getFormulaContent: vi.fn() }));
const capturedChanges = vi.fn();
vi.mock('./Workspace', () => ({ useWorkspace: () => ({ api }) }));
const formulas = [{ id: 'formula-1', key: 'f1', campaignId: 4, name: 'Formula', metadataRevision: 1 }];
const makeField = (formulaId = 'formula-1'): VirtualFieldInput => ({ key: 'calc', title: 'Calc', description: '', resultType: 'Number', formulaId, bindings: {} });
const renderEditor = (fields: VirtualFieldInput[], onChange = vi.fn()) => render(<VirtualFieldsEditor campaignId={4} fields={fields} onChange={onChange} formulas={formulas} baseFields={[{ id: 'base-1', key: 'base', title: 'Base field' }]} templateVirtualFields={[{ id: 'virtual-1', key: 'v', title: 'Virtual field', description: '', resultType: 'Number', formulaId: 'formula-1', bindings: {} }]} />);
const ControlledHarness: React.FC = () => {
  const [fields, setFields] = React.useState<VirtualFieldInput[]>([]);
  return <VirtualFieldsEditor campaignId={4} fields={fields} onChange={value => { capturedChanges(value); setFields(value); }} formulas={[]} baseFields={[{ id: 'saved-base', key: 'b', title: 'Saved base' }]} templateVirtualFields={[{ id: 'saved-virtual', key: 'v', title: 'Saved virtual', description: '', resultType: 'Number', formulaId: 'f', bindings: {} }]} />;
};

describe('VirtualFieldsEditor', () => {
  beforeEach(() => { api.getFormulaContent.mockReset(); capturedChanges.mockReset(); api.getFormulaContent.mockResolvedValue({ data: { parameters: ['amount'] } }); });

  it('loads parameters for existing formula fields and keeps explicit reference kinds', async () => {
    const field = { ...makeField(), bindings: { amount: { kind: 'Virtual' as const, fieldId: 'virtual-1' }, unknown: { kind: 'Base' as const, fieldId: 'missing' } }, parentVirtualFieldId: 'virtual-1' };
    renderEditor([field]);
    expect(await screen.findByLabelText('Параметр amount')).toBeInTheDocument();
    expect((screen.getByLabelText('Параметр amount') as HTMLSelectElement).value).toBe('Virtual:virtual-1');
    expect((screen.getByLabelText('Родитель') as HTMLSelectElement).value).toBe('Virtual:virtual-1');
    expect(screen.getByText('Сохранённая неизвестная связь')).toBeInTheDocument();
  });

  it('supports manual parameter bindings when formula definitions cannot be read', async () => {
    api.getFormulaContent.mockRejectedValue(new Error('forbidden'));
    const onChange = vi.fn();
    renderEditor([makeField()], onChange);
    await screen.findByText(/связи можно редактировать вручную/i);
    fireEvent.change(screen.getByLabelText('Имя параметра'), { target: { value: 'manual' } });
    fireEvent.change(screen.getByLabelText('ID поля'), { target: { value: 'base-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить связь' }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ bindings: { manual: { kind: 'Base', fieldId: 'base-1' } } })]);
  });

  it('ignores stale formula reads after the selected formula changes', async () => {
    let resolveOld!: (value: unknown) => void;
    api.getFormulaContent.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ data: { parameters: ['newParam'] } });
    const first = makeField('old-formula');
    const { rerender } = render(<VirtualFieldsEditor campaignId={4} fields={[first]} onChange={vi.fn()} formulas={[]} baseFields={[]} />);
    const changed = { ...first, formulaId: 'new-formula' };
    rerender(<VirtualFieldsEditor campaignId={4} fields={[changed]} onChange={vi.fn()} formulas={[]} baseFields={[]} />);
    expect(await screen.findByLabelText('Параметр newParam')).toBeInTheDocument();
    resolveOld({ data: { parameters: ['oldParam'] } });
    await waitFor(() => expect(screen.queryByLabelText('Параметр oldParam')).not.toBeInTheDocument());
  });

  it('omits IDs for new fields and never offers unsaved fields as references', () => {
    render(<ControlledHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить виртуальное поле' }));
    expect(capturedChanges.mock.lastCall?.[0][0]).not.toHaveProperty('id');
    const row = screen.getByRole('group', { name: 'Новое виртуальное поле' });
    expect(within(row).getByLabelText('Ключ')).toHaveValue('');
    const parent = within(row).getByLabelText('Родитель');
    expect(within(parent).getByRole('option', { name: 'Base: Saved base' })).toHaveValue('Base:saved-base');
    expect(within(parent).getByRole('option', { name: 'Virtual: Saved virtual' })).toHaveValue('Virtual:saved-virtual');
    expect(within(parent).queryByRole('option', { name: /Новое виртуальное поле/ })).not.toBeInTheDocument();
  });
});
