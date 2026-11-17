import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { isLosslessNumber } from 'lossless-json';
import { parseFieldValue, validateFieldValue, ValueInput } from './ValueInput';
import type { ChoiceOption, ValueType } from './types';

const options: ChoiceOption[] = [{ optionKey: '', title: 'Пустой ключ' }, { optionKey: 'two', title: 'Два' }];
const field = (valueType: ValueType) => ({ valueType, options: ['SingleChoice', 'MultiChoice'].includes(valueType) ? options : [] });

describe('typed field values', () => {
  it('preserves int64 extremes without safe-integer narrowing', () => {
    for (const text of ['-9223372036854775808', '9223372036854775807']) {
      const value = parseFieldValue(field('Integer'), text);
      expect(isLosslessNumber(value)).toBe(true);
      expect(validateFieldValue(field('Integer'), value, text)).toBeUndefined();
    }
    expect(validateFieldValue(field('Integer'), parseFieldValue(field('Integer'), '9223372036854775808'), '9223372036854775808')).toBeDefined();
  });

  it.each([['Number', '0'], ['String', ''], ['Boolean', 'false'], ['SingleChoice', ''], ['MultiChoice', '']] as [ValueType, string][])('handles %s zero or empty values', (type, raw) => {
    const value = parseFieldValue(field(type), raw);
    if (type === 'Number') expect(isLosslessNumber(value)).toBe(true);
    else expect(value).toEqual(type === 'Boolean' ? false : type === 'MultiChoice' ? [] : '');
    expect(validateFieldValue(field(type), value, raw)).toBeUndefined();
  });

  it('keeps invalid numeric drafts visible and does not emit them', () => {
    const onChange = vi.fn(); const onValidityChange = vi.fn();
    render(<ValueInput field={field('Integer')} value={0} onChange={onChange} onValidityChange={onValidityChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '-' } });
    expect(screen.getByRole('textbox')).toHaveValue('-');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onValidityChange).toHaveBeenLastCalledWith('Введите целое число.');
  });

  it('does not choose a single-choice option implicitly', () => {
    const onChange = vi.fn();
    render(<ValueInput field={{ valueType: 'SingleChoice', options: [{ optionKey: 'one', title: 'One' }] }} value="" onChange={onChange} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });
});
