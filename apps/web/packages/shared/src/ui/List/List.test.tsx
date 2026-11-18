import React from 'react';
import { render, screen } from '@testing-library/react';
import styles from './List.module.css';
import List from './List';

describe('List', () => {
  test('passes native attributes and className', () => {
    render(<List aria-label="Entries" data-testid="entries" className="custom">Entry</List>);
    expect(screen.getByTestId('entries')).toHaveAttribute('aria-label', 'Entries');
    expect(screen.getByTestId('entries')).toHaveClass('custom');
  });

  test('supports vertical stretch', () => {
    render(<List stretch data-testid="stretched">Entry</List>);
    expect(screen.getByTestId('stretched').className).toContain('stretch');
  });

  test('exposes grid column sizing variables and merges inline styles', () => {
    render(<List layout="grid" columns={2} minItemWidth="18rem" gap="large" style={{ color: 'red' }} data-testid="grid">Entry</List>);
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass(styles.columns2);
    expect(grid.style.getPropertyValue('--list-min-width')).toBe('18rem');
    expect(grid.style.getPropertyValue('--list-gap')).toBe('1.5rem');
    expect(grid.style.color).toBe('red');
  });
});
