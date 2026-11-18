import React from 'react';
import { render, screen } from '@testing-library/react';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  test('renders a configurable heading id and actions', () => {
    render(<PageHeader title="Campaign" headingLevel={2} id="campaign-title" actions={<button>Settings</button>} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Campaign' })).toHaveAttribute('id', 'campaign-title');
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  test('accepts React nodes for title and subtitle and uses an empty image alt fallback', () => {
    const { container } = render(<PageHeader title={<span>Editable title</span>} subtitle={<span>Editable subtitle</span>} imageUrl="portrait.png" />);
    expect(screen.getByRole('heading', { name: 'Editable title' })).toBeInTheDocument();
    expect(screen.getByText('Editable subtitle')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});
