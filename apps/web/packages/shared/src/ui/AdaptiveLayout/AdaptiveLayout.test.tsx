import React from 'react';
import { render, screen } from '@testing-library/react';
import AdaptiveLayout from './AdaptiveLayout';

describe('AdaptiveLayout', () => {
  test('renders children', () => {
    render(
      <>
        <AdaptiveLayout>
          <button>First</button>
          <button>Second</button>
        </AdaptiveLayout>
      </>
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  test('passes extra attributes', () => {
    render(<AdaptiveLayout data-testid="layout">content</AdaptiveLayout>);
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });
});
