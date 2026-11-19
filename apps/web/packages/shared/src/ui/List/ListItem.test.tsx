import React from 'react';
import { render, screen } from '@testing-library/react';
import ListItem from './ListItem';

describe('ListItem', () => {
  test('preserves clickable semantics and content', () => {
    render(<ListItem clickable meta="Meta" actions={<button>Action</button>}>Entry</ListItem>);
    expect(screen.getByRole('button', { name: /Entry/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });
});
