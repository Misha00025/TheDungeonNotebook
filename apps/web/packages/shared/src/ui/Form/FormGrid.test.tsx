import React from 'react';
import { render, screen } from '@testing-library/react';
import FormGrid from './FormGrid';

describe('FormGrid', () => {
  test('preserves accessible attributes and children', () => {
    render(<FormGrid aria-label="Fields" data-testid="grid"><label>Name<input /></label></FormGrid>);
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveAttribute('aria-label', 'Fields');
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});
