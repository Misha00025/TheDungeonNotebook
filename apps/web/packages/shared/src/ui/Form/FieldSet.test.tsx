import React from 'react';
import { render, screen } from '@testing-library/react';
import FieldSet from './FieldSet';
import styles from './FieldSet.module.css';

describe('FieldSet', () => {
  test('renders a native accessible group and merges attributes and className', () => {
    render(<FieldSet legend="Attributes" className="custom" data-testid="fields"><input aria-label="Strength" /></FieldSet>);
    const group = screen.getByRole('group', { name: 'Attributes' });
    expect(group).toHaveClass(styles.fieldSet, 'custom');
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
