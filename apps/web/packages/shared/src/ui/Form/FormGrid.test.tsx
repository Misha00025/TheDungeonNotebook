import React from 'react';
import { render, screen } from '@testing-library/react';
import FormGrid from './FormGrid';
import styles from './FormGrid.module.css';

describe('FormGrid', () => {
  test('merges class and style while preserving native attributes and children', () => {
    render(<FormGrid minColumnWidth="16rem" className="custom" style={{ color: 'red' }} aria-label="Fields" data-testid="grid"><label>Name<input /></label></FormGrid>);
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass(styles.formGrid, 'custom');
    expect(grid).toHaveAttribute('aria-label', 'Fields');
    expect(grid.style.getPropertyValue('--form-column-min')).toBe('16rem');
    expect(grid.style.color).toBe('red');
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  test('uses the default minimum column width', () => {
    render(<FormGrid data-testid="grid" />);
    expect(screen.getByTestId('grid').style.getPropertyValue('--form-column-min')).toBe('12rem');
  });
});
