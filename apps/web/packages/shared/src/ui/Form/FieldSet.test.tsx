import React from 'react';
import { render, screen } from '@testing-library/react';
import FieldSet from './FieldSet';

describe('FieldSet', () => {
  test('renders an accessible group and forwards attributes', () => {
    render(<FieldSet legend="Attributes" data-testid="fields"><input aria-label="Strength" /></FieldSet>);
    const group = screen.getByRole('group', { name: 'Attributes' });
    expect(group).toHaveAttribute('data-testid', 'fields');
    expect(screen.getByRole('textbox', { name: 'Strength' })).toBeInTheDocument();
  });

  test('keeps native disabled fieldset behavior for descendants', () => {
    render(<FieldSet legend="Disabled fields" disabled><input aria-label="Name" /><button>Save</button></FieldSet>);
    expect(screen.getByRole('group', { name: 'Disabled fields' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
