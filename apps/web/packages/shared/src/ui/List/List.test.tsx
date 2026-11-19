import React from 'react';
import { render, screen } from '@testing-library/react';
import List from './List';

describe('List', () => {
  test('renders list content', () => {
    render(<List aria-label="Entries">Entry</List>);
    expect(screen.getByLabelText('Entries')).toHaveTextContent('Entry');
  });
});
