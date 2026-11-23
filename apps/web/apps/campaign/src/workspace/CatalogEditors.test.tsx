import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LosslessNumber, isLosslessNumber } from 'lossless-json';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stringifyJson } from './json';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence, CatalogGroupCondition } from './catalogTypes';
import { CatalogAttributeValuesEditor } from './CatalogAttributeValuesEditor';
import { CatalogConditionEditor } from './CatalogConditionEditor';

const definitions: CatalogAttributeDefinition[] = [
  { id: 'attr-stale', title: 'Old strength', typeKey: 'integer', options: [] },
  { id: 'attr-rate', title: 'Probability', typeKey: 'number', options: [] },
  { id: 'attr-strength', title: 'Strength', typeKey: 'integer', options: [] },
  { id: 'attr-enabled', title: 'Enabled', typeKey: 'boolean', options: [] },
  { id: 'attr-tags', title: 'Tags', typeKey: 'multiChoice', options: [{ optionKey: 'internal-option-key', title: 'Stealth' }] },
];

const initialOccurrences: CatalogAttributeOccurrence[] = [
  { id: 'occ-stale', attributeId: 'attr-stale', value: 'legacy text', editLevel: 'Definition' },
  { id: 'occ-rate-a', attributeId: 'attr-rate', value: new LosslessNumber('0.125'), editLevel: 'Definition' },
  { id: 'occ-rate-b', attributeId: 'attr-rate', value: 0, editLevel: 'Definition' },
  { id: 'occ-enabled', attributeId: 'attr-enabled', value: false, editLevel: 'Definition' },
  { id: 'occ-tags', attributeId: 'attr-tags', value: [], editLevel: 'Definition' },
];

const submittedAttributes = vi.fn();
const submittedCondition = vi.fn();

const AttributeValuesHarness: React.FC = () => {
  const [values, setValues] = useState(initialOccurrences);
  const [invalid, setInvalid] = useState(false);
  return <>
    <CatalogAttributeValuesEditor
      definitions={definitions}
      values={values}
      onChange={setValues}
      onValidityChange={setInvalid}
    />
    <button type="button" disabled={invalid} onClick={() => submittedAttributes(values)}>Сохранить значения</button>
  </>;
};

const ConditionHarness: React.FC = () => {
  const [condition, setCondition] = useState<CatalogGroupCondition | null>(null);
  const [invalid, setInvalid] = useState(false);
  return <>
    <CatalogConditionEditor definitions={definitions} condition={condition} onChange={setCondition} onValidityChange={setInvalid} />
    <button type="button" disabled={invalid} onClick={() => submittedCondition(condition)}>Сохранить условие</button>
  </>;
};

describe('catalog domain editors', () => {
  beforeEach(() => {
    submittedAttributes.mockReset();
    submittedCondition.mockReset();
  });

  it('keeps stale and repeated falsy attribute occurrences verbatim and clears invalid state when a row is removed', async () => {
    render(<AttributeValuesHarness />);
    const save = screen.getByRole('button', { name: 'Сохранить значения' });
    expect(save).toBeEnabled();
    expect(screen.getByText('Значение не соответствует текущей характеристике.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Значение: Enabled' })).not.toBeChecked();
    expect(document.body.textContent).not.toContain('internal-option-key');

    fireEvent.click(save);
    const untouched = submittedAttributes.mock.calls[0][0] as CatalogAttributeOccurrence[];
    expect(untouched).toHaveLength(5);
    expect(untouched.filter(row => row.attributeId === 'attr-rate')).toHaveLength(2);
    expect(untouched[0]).toEqual(initialOccurrences[0]);
    expect(String(untouched[1].value)).toBe('0.125');
    expect(isLosslessNumber(untouched[1].value)).toBe(true);
    expect(untouched[2].value).toBe(0);
    expect(untouched[3].value).toBe(false);
    expect(untouched[4].value).toEqual([]);

    const numberInputs = screen.getAllByRole('textbox', { name: 'Значение: Probability' });
    fireEvent.change(numberInputs[0], { target: { value: '-' } });
    await waitFor(() => expect(save).toBeDisabled());
    const invalidRow = numberInputs[0].closest('tr') as HTMLElement;
    fireEvent.click(within(invalidRow).getByRole('button', { name: 'Убрать' }));
    await waitFor(() => expect(save).toBeEnabled());

    submittedAttributes.mockClear();
    fireEvent.click(save);
    const afterRemoval = submittedAttributes.mock.calls[0][0] as CatalogAttributeOccurrence[];
    expect(afterRemoval.map(row => row.id)).toEqual(['occ-stale', 'occ-rate-b', 'occ-enabled', 'occ-tags']);
    expect(afterRemoval[0]).toEqual(initialOccurrences[0]);
  });

  it('keeps MultiChoice changes local until Apply and preserves occurrence data and native option keys', async () => {
    render(<AttributeValuesHarness />);
    expect(screen.getByText('Не выбрано')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать значения' }));
    const dialog = await screen.findByRole('dialog', { name: 'Значения: Tags' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Stealth' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить значения' }));
    const cancelled = submittedAttributes.mock.calls[0][0] as CatalogAttributeOccurrence[];
    expect(cancelled).toEqual(initialOccurrences);

    submittedAttributes.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать значения' }));
    const reopened = await screen.findByRole('dialog', { name: 'Значения: Tags' });
    fireEvent.click(within(reopened).getByRole('checkbox', { name: 'Stealth' }));
    fireEvent.click(within(reopened).getByRole('button', { name: 'Применить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить значения' }));

    const applied = submittedAttributes.mock.calls[0][0] as CatalogAttributeOccurrence[];
    expect(applied).toHaveLength(initialOccurrences.length);
    expect(applied.slice(0, -1)).toEqual(initialOccurrences.slice(0, -1));
    expect(applied[applied.length - 1]).toEqual({ ...initialOccurrences[4], value: ['internal-option-key'] });
    expect(document.body.textContent).not.toContain('internal-option-key');
  });

  it('creates an eq leaf from no condition, allows its first attribute selection, and submits the typed native value', async () => {
    render(<ConditionHarness />);
    const save = screen.getByRole('button', { name: 'Сохранить условие' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Условие включения' }), { target: { value: 'eq' } });
    await waitFor(() => expect(save).toBeDisabled());
    const attribute = screen.getByRole('combobox', { name: 'Атрибут' });
    expect(attribute).toBeEnabled();
    fireEvent.change(attribute, { target: { value: 'attr-strength' } });
    const value = await screen.findByRole('textbox', { name: 'Значение: Strength' });
    fireEvent.change(value, { target: { value: '17' } });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    expect(stringifyJson(submittedCondition.mock.calls[0][0])).toBe(
      '{"operator":"eq","attributeId":"attr-strength","value":17}',
    );
  });

  it('supports nested all/not typed leaves, blocks invalid raw numbers, and recovers after removing an empty child', async () => {
    render(<ConditionHarness />);
    const save = screen.getByRole('button', { name: 'Сохранить условие' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Условие включения' }), { target: { value: 'all' } });
    await waitFor(() => expect(save).toBeDisabled());

    fireEvent.change(screen.getByRole('combobox', { name: 'Тип условия' }), { target: { value: 'not' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Атрибут' }), { target: { value: 'attr-rate' } });
    const rate = await screen.findByRole('textbox', { name: 'Значение: Probability' });
    fireEvent.change(rate, { target: { value: '-' } });
    await waitFor(() => expect(save).toBeDisabled());
    fireEvent.change(rate, { target: { value: '3.5' } });
    await waitFor(() => expect(save).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Добавить условие' }));
    await waitFor(() => expect(save).toBeDisabled());
    const deleteButtons = screen.getAllByRole('button', { name: 'Удалить условие' });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    expect(stringifyJson(submittedCondition.mock.calls[0][0])).toBe(
      '{"operator":"all","children":[{"operator":"not","children":[{"operator":"eq","attributeId":"attr-rate","value":3.5}]}]}',
    );
  });

  it('serializes exists leaves without typed value fields inside any', async () => {
    render(<ConditionHarness />);
    const save = screen.getByRole('button', { name: 'Сохранить условие' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Условие включения' }), { target: { value: 'any' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Тип условия' }), { target: { value: 'exists' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Атрибут' }), { target: { value: 'attr-strength' } });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    expect(stringifyJson(submittedCondition.mock.calls[0][0])).toBe(
      '{"operator":"any","children":[{"operator":"exists","attributeId":"attr-strength"}]}',
    );
  });
});
