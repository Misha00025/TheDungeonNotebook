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
    render(<PageHeader title={<span>Editable title</span>} subtitle={<span>Editable subtitle</span>} imageUrl="portrait.png" />);
    expect(screen.getByRole('heading', { name: 'Editable title' })).toBeInTheDocument();
    expect(screen.getByText('Editable subtitle')).toBeInTheDocument();
    expect(screen.getByAltText('')).toBeInTheDocument();
  });

  test('renders title aside, subtitle, and actions', () => {
    render(
      <PageHeader
        title="Hero"
        titleAside={<span>Ключевой</span>}
        subtitle="Описание"
        actions={<button>Настройки</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Hero' })).toBeInTheDocument();
    expect(screen.getByText('Ключевой')).toBeInTheDocument();
    expect(screen.getByText('Описание')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Настройки' })).toBeInTheDocument();
  });
});
