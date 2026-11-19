import React from 'react';
import { render, screen } from '@testing-library/react';
import ActionRow from './ActionRow';
import Toolbar from './Toolbar';

describe('composition components', () => {
  test('ActionRow passes attributes and renders children', () => {
    render(<ActionRow data-testid="actions"><button>Save</button></ActionRow>);
    expect(screen.getByTestId('actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  test('Toolbar passes attributes and renders its children', () => {
    render(<Toolbar aria-label="Filters" data-testid="toolbar"><input aria-label="Query" /><button>Apply</button></Toolbar>);
    expect(screen.getByTestId('toolbar')).toHaveAttribute('aria-label', 'Filters');
    expect(screen.getByRole('textbox', { name: 'Query' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});
