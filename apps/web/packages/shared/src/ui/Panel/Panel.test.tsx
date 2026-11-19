import React from 'react';
import { render, screen } from '@testing-library/react';
import Panel from './Panel';

describe('Panel', () => {
  test('renders requested heading and action', () => {
    render(<Panel title="Details" headingLevel={3} actions={<button>Save</button>}>Content</Panel>);
    expect(screen.getByRole('heading', { level: 3, name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  test('renders body-only content without a heading', () => {
    render(<Panel as="article">Body content</Panel>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});
