import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
