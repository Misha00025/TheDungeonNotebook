import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LosslessNumber } from 'lossless-json';
import { describe, expect, it, vi } from 'vitest';
import CharacterCatalogAttributes from './CharacterCatalogAttributes';
import type { CatalogAttributeDefinition, CatalogAttributeOccurrence } from './catalogTypes';

const choices: CatalogAttributeDefinition = {
  id: 'tags',
  title: 'Теги',
  typeKey: 'multiChoice',
  options: [{ optionKey: 'key-a', title: 'Альфа' }, { optionKey: 'key-b', title: 'Бета' }],
};

describe('character catalog attributes', () => {
  it('keeps a MultiChoice draft isolated until Apply and preserves it while temporarily disabled', async () => {
    const saved: CatalogAttributeOccurrence = { id: 'saved-tags', attributeId: 'tags', value: ['key-a'], editLevel: 'Character' };
    const source: CatalogAttributeOccurrence = { id: 'saved-tags', attributeId: 'tags', value: ['key-a'], editLevel: 'Character' };
    const onChange = vi.fn();
    const submit = vi.fn();
    const Harness: React.FC<{ disabled: boolean }> = ({ disabled }) => {
      const [values, setValues] = useState([saved]);
      return <>
        <CharacterCatalogAttributes definitions={[choices]} sourceValues={[source]} values={values} savedValues={[saved]} disabled={disabled} onChange={next => { onChange(next); setValues(next); }} />
        <button type="button" onClick={() => submit(values)}>Сохранить атрибуты</button>
      </>;
    };
    const view = render(<Harness disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать значения: Теги' }));
    let dialog = await screen.findByRole('dialog', { name: 'Значения: Теги' });
    fireEvent.click(within(dialog).getByLabelText('Бета'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Альфа')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Выбрать значения: Теги' }));
    dialog = await screen.findByRole('dialog', { name: 'Значения: Теги' });
    fireEvent.click(within(dialog).getByLabelText('Бета'));
    view.rerender(<Harness disabled />);
    dialog = screen.getByRole('dialog', { name: 'Значения: Теги' });
    expect(within(dialog).getByText(/Черновик выбора сохранён/)).toBeInTheDocument();
    expect(within(dialog).getByText('Альфа, Бета')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Применить' })).toBeDisabled();
    expect(dialog.textContent).not.toContain('key-a');
    expect(dialog.textContent).not.toContain('key-b');
    view.rerender(<Harness disabled={false} />);
    dialog = screen.getByRole('dialog', { name: 'Значения: Теги' });
    expect(within(dialog).getByLabelText('Бета')).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Применить' }));
    await waitFor(() => expect(screen.getByText('Альфа; Бета')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить атрибуты' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith([{ ...saved, value: ['key-a', 'key-b'] }]);
  });

  it('validates edits to repeated numeric occurrences and preserves falsy and lossless values', async () => {
    const number: CatalogAttributeDefinition = { id: 'number', title: 'Число', typeKey: 'integer', options: [] };
    const flag: CatalogAttributeDefinition = { id: 'flag', title: 'Флаг', typeKey: 'boolean', options: [] };
    const fixed: CatalogAttributeOccurrence = { id: 'fixed-zero', attributeId: 'number', value: 0, editLevel: 'Definition' };
    const editable: CatalogAttributeOccurrence = { id: 'editable-large', attributeId: 'number', value: new LosslessNumber('9007199254740993'), editLevel: 'Character' };
    const savedFalse: CatalogAttributeOccurrence = { id: 'saved-false', attributeId: 'flag', value: false, editLevel: 'Character' };
    const submit = vi.fn();
    const Harness: React.FC = () => {
      const [values, setValues] = useState([savedFalse]);
      const [invalid, setInvalid] = useState(false);
      return <>
        <CharacterCatalogAttributes definitions={[number, flag]} sourceValues={[fixed, editable]} values={values} savedValues={[savedFalse]} onChange={setValues} onValidityChange={setInvalid} />
        <button type="button" disabled={invalid} onClick={() => submit(values)}>Сохранить атрибуты</button>
      </>;
    };
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить: Число' }));
    const value = await screen.findByRole('textbox', { name: 'Значение: Число' });
    expect(value).toHaveValue('9007199254740993');
    fireEvent.change(value, { target: { value: '-' } });
    expect(await screen.findByText('Введите целое число.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить атрибуты' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить к каталогу: Число' }));
    await waitFor(() => expect(screen.queryByText('Введите целое число.')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Сохранить атрибуты' })).toBeEnabled();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Значение: Флаг' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Изменить: Число' }));
    expect(await screen.findByRole('textbox', { name: 'Значение: Число' })).toHaveValue('9007199254740993');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить атрибуты' }));
    expect(submit).toHaveBeenCalledTimes(1);
    const submitted = submit.mock.calls[0][0] as CatalogAttributeOccurrence[];
    expect(submitted).toEqual([
      savedFalse,
      { ...editable, value: new LosslessNumber('9007199254740993') },
    ]);
    expect(submitted.some(row => row.id === fixed.id)).toBe(false);
  });
});
