import React, { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import Field from './Field';
import Input from './Input';
import Select from './Select';

describe('form controls', () => {
  test('associates field label, hint and error with its control', () => {
    render(
      <Field label="Name" htmlFor="name" hint="Your name" error="Required">
        <Input id="name" aria-describedby="name-hint name-error" />
      </Field>
    );
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', 'name-hint name-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  test('forwards refs to native input and select elements', () => {
    const inputRef = createRef<HTMLInputElement>();
    const selectRef = createRef<HTMLSelectElement>();
    render(
      <>
        <Input ref={inputRef} aria-label="Name" />
        <Select ref={selectRef} aria-label="Option"><option>One</option></Select>
      </>
    );
    expect(inputRef.current).toBe(screen.getByRole('textbox', { name: 'Name' }));
    expect(selectRef.current).toBe(screen.getByRole('combobox', { name: 'Option' }));
  });
});
