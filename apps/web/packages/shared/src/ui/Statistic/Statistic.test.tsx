import React from 'react';
import { render, screen } from '@testing-library/react';
import Statistic from './Statistic';

describe('Statistic', () => {
  test('renders its accessible label and value once and passes attributes', () => {
    render(<Statistic label="Characters" value={12} data-testid="statistic" />);
    expect(screen.getByRole('article', { name: 'Characters' })).toHaveAttribute('data-testid', 'statistic');
    expect(screen.getByText('Characters')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  test('supports React values and the busy state', () => {
    render(<Statistic label="Formulas" value={<span>…</span>} busy />);
    expect(screen.getByRole('article', { name: 'Formulas' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('…')).toBeInTheDocument();
  });
});
